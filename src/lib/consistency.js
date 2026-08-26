/**
 * Shared consistency analysis used across dashboard and AI features.
 * Keep the logic UI-free so dormant card components do not own active data processing.
 *
 * Every period grades the same thing: did you average three sessions a week across
 * the window? The window lengths below are true calendar lengths so a ring labelled
 * "Year" really does cover a year — the single exception is Week, which runs eight
 * days on purpose so one late session does not tank an otherwise solid week.
 */
import { format, parseISO, subDays, differenceInCalendarDays } from "date-fns";
import { CONSISTENCY_GRADE_THRESHOLDS } from "@/lib/consistency-grades";

const TARGET_SESSIONS_PER_WEEK = 3;
const DAYS_PER_YEAR = 365.25;

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return format(subDays(date, days), "yyyy-MM-dd");
}

function daysForYears(years) {
  return Math.round(years * DAYS_PER_YEAR);
}

const BASE_PERIOD_TARGETS = [
  { label: "Week", days: 8 }, // Seven days plus one grace day
  { label: "Month", days: 30 },
  { label: "3 Month", days: 91 }, // Exactly thirteen weeks
  { label: "Half Year", days: 182 }, // Exactly twenty-six weeks
  { label: "Year", days: 365 },
  { label: "24 Month", days: 730 },
  { label: "5 Year", days: daysForYears(5) },
];

function getRelevantPeriods(workoutRangeDays) {
  const relevantPeriods = [];

  for (let i = 0; i < BASE_PERIOD_TARGETS.length; i += 1) {
    relevantPeriods.push(BASE_PERIOD_TARGETS[i]);
    if (BASE_PERIOD_TARGETS[i].days > workoutRangeDays) {
      return relevantPeriods;
    }
  }

  for (let years = 10; years <= 100; years += 5) {
    const period = { label: `${years} Year`, days: daysForYears(years) };
    relevantPeriods.push(period);

    if (period.days > workoutRangeDays) {
      break;
    }
  }

  return relevantPeriods;
}

// Human phrasing for a period label, used by tooltips and detail panels so the UI
// never has to talk in raw day counts.
function getPeriodWindowLabel(label, days) {
  if (label === "Week" || label === "Month") return `Last ${days} days`;
  if (label === "Half Year") return "Last 6 months";
  if (label === "Year") return "Last 12 months";
  if (label === "24 Month") return "Last 2 years";

  const monthMatch = label.match(/^(\d+) Month$/);
  if (monthMatch) return `Last ${monthMatch[1]} months`;

  const yearMatch = label.match(/^(\d+) Year$/);
  if (yearMatch) return `Last ${yearMatch[1]} years`;

  return `Last ${days} days`;
}

function pluraliseSessions(count) {
  return count === 1 ? "session" : "sessions";
}

// Grades are A/B/C bands plus ".", so only the A band needs "an".
function indefiniteArticle(grade) {
  return grade.startsWith("A") ? "an" : "a";
}

// Sessions still needed to reach the next grade band, measured against the same
// rounded percentage the ring displays so the ring and its tooltip never disagree.
function calculateGradeJump(
  displayedPercentage,
  actualWorkouts,
  targetWorkouts,
) {
  if (targetWorkouts <= 0) return null;

  // CONSISTENCY_GRADE_THRESHOLDS is ordered highest-first, so a plain .find() for
  // "minProgress above where I am" always returned A+ and told a C- lifter to chase
  // a perfect score. Walk from the bottom instead to land on the very next band up.
  let nextThreshold = null;
  for (let i = CONSISTENCY_GRADE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (CONSISTENCY_GRADE_THRESHOLDS[i].minProgress > displayedPercentage) {
      nextThreshold = CONSISTENCY_GRADE_THRESHOLDS[i];
      break;
    }
  }
  if (!nextThreshold) return null;

  const minWorkoutsForNextGrade = Math.ceil(
    (nextThreshold.minProgress * targetWorkouts) / 100,
  );

  return {
    grade: nextThreshold.grade,
    sessionsNeeded: Math.max(1, minWorkoutsForNextGrade - actualWorkouts),
  };
}

/**
 * Summarize training frequency into consistency bands for progressively larger periods.
 *
 * Each returned entry carries the raw counts as well as the derived detail the UI
 * needs (weekly rate, next grade, how much of the window your logged history
 * actually covers) so presentation layers do not recompute any of it.
 *
 * @param {Array|null} parsedData
 * @returns {Array|null}
 */
export function processConsistency(parsedData) {
  if (!parsedData || parsedData.length === 0) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const firstTrainingDate = parsedData[0].date;
  const workoutRangeDays = differenceInCalendarDays(
    parseISO(today),
    parseISO(firstTrainingDate),
  );

  const relevantPeriods = getRelevantPeriods(workoutRangeDays);

  const periodStartDates = relevantPeriods.map((period) => ({
    label: period.label,
    startDate: subtractDays(today, period.days - 1),
  }));

  const periodDates = relevantPeriods.reduce((acc, period) => {
    acc[period.label] = new Set();
    return acc;
  }, {});

  const oldestStartDate =
    periodStartDates[periodStartDates.length - 1].startDate;

  for (let i = parsedData.length - 1; i >= 0; i -= 1) {
    const entryDate = parsedData[i].date;
    // Data is date-ascending, so the first entry older than the widest window
    // means every remaining entry is too old to count anywhere.
    if (entryDate < oldestStartDate) break;
    if (parsedData[i].isGoal) continue;

    for (let j = periodStartDates.length - 1; j >= 0; j -= 1) {
      if (entryDate < periodStartDates[j].startDate) break;
      periodDates[periodStartDates[j].label].add(entryDate);
    }
  }

  return relevantPeriods.map((period) => {
    const actualWorkouts = periodDates[period.label].size;
    const targetWorkouts = Math.round(
      (period.days / 7) * TARGET_SESSIONS_PER_WEEK,
    );
    const rawPercentage = (actualWorkouts / targetWorkouts) * 100;
    const consistencyPercentage = Math.min(Math.round(rawPercentage), 100);

    // The widest ring always reaches further back than the logged history, which
    // caps the grade it can possibly earn. Report the overlap so the UI can say so
    // rather than leaving the user wondering why their oldest ring looks weak.
    const trackedDays = Math.min(period.days, workoutRangeDays + 1);
    const isPartiallyTracked = trackedDays < period.days;

    let graceDayWarning = false;
    if (period.label === "Week" && actualWorkouts >= targetWorkouts) {
      const strictStartDate = subtractDays(today, 6);
      let strictCount = 0;
      for (const date of periodDates[period.label]) {
        if (date >= strictStartDate) strictCount += 1;
      }
      graceDayWarning = strictCount < targetWorkouts;
    }

    const nextGrade = calculateGradeJump(
      consistencyPercentage,
      actualWorkouts,
      targetWorkouts,
    );

    const surplusSessions = Math.max(0, actualWorkouts - targetWorkouts);

    let headline = "";
    if (graceDayWarning) {
      headline = "Riding the grace day — lift today to hold this grade";
    } else if (surplusSessions > 0) {
      headline = `${surplusSessions} ${pluraliseSessions(surplusSessions)} clear of the ${TARGET_SESSIONS_PER_WEEK}-per-week target`;
    } else if (actualWorkouts === targetWorkouts) {
      headline = `Exactly on the ${TARGET_SESSIONS_PER_WEEK}-per-week target`;
    } else if (nextGrade) {
      headline = `${nextGrade.sessionsNeeded} more ${pluraliseSessions(
        nextGrade.sessionsNeeded,
      )} for ${indefiniteArticle(nextGrade.grade)} ${nextGrade.grade}`;
    } else {
      headline = `${actualWorkouts} ${pluraliseSessions(actualWorkouts)} logged`;
    }

    return {
      label: period.label,
      windowLabel: getPeriodWindowLabel(period.label, period.days),
      periodDays: period.days,
      trackedDays,
      isPartiallyTracked,
      actualWorkouts,
      targetWorkouts,
      surplusSessions,
      percentage: consistencyPercentage,
      // Rate is measured over the tracked portion so the widest ring reports how
      // often you actually train, not how often you trained before you kept a log.
      // Floored at one week so a brand new log cannot report "7.0 per week".
      sessionsPerWeek: (
        actualWorkouts /
        (Math.max(trackedDays, 7) / 7)
      ).toFixed(1),
      targetSessionsPerWeek: TARGET_SESSIONS_PER_WEEK,
      nextGrade,
      graceDayWarning,
      headline,
    };
  });
}
