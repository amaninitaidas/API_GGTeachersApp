import {
  millis_per_day,
  school_db_id,
  fetchData,
  formatDateIST,
  checkCal,
  getCurrentExam,
  gg_calendars_map,
  fetchCalendarEvents,
} from "../utils/Helper.js";

async function getStudentStreamMap(env) {
  let student_ignore_map = {};
  let i, j;
  let student_st_map = {};
  let student_data = [];
  let stream_data = [];
  let stream_sub_map = {};
  let stream_classes = ["Sri Damodara", "Sri Vasudeva"];

  const response = await fetchData(school_db_id, "Students", env);
  if (response?.status === false) {
    throw new Error(response?.message || "Unable to read Student Database");
  }

  student_data = response.data;

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

  const streamResponse = await fetchData(
    school_db_id,
    "Senior Secondary Streams",
    env,
  );
  if (streamResponse?.status === false) {
    throw new Error(
      streamResponse?.message || "Unable to read Senior Secondary Streams",
    );
  }
  stream_data = streamResponse.data;

  for (i = 1; i < stream_data.length; i++) {
    if (stream_data[i][1] == "") break;
    stream_sub_map[stream_data[i][1]] = stream_data[i][2].split(", ");
  }

  const classResponse = await fetchData(school_db_id, "Classes", env);
  if (classResponse?.status === false) {
    throw new Error(classResponse?.message || "Unable to read Classes");
  }
  let class_data = classResponse.data;
  let all_sub_arr = [];

  for (i = 15; i < class_data.length; i++) {
    for (j = 4; j < class_data[i].length; j++) {
      if (class_data[i][j] == "") break;
      if (!all_sub_arr.includes(class_data[i][j]))
        all_sub_arr.push(class_data[i][j]);
    }
  }

  for (let student_name in student_st_map) {
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

async function getStudentLeaves(env) {
  const response = await fetchData(
    "1FsrJVzfaCWwIWfIjaDU_I_Z9iHP4E3cK_veAdB8tsDo",
    "Student Input",
    env,
  );

  if (response?.status === false) {
    throw new Error(response?.message || "Unable to read Student Leaves");
  }

  let i;
  const data = response.data;
  const today_dt = formatDateIST();

  let out_arr = [];

  for (i = 1; i < data.length; i++) {
    if (data[i][0] == "") break;

    // console.log(formatDateIST(data[i][1]), formatDateIST(data[i][2]), today_dt);
    if (
      formatDateIST(data[i][1]) > today_dt ||
      formatDateIST(data[i][2]) < today_dt
    )
      continue;

    if (!out_arr.includes(data[i][3])) out_arr.push(data[i][3]);
  }

  //console.log(out_arr);

  return out_arr;
}

// export async function GET_TODAY_CLASS_DETAILS_FOR_TEACHER(inputData, env) {
//   let student_ignore_map = await getStudentStreamMap(env);
//   let students_on_leave = await getStudentLeaves(env);
//   let now = new Date();
//   const todayDate = formatDateIST(now, "yyyy-MM-dd");

//   const mainCalendarEventsResponse = await fetchCalendarEvents(
//     gg_calendars_map["main"],
//     todayDate,
//     env,
//   );

//   const mainCalendarEvents = mainCalendarEventsResponse.data || [];

//   // Get today's day name
//   const dayNames = [
//     "Sunday",
//     "Monday",
//     "Tuesday",
//     "Wednesday",
//     "Thursday",
//     "Friday",
//     "Saturday",
//   ];
//   const todayName = dayNames[now.getDay()];

//   try {
//     let teacherName = inputData?.toString().trim();
//     if (!teacherName) return "Teacher is required!";

//     // File IDs
//     const mappingFileId = "1SlObzcakqDlfeW1sKG85X9aPfS4Eg09EgSqt4p5mAxs";
//     const timetableFileId = "1QozwSM-LTjRMPjXp-UJdPtSAzo2Q9nu4zf8vfP0BRME";

//     // Get all classes for this teacher from mapping file
//     const mappingDataResponse = await fetchData(
//       mappingFileId,
//       "Class-Subject-Teacher",
//       env,
//     );
//     if (mappingDataResponse?.status === false) {
//       throw new Error(
//         mappingDataResponse?.message || "Unable to read Student Database",
//       );
//     }

//     const mappingData = mappingDataResponse.data;

//     const classSet = new Set();
//     for (let i = 1; i < mappingData.length; i++) {
//       const [className, teacher] = mappingData[i];
//       if (teacher.toLowerCase() === teacherName.toLowerCase()) {
//         classSet.add(className);
//       }
//     }
//     if (classSet.size === 0) return "";

//     // Open timetable and prepare result
//     const result = {};

//     for (let className of classSet) {
//       const ttDataResponse = await fetchData(timetableFileId, className, env);
//       if (ttDataResponse?.status === false) {
//         throw new Error(
//           ttDataResponse?.message || "Unable to read Student Database",
//         );
//       }

//       const data = ttDataResponse.data;
//       const header = data[0];
//       const dayColIndex = header.findIndex(
//         (h) => h?.toString().trim() === todayName,
//       );
//       if (dayColIndex === -1) continue;

//       const subjectsToday = new Set();
//       for (let r = 1; r < data.length; r++) {
//         const cell = data[r][dayColIndex];
//         if (cell && cell.toString().includes("(")) {
//           const [subj, teacherInCellRaw] = cell.toString().split("(");
//           const teacherInCell = teacherInCellRaw.replace(")", "").trim();

//           if (teacherInCell === teacherName) {
//             subjectsToday.add(subj.trim());
//           }
//         }
//       }

//       // Get students for the class
//       const studentDataResponse = await fetchData(
//         school_db_id,
//         "Student Details",
//         env,
//       );
//       if (studentDataResponse?.status === false) {
//         throw new Error(
//           studentDataResponse?.message || "Unable to read Student Database",
//         );
//       }

//       const studentData = studentDataResponse.data;
//       const students = [];
//       for (let i = 1; i < studentData.length; i++) {
//         const [studentName, isActive, admNumber, studentClass] = studentData[i];
//         let student_name_str = `${admNumber}_${studentName}`;

//         if (students_on_leave.includes(student_name_str))
//           student_name_str += " - L";

//         if (
//           isActive?.toString().trim().toUpperCase() === "Y" &&
//           studentClass === className &&
//           (student_ignore_map[student_name_str] == null ||
//             (Array.from(subjectsToday).length > 0 &&
//               !student_ignore_map[student_name_str].includes(
//                 Array.from(subjectsToday)[0],
//               )))
//         ) {
//           students.push(student_name_str);
//         }
//       }

//       if (students.length == 0) continue;

//       // Sort students by name only
//       students.sort((a, b) => {
//         const nameA = a.split("_")[1].toLowerCase();
//         const nameB = b.split("_")[1].toLowerCase();
//         return nameA.localeCompare(nameB);
//       });

//       let calendarStatus = await checkCal(now, className, 1, env);

//       if (calendarStatus == "N" && subjectsToday.size > 0) {
//         result[className] = {
//           subjects: Array.from(subjectsToday),
//           students: students,
//           examNextDay:
//             (await getCurrentExam(
//               className,
//               new Date(now.getTime() - millis_per_day),
//               0,
//               env,
//             )) == ""
//               ? 0
//               : 1,
//         };
//       }
//     }

//     //Logger.log(result)

//     return {
//       loggedInAs: teacherName,
//       role: "teacher",
//       data: result,
//       cTResponse: {},
//       status: true,
//     };
//   } catch (ex) {
//     throw ex;
//   }
// }

export async function GET_TODAY_CLASS_DETAILS_FOR_TEACHER(inputData, env) {
  try {
    const teacherName = inputData?.toString().trim();

    if (!teacherName) {
      return "Teacher is required!";
    }

    const now = new Date();
    const todayDate = formatDateIST(now, "yyyy-MM-dd");

    // --------------------------------------------------
    // Get common data ONCE
    // --------------------------------------------------

    const student_ignore_map = await getStudentStreamMap(env);
    const students_on_leave = await getStudentLeaves(env);

    // Student Details - only ONE API call
    const studentDataResponse = await fetchData(
      school_db_id,
      "Student Details",
      env,
    );

    if (studentDataResponse?.status === false) {
      throw new Error(
        studentDataResponse?.message || "Unable to read Student Database",
      );
    }

    const studentData = studentDataResponse.data;

    // Main calendar - only ONE API call for today
    const mainCalendarEventsResponse = await fetchCalendarEvents(
      gg_calendars_map["main"],
      todayDate,
      env,
    );

    if (mainCalendarEventsResponse?.status === false) {
      throw new Error(
        mainCalendarEventsResponse?.message || "Unable to read main calendar",
      );
    }

    const mainCalendarEvents = mainCalendarEventsResponse.data || [];

    // --------------------------------------------------
    // Today's day
    // --------------------------------------------------

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

    // --------------------------------------------------
    // File IDs
    // --------------------------------------------------

    const mappingFileId = "1SlObzcakqDlfeW1sKG85X9aPfS4Eg09EgSqt4p5mAxs";

    const timetableFileId = "1QozwSM-LTjRMPjXp-UJdPtSAzo2Q9nu4zf8vfP0BRME";

    // --------------------------------------------------
    // Get all classes for this teacher
    // --------------------------------------------------

    const mappingDataResponse = await fetchData(
      mappingFileId,
      "Class-Subject-Teacher",
      env,
    );

    if (mappingDataResponse?.status === false) {
      throw new Error(
        mappingDataResponse?.message || "Unable to read Class-Subject-Teacher",
      );
    }

    const mappingData = mappingDataResponse.data;

    const classSet = new Set();

    for (let i = 1; i < mappingData.length; i++) {
      const [className, teacher] = mappingData[i];

      if (
        teacher?.toString().trim().toLowerCase() === teacherName.toLowerCase()
      ) {
        classSet.add(className);
      }
    }

    if (classSet.size === 0) {
      return "";
    }

    // --------------------------------------------------
    // Prepare result
    // --------------------------------------------------

    const result = {};

    // --------------------------------------------------
    // Process each class
    // --------------------------------------------------

    for (const className of classSet) {
      // ----------------------------------------------
      // Get timetable
      // ----------------------------------------------

      const ttDataResponse = await fetchData(timetableFileId, className, env);

      if (ttDataResponse?.status === false) {
        throw new Error(ttDataResponse?.message || "Unable to read timetable");
      }

      const data = ttDataResponse.data;

      if (!data || data.length === 0) {
        continue;
      }

      const header = data[0];

      const dayColIndex = header.findIndex(
        (h) => h?.toString().trim() === todayName,
      );

      if (dayColIndex === -1) {
        continue;
      }

      // ----------------------------------------------
      // Find today's subjects for this teacher
      // ----------------------------------------------

      const subjectsToday = new Set();

      for (let r = 1; r < data.length; r++) {
        const cell = data[r][dayColIndex];

        if (cell && cell.toString().includes("(")) {
          const [subj, teacherInCellRaw] = cell.toString().split("(");

          const teacherInCell = teacherInCellRaw?.replace(")", "").trim();

          if (teacherInCell?.toLowerCase() === teacherName.toLowerCase()) {
            subjectsToday.add(subj.trim());
          }
        }
      }

      if (subjectsToday.size === 0) {
        continue;
      }

      // ----------------------------------------------
      // Get students for this class
      // ----------------------------------------------

      const students = [];

      for (let i = 1; i < studentData.length; i++) {
        const [studentName, isActive, admNumber, studentClass] = studentData[i];

        if (
          isActive?.toString().trim().toUpperCase() !== "Y" ||
          studentClass !== className
        ) {
          continue;
        }

        let student_name_str = `${admNumber}_${studentName}`;

        const isOnLeave = students_on_leave.includes(student_name_str);

        if (isOnLeave) {
          student_name_str += " - L";
        }

        const ignoredSubjects = student_ignore_map[student_name_str];

        const firstSubject = Array.from(subjectsToday)[0];

        const shouldIgnore =
          ignoredSubjects != null &&
          firstSubject &&
          ignoredSubjects.includes(firstSubject);

        if (!shouldIgnore) {
          students.push(student_name_str);
        }
      }

      if (students.length === 0) {
        continue;
      }

      // ----------------------------------------------
      // Sort students by name
      // ----------------------------------------------

      students.sort((a, b) => {
        const nameA = a.split("_")[1]?.toLowerCase() || "";

        const nameB = b.split("_")[1]?.toLowerCase() || "";

        return nameA.localeCompare(nameB);
      });

      // ----------------------------------------------
      // Check today's calendar
      // ----------------------------------------------

      const calendarStatus = await checkCal(
        now,
        className,
        1,
        env,
        mainCalendarEvents,
      );

      // ----------------------------------------------
      // Add class to result
      // ----------------------------------------------

      if (calendarStatus === "N" && subjectsToday.size > 0) {
        const yesterday = new Date(now.getTime() - millis_per_day);

        const examYesterday = await getCurrentExam(
          className,
          yesterday,
          0,
          env,
        );

        result[className] = {
          subjects: Array.from(subjectsToday),
          students: students,
          examNextDay: examYesterday === "" ? 0 : 1,
        };
      }
    }

    return {
      loggedInAs: teacherName,
      role: "teacher",
      data: result,
      cTResponse: {},
      status: true,
    };
  } catch (ex) {
    console.error("GET_TODAY_CLASS_DETAILS_FOR_TEACHER Error:", ex);

    throw ex;
  }
}
