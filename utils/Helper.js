import { getGoogleAccessToken } from "./googleConfig.js";

export const url_base = "https://sheets.googleapis.com/v4/spreadsheets";
export const calendar_url_base =
  "https://www.googleapis.com/calendar/v3/calendars";
export const school_db_id = "1iK2guH70XkRw4Haf38g9qnq34b6DRTmi2rqDHU0T6F4";
export const millis_per_day = 24 * 3600 * 1000;

const gg_calendars_map = {
  export:
    "ec8a98e4759a2165bfbb1832292ad6acc7070acfe5d64f4561da0913b690c175@group.calendar.google.com",
  main: "gaurangagurukul@gmail.com",
  "Sri Keshava Level 4":
    "d599361f9a6343b6b9bb256b78ed05f504613762899fa76b69ec149b584a6a4c@group.calendar.google.com",
  "Sri Keshava Level 1":
    "d599361f9a6343b6b9bb256b78ed05f504613762899fa76b69ec149b584a6a4c@group.calendar.google.com",
  "Sri Keshava Level 2":
    "d599361f9a6343b6b9bb256b78ed05f504613762899fa76b69ec149b584a6a4c@group.calendar.google.com",
  "Sri Keshava Level 3":
    "d599361f9a6343b6b9bb256b78ed05f504613762899fa76b69ec149b584a6a4c@group.calendar.google.com",
  "Sri Narayana": "gaurangagurukul@gmail.com",
  "Sri Madhava": "gaurangagurukul@gmail.com",
  "Sri Govinda": "gaurangagurukul@gmail.com",
  "Sri Vishnu": "gaurangagurukul@gmail.com",
  "Sri Madhusudana": "gaurangagurukul@gmail.com",
  "Sri Trivikrama": "gaurangagurukul@gmail.com",
  "Sri Vamana": "gaurangagurukul@gmail.com",
  "Sri Sridhara": "gaurangagurukul@gmail.com",
  "Sri Hrishikesha": "gaurangagurukul@gmail.com",
  "Sri Padmanabha":
    "e9d58b3a793f6bebec9fc51f01be4e2ba360814beeb5043d04a6cb2c5d2e486e@group.calendar.google.com",
  "Sri Damodara":
    "be01c7853934e84fb781b95fb2dd56f50724835e7cb9095a9e1154bf8b6c7c9c@group.calendar.google.com",
  "Sri Vasudeva":
    "48118dd18892ffd02ebec41dd7bc1fe3d25f2cdc03215157b7b9ac542b063a29@group.calendar.google.com",
};

function isAllDayCalendarEvent(event) {
  return !!event.start?.date && !event.start?.dateTime;
}

async function getCurrentSession(event_date = "", class_name = "", env) {
  const check_dt = event_date === "" ? new Date() : event_date;

  const inputDate = formatDateIST(check_dt, "yyyy-MM-dd");

  const calendarId =
    class_name === "" ? gg_calendars_map["main"] : gg_calendars_map[class_name];

  const response = await fetchCalendarEvents(calendarId, inputDate, env);

  const calendar_events = response.data || [];

  for (const event of calendar_events) {
    // Google Calendar API:
    // all-day event has start.date
    const isAllDay = !!event.start?.date && !event.start?.dateTime;

    const title = (event.summary || "").split(" : ")[0].trim().toLowerCase();

    if (isAllDay && title === "session") {
      return event.summary.split(" : ").slice(1).join(" : ").trim();
    }
  }

  return "";
}

export async function getCurrentExam(
  class_name = "",
  event_date = "",
  check_start_dt = 0,
  env,
) {
  const check_dt = event_date === "" ? new Date() : event_date;

  const inputDate = formatDateIST(check_dt, "yyyy-MM-dd");

  const calendarId =
    class_name === "" ? gg_calendars_map["main"] : gg_calendars_map[class_name];

  const response = await fetchCalendarEvents(calendarId, inputDate, env);

  const calendar_events = response.data || [];

  for (const event of calendar_events) {
    const titleParts = (event.summary || "").split(" : ");

    const eventType = titleParts[0].trim().toLowerCase();

    if (eventType !== "examination") {
      continue;
    }

    const examName = titleParts.slice(1).join(" : ").trim();

    // If check_start_dt = 1,
    // return the exam only when its start date is exactly check_dt.
    if (check_start_dt === 1) {
      const examStartDate = event.start?.date;

      if (examStartDate === inputDate) {
        return examName;
      }

      return "";
    }

    return examName;
  }

  return "";
}

export function formatDateIST(inputDate = new Date(), format = "yyyy/MM/dd") {
  let date;

  if (inputDate instanceof Date) {
    date = inputDate;
  } else if (typeof inputDate === "string") {
    // dd/MM/yyyy
    const [day, month, year] = inputDate.split("/").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    throw new Error(`Invalid date input: ${inputDate}`);
  }

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${inputDate}`);
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return format
    .replace("yyyy", values.year)
    .replace("MM", values.month)
    .replace("dd", values.day)
    .replace("HH", values.hour)
    .replace("mm", values.minute)
    .replace("ss", values.second);
}

export async function checkCal(
  input_dt = new Date(),
  class_name = "",
  chk_sunday = 1,
  env,
) {
  let status = "N";

  // Format input date as yyyy-MM-dd for fetchCalendarEvents()
  const inputDate = formatDateIST(input_dt, "yyyy-MM-dd");

  // Main calendar events
  const mainCalendarEventsResponse = await fetchCalendarEvents(
    gg_calendars_map["main"],
    inputDate,
    env,
  );

  const main_calendar_events = mainCalendarEventsResponse.data || [];

  // Class calendar events
  let calendar_events = [];

  if (class_name !== "") {
    const calendarEventsResponse = await fetchCalendarEvents(
      gg_calendars_map[class_name],
      inputDate,
      env,
    );

    calendar_events = calendarEventsResponse.data || [];
  }

  // Sunday / no session / no examination
  if (
    (chk_sunday == 1 && formatDateIST(input_dt, "EEE") === "Sun") ||
    ((await getCurrentSession(input_dt, class_name, env)) === "" &&
      (await getCurrentExam(class_name, date, 0, env)) === "")
  ) {
    return "Y";
  }

  // Check class calendar
  for (let i = 0; i < calendar_events.length; i++) {
    const event = calendar_events[i];

    const title = (event.summary || "").split(" : ")[0].toLowerCase();

    // Holiday
    if (isAllDayCalendarEvent(event) && title === "holiday") {
      status = "Y";
      break;
    }

    // Examination
    if (title === "examination") {
      status = "E";
      break;
    }
  }

  // Check main calendar
  for (let i = 0; i < main_calendar_events.length; i++) {
    const event = main_calendar_events[i];

    const title = (event.summary || "").split(" : ")[0].toLowerCase();

    if (isAllDayCalendarEvent(event) && title === "holiday") {
      status = "Y";
      break;
    }
  }

  if (class_name !== "") {
    console.log("Returning status:", status, "for class:", class_name);
  }

  return status;
}

export async function fetchData(sheetId, sheetName, env) {
  if (!sheetName) {
    return {
      status: false,
      message: "sheetName is required",
    };
  }

  const accessToken = await getGoogleAccessToken(env);
  const range = encodeURIComponent(`'${sheetName}'`);
  const url = `${url_base}/${sheetId}/values/${range}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Fetch Data Google Error:", data);

    throw new Error(data.error?.message || "Unable to read Google Sheet");
  }

  return {
    status: true,
    message: "Fetch Data successful",
    data: data.values || [],
  };
}

export async function fetchCalendarEvents(calendarId, inputDate, env) {
  const accessToken = await getGoogleAccessToken(env);

  // inputDate expected: "2026-10-08"
  // Google Calendar day boundaries in IST
  const startDate = new Date(`${inputDate}T00:00:00+05:30`);
  const endDate = new Date(startDate.getTime() + millis_per_day);
  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  const url =
    `${calendar_url_base}/${encodeURIComponent(calendarId)}/events` +
    `?timeZone=Asia%2FKolkata` +
    `&timeMin=${encodeURIComponent(timeMin)}` +
    `&timeMax=${encodeURIComponent(timeMax)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Fetch Calendar Google Error:", data);

    throw new Error(data.error?.message || "Unable to read Google Calendar");
  }

  return {
    status: true,
    message: "GET Calendar successful",
    data: data.items || [],
  };
}
