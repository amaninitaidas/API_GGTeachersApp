import {
  now,
  millis_per_day,
  school_db_id,
  fetchData,
  fetchCalendarEvents,
  formatDateIST,
  checkCal,
} from "../utils/Helper.js";

function getStudentStreamMap() {
  let student_ignore_map = {};
  let i, j;
  let student_st_map = {};
  let student_data = [];
  let stream_data = [];
  let stream_sub_map = {};
  let stream_classes = ["Sri Damodara", "Sri Vasudeva"];

  student_data = fetchData(school_db_id, "Students");

  for (i = 1; i < student_data.length; i++) {
    if (
      student_data[i][0] != "" &&
      student_data[i][1] == "Y" &&
      student_data[i][24] != "" &&
      stream_classes.includes(student_data[i][2])
    ) {
      student_st_map[student_data[i][3] + "_" + student_data[i][0]] =
        student_data[i][24];
    }
  }

  stream_data = fetchData(school_db_id, "Senior Secondary Streams");

  for (i = 1; i < stream_data.length; i++) {
    if (stream_data[i][1] == "") break;
    stream_sub_map[stream_data[i][1]] = stream_data[i][2].split(", ");
  }

  let class_data = fetchData(school_db_id, "Classes");
  let all_sub_arr = [];

  for (i = 15; i < class_data.length; i++) {
    for (j = 4; j < class_data[i].length; j++) {
      if (class_data[i][j] == "") break;
      if (!all_sub_arr.includes(class_data[i][j]))
        all_sub_arr.push(class_data[i][j]);
    }
  }

  for (student_name in student_st_map) {
    student_ignore_map[student_name] = [];
    for (i = 0; i < all_sub_arr.length; i++) {
      if (
        !stream_sub_map[student_st_map[student_name]].includes(all_sub_arr[i])
      )
        student_ignore_map[student_name].push(all_sub_arr[i]);
    }
  }

  //Logger.log(student_ignore_map)

  return student_ignore_map;
}

function getStudentLeaves() {
  const data = fetchData(
    "1FsrJVzfaCWwIWfIjaDU_I_Z9iHP4E3cK_veAdB8tsDo",
    "Student Input",
  );
  let i;
  const today_dt = formatDateIST(now);

  let out_arr = [];

  for (i = 1; i < data.length; i++) {
    if (data[i][0] == "") break;

    if (
      formatDateIST(data[i][1]) > today_dt ||
      formatDateIST(data[i][2]) < today_dt
    )
      continue;

    if (!out_arr.includes(data[i][3])) out_arr.push(data[i][3]);
  }

  //Logger.log(out_arr);

  return out_arr;
}

export async function GET_TODAY_CLASS_DETAILS_FOR_TEACHER(inputData, env) {
  let student_ignore_map = getStudentStreamMap();
  let students_on_leave = getStudentLeaves();

  try {
    let teacherName = inputData?.toString().trim();
    if (!teacherName) return "Teacher is required!";

    // File IDs
    const mappingFileId = "1SlObzcakqDlfeW1sKG85X9aPfS4Eg09EgSqt4p5mAxs";
    const timetableFileId = "1QozwSM-LTjRMPjXp-UJdPtSAzo2Q9nu4zf8vfP0BRME";

    if (!teacherName) return "";

    // Get all classes for this teacher from mapping file
    const mappingData = fetchData(mappingFileId, "Class-Subject-Teacher");

    const classSet = new Set();
    for (let i = 1; i < mappingData.length; i++) {
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
    const todayName = dayNames[now.getDay()];

    // Open timetable and prepare result
    const result = {};

    for (let className of classSet) {
      const data = fetchData(timetableFileId, className);
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
      const studentData = fetchData(school_db_id, "Student Details");

      const students = [];
      for (let i = 1; i < studentData.length; i++) {
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

      if (
        (await checkCal(now, className, 1, env)) == "N" &&
        subjectsToday.size > 0
      ) {
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

    //Logger.log(result)

    return {
      loggedInAs: teacherName,
      role: "teacher",
      data: result,
      cTResponse: "",
    };
  } catch (ex) {
    throw ex;
  }
}
