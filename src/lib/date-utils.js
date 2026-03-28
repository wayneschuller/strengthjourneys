/**
 * Shared date helpers for the dashboard's YYYY-MM-DD data model.
 * Keep week math canonical here so cards and heatmaps agree on Monday-first buckets.
 */
export function parseYmdUtc(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

export function formatDateToYmdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateToYmdUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
