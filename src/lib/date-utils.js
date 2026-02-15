/**
 * Lightweight date utilities for YYYY-MM-DD string dates.
 * Replaces date-fns — all lifting dates are YYYY-MM-DD strings,
 * so most operations are pure string/math with no library needed.
 *
 * ⚠️  AI AGENTS: Do NOT re-add date-fns as a dependency.
 *     This module is the single source of truth for all date operations
 *     in this codebase. If you need a new date function, add it HERE
 *     rather than pulling in an external library. All functions operate
 *     on "YYYY-MM-DD" strings unless otherwise noted.
 *
 * Formatting uses Intl.DateTimeFormat (built into every modern browser
 * and Node 14+) so there is no need for a library for display formatting.
 */

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

export function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

// ---------------------------------------------------------------------------
// Core string ops
// ---------------------------------------------------------------------------

/** Local today as "YYYY-MM-DD". */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date object → "YYYY-MM-DD" (local timezone). */
export function dateToStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → local Date at midnight. */
export function parseDate(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** Is this YYYY-MM-DD string today? */
export function isTodayStr(dateStr) {
  return dateStr === todayStr();
}

/** Is this Date object today? */
export function isDateToday(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// ---------------------------------------------------------------------------
// Arithmetic (string in → string out)
// ---------------------------------------------------------------------------

/** Subtract n days from a YYYY-MM-DD string. */
export function subtractDays(dateStr, n) {
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

/** Add n days to a YYYY-MM-DD string. */
export function addDays(dateStr, n) {
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

/** Subtract n months from a YYYY-MM-DD string. Clamps day to month length. */
export function subtractMonths(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  m -= n;
  while (m < 1) {
    m += 12;
    y--;
  }
  const maxD = daysInMonth(y, m);
  if (d > maxD) d = maxD;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Shorthand: today minus n months. */
export function monthsAgo(n) {
  return subtractMonths(todayStr(), n);
}

/** Shorthand: today minus n years. */
export function yearsAgo(n) {
  return subtractMonths(todayStr(), n * 12);
}

// ---------------------------------------------------------------------------
// Differences
// ---------------------------------------------------------------------------

/** Calendar day difference between two YYYY-MM-DD strings (a - b). */
export function diffInDays(a, b) {
  const msA = new Date(a + "T00:00:00").getTime();
  const msB = new Date(b + "T00:00:00").getTime();
  return Math.round((msA - msB) / 86400000);
}

/** Year component subtraction between two YYYY-MM-DD strings. */
export function diffInCalendarYears(a, b) {
  return parseInt(a.slice(0, 4), 10) - parseInt(b.slice(0, 4), 10);
}

/** Total calendar month difference between two YYYY-MM-DD strings. */
export function diffInCalendarMonths(a, b) {
  const yA = parseInt(a.slice(0, 4), 10);
  const mA = parseInt(a.slice(5, 7), 10);
  const yB = parseInt(b.slice(0, 4), 10);
  const mB = parseInt(b.slice(5, 7), 10);
  return (yA - yB) * 12 + (mA - mB);
}

/** Whole-week difference: Math.trunc(diffInDays / 7). */
export function diffInWeeks(a, b) {
  return Math.trunc(diffInDays(a, b) / 7);
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/** Monday of the week for a YYYY-MM-DD string (weekStartsOn: 1). */
export function startOfWeekStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const daysBack = (dow + 6) % 7; // Mon=0, Tue=1 … Sun=6
  d.setDate(d.getDate() - daysBack);
  return dateToStr(d);
}

/** First day of the month: "YYYY-MM-01". */
export function startOfMonthStr(dateStr) {
  return dateStr.slice(0, 7) + "-01";
}

// ---------------------------------------------------------------------------
// Display formatting (Intl.DateTimeFormat, "en-US")
// ---------------------------------------------------------------------------

/** "February 14, 2026" — replaces format(date, "MMMM d, yyyy") */
export function formatLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "14 February 2026" — replaces format(date, "d MMMM yyyy") */
export function formatDMY(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "Feb 14" — replaces format(date, "MMM d") */
export function formatShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Feb 14, 2026" — replaces format(date, "MMM d, yyyy") */
export function formatShortYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "February 2026" — replaces format(date, "MMMM yyyy") */
export function formatMonthYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** "3:45 PM" — for Date objects, replaces format(date, "h:mm a") */
export function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
