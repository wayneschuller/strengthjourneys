import { format } from "date-fns";
import { estimateE1RM } from "./estimate-e1rm";

// Simple wrapper for console.log
export function devLog(...messages) {
  // We setup this special env variable on Vercel dev and preview but NOT production builds
  // This is so non-localhost clients can see devLogs on Vercel preview builds
  // Development machines should add this to their .env or .env.local
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    console.log(...messages);
  }
}

export const coreLiftTypes = [
  "Back Squat",
  "Deadlift",
  "Bench Press",
  "Strict Press",
  "Snatch",
  "Power Snatch",
  "Clean",
  "Power Clean",
  "Front Squat",
];

// Function to get a celebration emoji based on the provided position
export function getCelebrationEmoji(position) {
  // Array of celebration emojis corresponding to different positions
  const positionEmojis = [
    "\u{1F947}", // 🥇 First Place Medal
    "\u{1F948}", // 🥈 Second Place Medal
    "\u{1F949}", // 🥉 Third Place Medal
    "\u{1F4AA}", // 💪 Flexed Biceps
    "\u{1F44C}", // 👌 OK Hand
    "\u{1F44F}", // 👏 Clapping Hands
    "\u{1F3C6}", // 🏆 Trophy
    "\u{1F525}", // 🔥 Fire
    "\u{1F4AF}", // 💯 Hundred Points
    "\u{1F929}", // 🤩 Star-Struck
    "\u{1F389}", // 🎉 Party Popper
    "\u{1F44D}", // 👍 Thumbs Up
    "\u{1F381}", // 🎁 Wrapped Gift
    "\u{1F60D}", // 😍 Heart Eyes
    "\u{1F389}", // 🎉 Party Popper (Duplicate, added for emphasis)
    "\u{1F60A}", // 😊 Smiling Face with Smiling Eyes
    "\u{1F604}", // 😄 Smiling Face with Open Mouth and Smiling Eyes
    "\u{1F60B}", // 😋 Face Savoring Food
    "\u{1F973}", // 🥳 Partying Face
    "\u{1F609}", // 😉 Winking Face
  ];

  // Return the celebration emoji based on the provided position
  return positionEmojis[position];
}

// Convert ISO "YYYY-MM-DD" to readable date string
export function getReadableDateString(ISOdate, includeDayOfWeek = false) {
  // const date = new Date(ISOdate);

  const date = new Date(ISOdate + "T00:00:00Z"); // Force midnight UTC time

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const monthNames = [
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

  const dayOfWeek = dayNames[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let dateString = includeDayOfWeek
    ? `${dayOfWeek}, ${month} ${dayOfMonth}`
    : `${month} ${dayOfMonth}`;
  const currentYear = new Date().getFullYear();

  // Include the year only if it's not the current year
  if (year !== currentYear) {
    dateString += `, ${year}`;
  }

  return dateString;
}

export function getReadableDateString2(ISOdate) {
  let date = new Date(ISOdate);

  const monthNames = [
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

  const monthNamesFull = [
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

  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let dateString = `${month} ${day}`;
  const currentYear = new Date().getFullYear();

  // Include the year only if it's not the current year
  if (year !== currentYear) {
    dateString += `, ${year}`;
  }

  return dateString;
}

// --- Session tonnage helpers (rolling 365 days) ---

// Internal: normalize ISO date string (YYYY-MM-DD) to a Date at midnight UTC
function toUTCDate(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

// Internal: check if a given entry should be included based on goal and unit type
function isIncludedLift(entry, unitType) {
  if (!entry) return false;
  if (entry.isGoal) return false;
  if (unitType && entry.unitType && entry.unitType !== unitType) return false;
  return true;
}

// Sum tonnage (weight * reps) for a specific session date.
export function calculateSessionTonnageForDate(parsedData, date, unitType) {
  if (!parsedData || !date) return 0;

  return parsedData.reduce((acc, lift) => {
    if (!isIncludedLift(lift, unitType)) return acc;
    if (lift.date !== date) return acc;

    const reps = lift.reps ?? 0;
    const weight = lift.weight ?? 0;
    return acc + reps * weight;
  }, 0);
}

// Sum tonnage for a specific lift type on a specific session date.
export function calculateLiftTonnageForDate(
  parsedData,
  date,
  liftType,
  unitType,
) {
  if (!parsedData || !date || !liftType) return 0;

  return parsedData.reduce((acc, lift) => {
    if (!isIncludedLift(lift, unitType)) return acc;
    if (lift.date !== date) return acc;
    if (lift.liftType !== liftType) return acc;

    const reps = lift.reps ?? 0;
    const weight = lift.weight ?? 0;
    return acc + reps * weight;
  }, 0);
}

// Get distinct session dates within the last 365 days (inclusive of endDate).
export function getRollingYearSessions(parsedData, endDate, unitType) {
  if (!parsedData || !endDate) return [];

  const end = toUTCDate(endDate);
  const start = new Date(end);
  // 365-day window including end date: end minus 364 days
  start.setUTCDate(start.getUTCDate() - 364);

  const sessionsMap = {};

  parsedData.forEach((lift) => {
    if (!isIncludedLift(lift, unitType)) return;
    if (!lift.date) return;

    const d = toUTCDate(lift.date);
    if (d < start || d > end) return;

    sessionsMap[lift.date] = true;
  });

  return Object.keys(sessionsMap).sort();
}

// Average total tonnage per session over the rolling last 365 days.
export function getAverageSessionTonnage(parsedData, endDate, unitType) {
  const sessions = getRollingYearSessions(parsedData, endDate, unitType);
  if (!sessions.length) {
    return { average: 0, sessionCount: 0 };
  }

  let totalTonnage = 0;
  sessions.forEach((sessionDate) => {
    totalTonnage += calculateSessionTonnageForDate(
      parsedData,
      sessionDate,
      unitType,
    );
  });

  return {
    average: totalTonnage / sessions.length,
    sessionCount: sessions.length,
  };
}

// Average per-session tonnage for a specific lift type over the rolling last 365 days.
export function getAverageLiftSessionTonnage(
  parsedData,
  endDate,
  liftType,
  unitType,
) {
  if (!parsedData || !liftType || !endDate) {
    return { average: 0, sessionCount: 0 };
  }

  const sessions = getRollingYearSessions(parsedData, endDate, unitType);
  if (!sessions.length) {
    return { average: 0, sessionCount: 0 };
  }

  let totalTonnage = 0;
  let countedSessions = 0;

  sessions.forEach((sessionDate) => {
    const tonnage = calculateLiftTonnageForDate(
      parsedData,
      sessionDate,
      liftType,
      unitType,
    );
    if (tonnage > 0) {
      totalTonnage += tonnage;
      countedSessions += 1;
    }
  });

  if (!countedSessions) {
    return { average: 0, sessionCount: 0 };
  }

  return {
    average: totalTonnage / countedSessions,
    sessionCount: countedSessions,
  };
}

/**
 * Collect top PRs for each lift type and rep range (1–10 reps).
 *
 * @param {Array} parsedData - Chronologically sorted lift entries from parseData
 * @param {Array} liftTypes - List of { liftType } from calculateLiftTypes
 * @returns {{ topLiftsByTypeAndReps: Object, topLiftsByTypeAndRepsLast12Months: Object }}
 *
 * **topLiftsByTypeAndReps / topLiftsByTypeAndRepsLast12Months format:**
 * - Top-level keys: lift type strings (e.g. `"Back Squat"`, `"Bench Press"`)
 * - Value per lift type: array of 10 arrays (indices 0–9 = 1–10 reps)
 * - Each inner array: lift objects sorted by weight descending (best first)
 * - Ties (equal weight): earlier date ranks better; later warmups are trimmed out
 * - Each entry: `{ date, liftType, reps, weight, unitType, ... }` (full parsed row)
 *
 * Examples:
 * - `topLiftsByTypeAndReps["Bench Press"][2][0]` → heaviest 3RM
 * - `topLiftsByTypeAndReps["Back Squat"][4][17]` → 18th-best 5RM
 */
export function processTopLiftsByTypeAndReps(parsedData, liftTypes) {
  const startTime = performance.now();
  const topLiftsByTypeAndReps = {};
  const topLiftsByTypeAndRepsLast12Months = {};

  if (!parsedData || parsedData.length === 0) {
    return { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months };
  }

  const now = new Date();
  const last12Months = new Date(now.setFullYear(now.getFullYear() - 1));
  const last12MonthsStr = format(last12Months, "yyyy-MM-dd"); // Local date, not UTC

  // Precreate the data structures for each lift type
  liftTypes.forEach((type) => {
    topLiftsByTypeAndReps[type.liftType] = Array.from({ length: 10 }, () => []);
    topLiftsByTypeAndRepsLast12Months[type.liftType] = Array.from(
      { length: 10 },
      () => [],
    );
  });

  // Check the date range using the first and last entries
  // FIXME: code fails if .date is not there
  if (!parsedData[0]?.date || !parsedData[parsedData.length - 1]?.date) {
    return { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months };
  }
  const firstYear = new Date(parsedData[0].date).getFullYear();
  const lastYear = new Date(
    parsedData[parsedData.length - 1].date,
  ).getFullYear();
  const yearRange = lastYear - firstYear;

  // Calculate the maximum number of entries to keep
  const maxEntries = yearRange <= 2 ? 5 : 20;

  parsedData.forEach((entry) => {
    const { liftType, reps, date } = entry;

    if (entry.isGoal) return; // Dreams do not count

    // Ensure that the reps value is within the expected range
    if (reps < 1 || reps > 10) {
      return;
    }

    topLiftsByTypeAndReps[liftType][reps - 1].push(entry);

    // Collect best lifts of the last 12 months
    if (date >= last12MonthsStr) {
      topLiftsByTypeAndRepsLast12Months[liftType][reps - 1].push(entry);
    }
  });

  // Function to sort and trim arrays
  // When weights are equal, earlier dates rank better (later warmups get trimmed)
  const sortAndTrimArrays = (dataStructure, maxEntries) => {
    Object.keys(dataStructure).forEach((liftType) => {
      dataStructure[liftType].forEach((repArray) => {
        repArray.sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          return new Date(a.date) - new Date(b.date); // earlier date wins
        });
        if (repArray.length > maxEntries) {
          repArray.length = maxEntries;
        }
      });
    });
  };

  sortAndTrimArrays(topLiftsByTypeAndReps, maxEntries);
  sortAndTrimArrays(topLiftsByTypeAndRepsLast12Months, maxEntries);

  devLog(
    `processTopLiftsByTypeAndReps() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months };
}

/**
 * Precompute top tonnage sessions per lift type (all-time and last 12 months).
 *
 * @param {Array} parsedData - Chronologically sorted lift entries from parseData
 * @param {Array} liftTypes - List of { liftType } from calculateLiftTypes
 * @returns {{ topTonnageByType: Object, topTonnageByTypeLast12Months: Object }}
 *
 * **topTonnageByType / topTonnageByTypeLast12Months format:**
 * - Top-level keys: lift type strings (e.g. `"Back Squat"`, `"Deadlift"`)
 * - Value per lift type: array of up to 20 session records, sorted by tonnage descending
 * - Each record: `{ date: string, tonnage: number, unitType: string }`
 * - Tonnage = sum of (weight × reps) for that lift type on that date
 * - Records are per (date, liftType, unitType); mixed-unit sessions appear as separate entries
 */
export function processTopTonnageByType(parsedData, liftTypes) {
  const startTime = performance.now();
  const topTonnageByType = {};
  const topTonnageByTypeLast12Months = {};

  if (!parsedData || parsedData.length === 0) {
    return { topTonnageByType, topTonnageByTypeLast12Months };
  }

  const now = new Date();
  const last12Months = new Date(now);
  last12Months.setFullYear(now.getFullYear() - 1);
  const last12MonthsStr = format(last12Months, "yyyy-MM-dd"); // Local date, not UTC

  liftTypes.forEach((t) => {
    topTonnageByType[t.liftType] = [];
    topTonnageByTypeLast12Months[t.liftType] = [];
  });

  // Aggregate tonnage per (date, liftType, unitType) in one pass
  const byDateLiftUnit = {};
  parsedData.forEach((entry) => {
    if (entry.isGoal) return;
    const { date, liftType, weight, reps, unitType } = entry;
    if (!date || !liftType) return;
    const tonnage = (weight ?? 0) * (reps ?? 0);
    const u = unitType || "lb";
    const key = `${date}|${liftType}|${u}`;
    byDateLiftUnit[key] = (byDateLiftUnit[key] ?? 0) + tonnage;
  });

  // Build top records per lift type
  const byLiftAll = {};
  const byLift12 = {};
  Object.entries(byDateLiftUnit).forEach(([key, tonnage]) => {
    const [date, liftType, unitType] = key.split("|");
    if (!topTonnageByType[liftType]) return;
    byLiftAll[liftType] = byLiftAll[liftType] || [];
    byLiftAll[liftType].push({ date, tonnage, unitType });
    if (date >= last12MonthsStr) {
      byLift12[liftType] = byLift12[liftType] || [];
      byLift12[liftType].push({ date, tonnage, unitType });
    }
  });

  Object.keys(topTonnageByType).forEach((liftType) => {
    const all = byLiftAll[liftType] || [];
    all.sort((a, b) => b.tonnage - a.tonnage);
    topTonnageByType[liftType] = all.slice(0, 20);
    const last12 = byLift12[liftType] || [];
    last12.sort((a, b) => b.tonnage - a.tonnage);
    topTonnageByTypeLast12Months[liftType] = last12.slice(0, 20);
  });

  devLog(
    `processTopTonnageByType() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return { topTonnageByType, topTonnageByTypeLast12Months };
}

// Precompute session tonnage for O(1) lookups. Single pass over parsedData.
// Enables fast getAverageLiftSessionTonnage and getAverageSessionTonnage without rescanning.
// Also includes lastDateByLiftType for neglected-lift detection.
export function processSessionTonnageLookup(parsedData) {
  const startTime = performance.now();
  const sessionTonnageByDateAndLift = {};
  const sessionTonnageByDate = {};
  const allSessionDatesSet = new Set();
  const lastDateByLiftType = {};

  if (!parsedData || parsedData.length === 0) {
    return {
      sessionTonnageByDateAndLift,
      sessionTonnageByDate,
      allSessionDates: [],
      lastDateByLiftType,
    };
  }

  parsedData.forEach((entry) => {
    if (entry.isGoal) return;
    const { date, liftType, weight, reps, unitType } = entry;
    if (!date) return;
    const tonnage = (weight ?? 0) * (reps ?? 0);
    const u = unitType || "lb";

    allSessionDatesSet.add(date);

    if (!sessionTonnageByDate[date]) sessionTonnageByDate[date] = {};
    sessionTonnageByDate[date][u] = (sessionTonnageByDate[date][u] ?? 0) + tonnage;

    if (!sessionTonnageByDateAndLift[date]) sessionTonnageByDateAndLift[date] = {};
    if (!sessionTonnageByDateAndLift[date][liftType])
      sessionTonnageByDateAndLift[date][liftType] = {};
    sessionTonnageByDateAndLift[date][liftType][u] =
      (sessionTonnageByDateAndLift[date][liftType][u] ?? 0) + tonnage;

    lastDateByLiftType[liftType] = date;
  });

  const allSessionDates = Array.from(allSessionDatesSet).sort();

  devLog(
    `processSessionTonnageLookup() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return {
    sessionTonnageByDateAndLift,
    sessionTonnageByDate,
    allSessionDates,
    lastDateByLiftType,
  };
}

// Fast average lift session tonnage using precomputed lookup (avoids full parsedData scans).
// When unitType is undefined, sums tonnage across all unit types (matches original behavior).
export function getAverageLiftSessionTonnageFromPrecomputed(
  sessionTonnageByDateAndLift,
  allSessionDates,
  endDate,
  liftType,
  unitType,
) {
  if (!endDate || !liftType || !allSessionDates?.length) {
    return { average: 0, sessionCount: 0 };
  }

  const end = toUTCDate(endDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);

  let totalTonnage = 0;
  let countedSessions = 0;

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    const d = toUTCDate(dateStr);
    if (d < start || d > end) continue;
    const liftData = sessionTonnageByDateAndLift[dateStr]?.[liftType];
    if (!liftData) continue;
    const tonnage = unitType
      ? (liftData[unitType] ?? 0)
      : Object.values(liftData).reduce((s, v) => s + (v ?? 0), 0);
    if (tonnage > 0) {
      totalTonnage += tonnage;
      countedSessions += 1;
    }
  }

  return {
    average: countedSessions > 0 ? totalTonnage / countedSessions : 0,
    sessionCount: countedSessions,
  };
}

// Fast average session tonnage (all lifts) using precomputed lookup.
export function getAverageSessionTonnageFromPrecomputed(
  sessionTonnageByDate,
  allSessionDates,
  endDate,
  unitType,
) {
  if (!endDate || !allSessionDates?.length) {
    return { average: 0, sessionCount: 0 };
  }

  const end = toUTCDate(endDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);

  const u = unitType || "lb";
  let totalTonnage = 0;
  let countedSessions = 0;

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    const d = toUTCDate(dateStr);
    if (d < start || d > end) continue;
    const tonnage = sessionTonnageByDate[dateStr]?.[u] ?? 0;
    if (tonnage > 0) {
      totalTonnage += tonnage;
      countedSessions += 1;
    }
  }

  return {
    average: countedSessions > 0 ? totalTonnage / countedSessions : 0,
    sessionCount: countedSessions,
  };
}

// Min/max session tonnage over the rolling last 365 days (same window as average).
export function getSessionTonnageMinMaxFromPrecomputed(
  sessionTonnageByDate,
  allSessionDates,
  endDate,
  unitType,
) {
  if (!endDate || !allSessionDates?.length) {
    return { min: 0, max: 0, sessionCount: 0 };
  }

  const end = toUTCDate(endDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);

  const u = unitType || "lb";
  let minTonnage = Infinity;
  let maxTonnage = -Infinity;
  let countedSessions = 0;

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    const d = toUTCDate(dateStr);
    if (d < start || d > end) continue;
    const tonnage = sessionTonnageByDate[dateStr]?.[u] ?? 0;
    if (tonnage > 0) {
      minTonnage = Math.min(minTonnage, tonnage);
      maxTonnage = Math.max(maxTonnage, tonnage);
      countedSessions += 1;
    }
  }

  return {
    min: countedSessions > 0 ? minTonnage : 0,
    max: countedSessions > 0 ? maxTonnage : 0,
    sessionCount: countedSessions,
  };
}

// Percentile-based range (excludes outliers, especially on low end).
// Returns 25th and 90th percentile as low/high for a more meaningful "typical" range.
export function getSessionTonnagePercentileRangeFromPrecomputed(
  sessionTonnageByDate,
  allSessionDates,
  endDate,
  unitType,
) {
  if (!endDate || !allSessionDates?.length) {
    return { low: 0, high: 0, sessionCount: 0 };
  }

  const end = toUTCDate(endDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);

  const u = unitType || "lb";
  const values = [];

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    const d = toUTCDate(dateStr);
    if (d < start || d > end) continue;
    const tonnage = sessionTonnageByDate[dateStr]?.[u] ?? 0;
    if (tonnage > 0) values.push(tonnage);
  }

  if (values.length === 0) {
    return { low: 0, high: 0, sessionCount: 0 };
  }

  values.sort((a, b) => a - b);
  const n = values.length;
  // Nearest-rank: pth percentile index = ceil(p/100 * n) - 1
  const lowIdx = Math.max(0, Math.ceil(0.25 * n) - 1);  // 25th - trims low outliers
  const highIdx = Math.min(n - 1, Math.ceil(0.9 * n) - 1); // 90th - trims high outliers

  return {
    low: values[lowIdx],
    high: values[highIdx],
    sessionCount: n,
  };
}

// liftTypes is an array sorted by lift set frequency descending of these objects:
// {
// "liftType": "Back Squat",
// "totalSets": 78,
// "totalReps": 402,
// "newestDate": "2023-12-11",
// "oldestDate": "2023-11-18"
// }
//
// FIXME: should liftTypes just be big object like topLiftsBySetsandReps? Merge into topLiftsBySetsAndReps?
// So far it is only 3ms on slow PC with my biggest dataset.
//
export function calculateLiftTypes(parsedData) {
  const startTime = performance.now();

  devLog(`calculateLiftTypes length: ${parsedData.length}`);
  const liftTypeStats = {};
  parsedData.forEach((lift) => {
    if (lift.isGoal) return; // Don't include goals here

    const liftType = lift.liftType;
    if (!liftTypeStats[liftType]) {
      liftTypeStats[liftType] = {
        totalSets: 0,
        totalReps: 0,
        newestDate: lift.date, // Initialize with the first encountered date
        oldestDate: lift.date, // Since parsedData is sorted by date
      };
    } else {
      // Since parsedData is sorted, the last date encountered is the newest
      liftTypeStats[liftType].newestDate = lift.date;
    }
    liftTypeStats[liftType].totalSets += 1;
    liftTypeStats[liftType].totalReps += lift.reps;
  });

  const sortedLiftTypes = Object.keys(liftTypeStats)
    .map((liftType) => ({
      liftType: liftType,
      totalSets: liftTypeStats[liftType].totalSets,
      totalReps: liftTypeStats[liftType].totalReps,
      newestDate: liftTypeStats[liftType].newestDate,
      oldestDate: liftTypeStats[liftType].oldestDate,
    }))
    .sort((a, b) => b.totalSets - a.totalSets);

  devLog(
    `calculateLiftTypes() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedLiftTypes;
}

// This is run once when data is imported
// Assumes parsedData is sorted chronologically.
export const markHigherWeightAsHistoricalPRs = (parsedData) => {
  const startTime = performance.now();
  const bestRecordsMap = {};

  // Directly modify the objects for performance
  parsedData.forEach((record) => {
    if (record.reps === 0) return; // Ignore fail records
    if (record.isGoal) return; // Don't include goals here

    const key = `${record.liftType}-${record.reps}`;

    if (!bestRecordsMap[key] || record.weight > bestRecordsMap[key].weight) {
      bestRecordsMap[key] = record;
      record.isHistoricalPR = true; // Directly set the property
    } else {
      record.isHistoricalPR = false; // Directly set the property
    }
  });

  // No need to re-sort if parsedData is already sorted by date

  devLog(
    `markPRs() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return parsedData;
};

export function findLiftPositionInTopLifts(liftTuple, topLiftsByTypeAndReps) {
  const { liftType, reps } = liftTuple;

  // Check if the lift type and rep range exists in the data structure
  if (
    topLiftsByTypeAndReps[liftType] &&
    topLiftsByTypeAndReps[liftType][reps - 1]
  ) {
    const topLifts = topLiftsByTypeAndReps[liftType][reps - 1];

    for (let i = 0; i < topLifts.length; i++) {
      let lift = topLifts[i];
      // Assuming we compare based on weight, adjust the condition as needed
      if (
        lift.date === liftTuple.date &&
        lift.weight === liftTuple.weight &&
        lift.reps === liftTuple.reps &&
        lift.notes === liftTuple.notes &&
        lift.URL === liftTuple.URL
      ) {
        // FIXME: this annotation stuff could simply just go in JSX
        const prSentenceReport = `${getCelebrationEmoji(i)}  #${i + 1} best ${
          lift.reps
        }RM`;

        return { rank: i, annotation: prSentenceReport }; // Return the position (index) of the lift in the array
      }
    }
  }

  return { rank: -1, annotation: null }; // Return -1 if the lift is not found
}

// Analyzes lifts for a specific session date, providing context about their significance.
// Returns an array of their session data grouped by lift type
// FIXME: consider making this a method provided by the userUserLiftingData hook
export function getAnalyzedSessionLifts(
  date,
  parsedData,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
) {
  // Grab all the lifts on this date (that are not goals)
  const sessionLifts = parsedData?.filter(
    (lift) => lift.date === date && lift.isGoal !== true,
  );

  const analyzedLifts = sessionLifts?.reduce((acc, entry) => {
    const { liftType } = entry;
    acc[liftType] = acc[liftType] || [];

    const {
      rank: lifetimeRanking,
      annotation: lifetimeSignificanceAnnotation,
    } = findLiftPositionInTopLifts(entry, topLiftsByTypeAndReps);

    let { rank: yearlyRanking, annotation: yearlySignificanceAnnotation } =
      findLiftPositionInTopLifts(entry, topLiftsByTypeAndRepsLast12Months);

    // If the yearly ranking is not better than an existing lifetime ranking, don't show it
    if (lifetimeRanking !== -1 && yearlyRanking >= lifetimeRanking) {
      yearlyRanking = null;
      yearlySignificanceAnnotation = null;
    }

    acc[liftType].push({
      ...entry,
      lifetimeRanking,
      lifetimeSignificanceAnnotation,
      yearlyRanking,
      yearlySignificanceAnnotation,
    });

    return acc;
  }, {});

  return analyzedLifts;
}

// Find the best e1RM across all rep schemes inside topLiftsByTypeAndReps
export function findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula) {
  const topLifts = topLiftsByTypeAndReps[liftType];
  let bestE1RMWeight = 0;
  let bestLift = null;
  let unitType = "lb"; // Default to lb if not specified

  // Return early if liftType doesn't exist in the data structure
  if (!topLifts) {
    return { bestLift, bestE1RMWeight, unitType };
  }

  for (let reps = 0; reps < 10; reps++) {
    if (topLifts[reps]?.[0]) {
      const lift = topLifts[reps][0];
      const currentE1RMweight = estimateE1RM(
        reps + 1,
        lift.weight,
        e1rmFormula,
      );
      if (currentE1RMweight > bestE1RMWeight) {
        bestE1RMWeight = currentE1RMweight;
        bestLift = lift;
      }
      if (lift.unitType) unitType = lift.unitType;
    }
  }

  // Return the best lift entire tuple, as well as the numerical best e1RM weight and unit type
  return { bestLift, bestE1RMWeight, unitType };
}
