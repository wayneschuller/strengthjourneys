/**
 * Shared date helpers for the dashboard's YYYY-MM-DD data model.
 * Keep week math canonical here so cards and heatmaps agree on Monday-first buckets.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  YYYY-MM-DD TIMEZONE MODEL (read before touching date code)
 * ──────────────────────────────────────────────────────────────────────────
 *  Lift dates flow through the app as "YYYY-MM-DD" strings with **no
 *  timezone**: whatever calendar day the user typed in their Google Sheet.
 *  We assume the user views the app in the same locale they logged in, so
 *  there is a single right answer for "what day is this?".
 *
 *  The bug pattern to avoid is **mixing round-trips**:
 *
 *    new Date("2026-04-16")           // UTC midnight per ECMA-262
 *    new Date("2026-04-16T00:00:00Z") // UTC midnight (explicit)
 *    date.getDate()                   // LOCAL calendar day
 *    date.toLocaleDateString(...)     // LOCAL calendar day (no timeZone opt)
 *    format(date, "d MMM yyyy")       // LOCAL calendar day (date-fns)
 *
 *  Parsing a YMD string is UTC by default, but every "plain" getter is
 *  local. In USA/EU (negative UTC offset), UTC midnight Apr 16 is still
 *  Apr 15 locally — so "Apr 15" renders for a lift stored as "2026-04-16".
 *
 *  Pick **one** of these two round-trips and stay inside it:
 *
 *    1. UTC round-trip:   parseYmdUtc(str)   + .getUTC*() / timeZone:"UTC"
 *                       + formatDateToYmdUtc(date)
 *    2. Local round-trip: parseYmdLocal(str) + .get*()      / date-fns format
 *                       + formatDateToYmdLocal(date)
 *
 *  Either is correct; both round-trip the same string unchanged. What
 *  breaks is UTC-in / local-out (or vice-versa) — that's the off-by-one
 *  fixed in commits 7cfb908b + 9d634a60.
 *
 *  When only the year/month/day is needed, prefer the string helpers
 *  (getYearFromYmd, addDaysFromStr, subtractDaysFromStr, getWeekKeyFromDateStr)
 *  — they sidestep Date entirely and are timezone-invariant by construction.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Parse "YYYY-MM-DD" as UTC midnight.
 * Pair with UTC getters (.getUTCFullYear, .getUTCMonth, .getUTCDate, .getUTCDay)
 * or `toLocaleDateString(..., { timeZone: "UTC" })`. Do NOT read back with
 * local getters or date-fns `format` — that re-introduces the USA/EU off-by-one.
 */
export function parseYmdUtc(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Parse "YYYY-MM-DD" as local midnight.
 * Pair with local getters (.getFullYear, .getMonth, .getDate, .getDay),
 * `toLocaleDateString()` without `timeZone`, or date-fns `format()`. Use this
 * when the downstream formatter is locked to local — `new Date("YYYY-MM-DD")`
 * would parse as UTC and render the previous day in USA/EU.
 */
export function parseYmdLocal(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Serialize a Date to "YYYY-MM-DD" using its LOCAL calendar day.
 * Pair with `parseYmdLocal` — same round-trip, string goes in unchanged.
 */
export function formatDateToYmdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Serialize a Date to "YYYY-MM-DD" using its UTC calendar day.
 * Pair with `parseYmdUtc` — same round-trip, string goes in unchanged.
 */
export function formatDateToYmdUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const READABLE_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Long month names for the full-sentence date form. Kept as a table rather
// than Intl.DateTimeFormat on purpose: Intl resolves against the *runtime*
// locale, which differs between the Next.js server render and the browser, and
// that mismatch turns into a React hydration error. Every date the app shows
// must render identically on both sides.
const READABLE_MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const READABLE_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Convert "YYYY-MM-DD" to a short readable date string (e.g. "Apr 16" or
 * "Thursday, Apr 16"). The year is appended only when it's not the current
 * calendar year.
 *
 * Uses the UTC round-trip (parse at UTC midnight, read back via UTC getters)
 * so every locale renders the same calendar day the user logged. Do NOT mix
 * in local getters here — see the timezone model at the top of this file.
 */
export function getReadableDateString(ISOdate, includeDayOfWeek = false) {
  const date = parseYmdUtc(ISOdate);

  const dayOfWeek = READABLE_DAY_NAMES[date.getUTCDay()];
  const dayOfMonth = date.getUTCDate();
  const month = READABLE_MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  let dateString = includeDayOfWeek
    ? `${dayOfWeek}, ${month} ${dayOfMonth}`
    : `${month} ${dayOfMonth}`;
  const currentYear = new Date().getFullYear();

  if (year !== currentYear) {
    dateString += `, ${year}`;
  }

  return dateString;
}

/**
 * Convert "YYYY-MM-DD" to a full readable date (e.g. "Monday, 8 August 2026").
 *
 * Use this wherever a date stands on its own in a sentence or a caption and
 * there is room for it. RULE: never render a raw "YYYY-MM-DD" string in the UI
 * — the ISO form is our storage and sorting format, not something to show a
 * lifter. Reach for getReadableDateString() instead only when space is tight,
 * such as dense lists and chart labels.
 *
 * Day-first ordering, matching how the date would be spoken. The year is
 * dropped when it is the current year, because it is implicit. Uses the same
 * UTC round-trip as getReadableDateString so every reader sees the calendar day
 * that was actually logged — see the timezone model at the top of this file.
 *
 * @param {string} ISOdate - Date in "YYYY-MM-DD" form.
 * @param {boolean} [includeDayOfWeek=true] - Prefix the weekday name.
 * @returns {string|null} e.g. "Monday, 24 August" or "Wednesday, 30 January 2013".
 */
export function getLongReadableDateString(ISOdate, includeDayOfWeek = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ISOdate || ""))) return null;

  const date = parseYmdUtc(ISOdate);
  if (Number.isNaN(date.getTime())) return null;

  const dayOfMonth = date.getUTCDate();
  const month = READABLE_MONTH_NAMES_LONG[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const body =
    year === new Date().getFullYear()
      ? `${dayOfMonth} ${month}`
      : `${dayOfMonth} ${month} ${year}`;

  return includeDayOfWeek
    ? `${READABLE_DAY_NAMES[date.getUTCDay()]}, ${body}`
    : body;
}

/**
 * Compact "how long ago" label for a YYYY-MM-DD date: "today", "3d", "5w",
 * "8mo", "2y". Meant for dense lists where a full date would not fit.
 *
 * Both arguments are plain YMD strings and the difference is taken inside the
 * UTC round-trip, so the answer is timezone-invariant (see the timezone model
 * at the top of this file). Pass today's date in rather than reading the clock
 * here, so callers stay pure across a render.
 */
export function getCompactAgeFromYmd(dateStr, todayYmd) {
  if (!dateStr || !todayYmd) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (parseYmdUtc(todayYmd).getTime() - parseYmdUtc(dateStr).getTime()) / dayMs,
  );

  if (!Number.isFinite(days)) return null;
  if (days <= 0) return "today"; // Future-dated goal rows read as current
  if (days < 7) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;

  return `${Math.floor(days / 365)}y`;
}

export function getYearFromYmd(dateStr) {
  if (!dateStr || dateStr.length < 4) return null;
  const year = Number.parseInt(dateStr.slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
}

// Fast string-only date normalization for YYYY-M-D -> YYYY-MM-DD
export function normalizeYmd(dateStr) {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;

  const year = parts[0];
  if (year.length !== 4) return null;

  const month = parts[1].padStart(2, "0");
  const day = parts[2].padStart(2, "0");
  if (month < "01" || month > "12") return null;
  if (day < "01" || day > "31") return null;

  return `${year}-${month}-${day}`;
}

function getLocaleRegion(localeHint) {
  if (!localeHint || typeof localeHint !== "string") return null;
  const normalized = localeHint.trim().replace(/_/g, "-");
  const parts = normalized.split("-");
  if (parts.length < 2) return null;
  return parts[1]?.toUpperCase?.() || null;
}

function localePrefersMonthFirst(localeHint) {
  const region = getLocaleRegion(localeHint);
  return ["US"].includes(region);
}

export function normalizeDateInput(dateStr, localeHint) {
  const normalizedYmd = normalizeYmd(dateStr);
  if (normalizedYmd) return normalizedYmd;
  if (!dateStr) return null;

  const trimmed = String(dateStr).trim();
  const match = trimmed.match(/^(\d{1,4})[/. -](\d{1,2})[/. -](\d{1,4})$/);
  if (!match) return null;

  const [, firstRaw, secondRaw, thirdRaw] = match;
  let year;
  let month;
  let day;

  if (firstRaw.length === 4) {
    year = Number.parseInt(firstRaw, 10);
    month = Number.parseInt(secondRaw, 10);
    day = Number.parseInt(thirdRaw, 10);
  } else if (thirdRaw.length === 4) {
    year = Number.parseInt(thirdRaw, 10);
    const first = Number.parseInt(firstRaw, 10);
    const second = Number.parseInt(secondRaw, 10);

    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else if (localePrefersMonthFirst(localeHint)) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  } else {
    return null;
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getWeekKeyFromDateStr(dateStr) {
  const d = parseYmdUtc(dateStr);
  const dow = d.getUTCDay();
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_NUMBER_CACHE = new Map();
const FIRST_WEEK_KEY_CACHE = new Map();
const FIRST_WEEK_DAY_NUMBER_CACHE = new Map();

function getUtcDayNumber(dateStr) {
  const cached = DAY_NUMBER_CACHE.get(dateStr);
  if (cached !== undefined) return cached;
  const dayNumber = Math.floor(parseYmdUtc(dateStr).getTime() / 86400000);
  DAY_NUMBER_CACHE.set(dateStr, dayNumber);
  return dayNumber;
}

function getFirstWeekKeyForYear(year) {
  const cached = FIRST_WEEK_KEY_CACHE.get(year);
  if (cached) return cached;
  const firstWeekKey = getWeekKeyFromDateStr(`${year}-01-01`);
  FIRST_WEEK_KEY_CACHE.set(year, firstWeekKey);
  return firstWeekKey;
}

function getFirstWeekDayNumberForYear(year) {
  const cached = FIRST_WEEK_DAY_NUMBER_CACHE.get(year);
  if (cached !== undefined) return cached;
  const dayNumber = getUtcDayNumber(getFirstWeekKeyForYear(year));
  FIRST_WEEK_DAY_NUMBER_CACHE.set(year, dayNumber);
  return dayNumber;
}

export function getCalendarYearWeekIndexFromWeekKey(year, weekKey) {
  const deltaDays =
    getUtcDayNumber(weekKey) - getFirstWeekDayNumberForYear(year);
  return Math.floor(deltaDays / 7) + 1;
}

export function getCalendarYearWeekStartFromIndex(year, weekIndex) {
  return addDaysFromStr(getFirstWeekKeyForYear(year), (weekIndex - 1) * 7);
}

export function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

export function subtractDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);

  for (let i = 0; i < n; i++) {
    d--;
    if (d < 1) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d = daysInMonth(y, m);
    }
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);

  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
