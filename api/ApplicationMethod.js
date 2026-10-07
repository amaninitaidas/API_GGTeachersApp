import { getGoogleAccessToken } from "../utils/googleConfig.js";

const url_base = "https://sheets.googleapis.com/v4/spreadsheets";

// GET DATA

export async function GET_DATA(inputData, env) {
  const sheetName = inputData.sheetName;
  //testing honey again
  if (!sheetName) {
    return {
      status: false,
      message: "sheetName is required",
    };
  }

  const accessToken = await getGoogleAccessToken(env);
  const range = encodeURIComponent(`'${sheetName}'`);
  const url = `${url_base}/${SPREADSHEET_ID}/values/${range}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("GET_DATA Google Error:", data);

    throw new Error(data.error?.message || "Unable to read Google Sheet");
  }

  return {
    status: true,
    message: "GET_DATA successful",
    data: data.values || [],
  };
}

export async function GET_TODAY_CLASS_DETAILS_FOR_TEACHER(inputData) {
  let student_ignore_map = getStudentStreamMap();
  let students_on_leave = getStudentLeaves();

  try {
    let teacherName = inputData?.toString().trim();
    if (!teacherName) return "Teacher is required!";

    // File IDs
    const teacherFileId = "1iK2guH70XkRw4Haf38g9qnq34b6DRTmi2rqDHU0T6F4";
    const mappingFileId = "1SlObzcakqDlfeW1sKG85X9aPfS4Eg09EgSqt4p5mAxs";
    const timetableFileId = "1QozwSM-LTjRMPjXp-UJdPtSAzo2Q9nu4zf8vfP0BRME";

    const teacherFile = SpreadsheetApp.openById(teacherFileId);

    if (!teacherName) return "";

    // Get all classes for this teacher from mapping file
    const mappingSheet = SpreadsheetApp.openById(mappingFileId).getSheetByName(
      "Class-Subject-Teacher",
    );
    const mappingData = mappingSheet
      .getRange(2, 1, mappingSheet.getLastRow() - 1, 3)
      .getValues();

    const classSet = new Set();
    for (let i = 0; i < mappingData.length; i++) {
      const [className, teacher] = mappingData[i];
      if (teacher.toLowerCase() === teacherName.toLowerCase()) {
        classSet.add(className);
      }
    }
    if (classSet.size === 0) return "";

    // Get today's day name
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const todayName = dayNames[new Date().getDay()];

    // Open timetable and prepare result
    const timetableFile = SpreadsheetApp.openById(timetableFileId);
    const result = {};

    for (let className of classSet) {
      const sheet = timetableFile.getSheetByName(className);
      if (!sheet) continue;

      const data = sheet.getDataRange().getValues();
      const header = data[0];
      const dayColIndex = header.findIndex(
        (h) => h?.toString().trim() === todayName,
      );
      if (dayColIndex === -1) continue;

      const subjectsToday = new Set();
      for (let r = 1; r < data.length; r++) {
        const cell = data[r][dayColIndex];
        if (cell && cell.toString().includes("(")) {
          const [subj, teacherInCellRaw] = cell.toString().split("(");
          const teacherInCell = teacherInCellRaw.replace(")", "").trim();

          if (teacherInCell === teacherName) {
            subjectsToday.add(subj.trim());
          }
        }
      }

      // Get students for the class
      const studentSheet = teacherFile.getSheetByName("Student Details");
      const studentData = studentSheet
        .getRange(2, 1, studentSheet.getLastRow() - 1, 5)
        .getValues();

      const students = [];
      for (let i = 0; i < studentData.length; i++) {
        const [studentName, isActive, admNumber, studentClass] = studentData[i];
        let student_name_str = `${admNumber}_${studentName}`;

        if (students_on_leave.includes(student_name_str))
          student_name_str += " - L";

        if (
          isActive?.toString().trim().toUpperCase() === "Y" &&
          studentClass === className &&
          (student_ignore_map[student_name_str] == null ||
            (Array.from(subjectsToday).length > 0 &&
              !student_ignore_map[student_name_str].includes(
                Array.from(subjectsToday)[0],
              )))
        ) {
          students.push(student_name_str);
        }
      }

      if (students.length == 0) continue;

      // Sort students by name only
      students.sort((a, b) => {
        const nameA = a.split("_")[1].toLowerCase();
        const nameB = b.split("_")[1].toLowerCase();
        return nameA.localeCompare(nameB);
      });
      console.log(students);
      console.log(checkCal(now, className));
      if (checkCal(now, className) == "N" && subjectsToday.size > 0) {
        result[className] = {
          subjects: Array.from(subjectsToday),
          students: students,
          examNextDay:
            getCurrentExam(
              className,
              new Date(now.getTime() - millis_per_day),
            ) == ""
              ? 0
              : 1,
        };
      }
    }

    const cTResponse = getClassTests(undefined, Array.from(classSet));

    //Logger.log(result)

    return {
      loggedInAs: teacherName,
      role: "teacher",
      data: result,
      cTResponse: cTResponse,
    };
  } catch (ex) {
    throw ex;
  }
}
