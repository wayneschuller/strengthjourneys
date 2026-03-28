/**
 * Shared consistency analysis used across dashboard and AI features.
 * Keep the logic UI-free so dormant card components do not own active data processing.
 */
import { format, parseISO, subDays, differenceInCalendarDays } from "date-fns";
import { CONSISTENCY_GRADE_THRESHOLDS } from "@/lib/consistency-grades";

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return format(subDays(date, days), "yyyy-MM-dd");
}

const BASE_PERIOD_TARGETS = [
  { label: "Week", days: 8 },
  { label: "Month", days: 30 },
  { label: "3 Month", days: 90 },
  { label: "Half Year", days: 180 },
  { label: "Year", days: 345 },
  { label: "24 Month", days: 350 * 2 },
  { label: "5 Year", days: 350 * 5 },
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
    const period = { label: `${years} Year`, days: 350 * years };
    relevantPeriods.push(period);

    if (period.days > workoutRangeDays) {
      break;
    }
  }

  return relevantPeriods;
}

function calculateGradeJump(actualWorkouts, totalWorkoutsExpected) {
  if (totalWorkoutsExpected <= 0) return 0;

  const currentProgress = (actualWorkouts / totalWorkoutsExpected) * 100;
  const nextThreshold = CONSISTENCY_GRADE_THRESHOLDS.find(
    (threshold) => threshold.minProgress > currentProgress,
  );

  if (!nextThreshold) return 0;

  const minWorkoutsForNextGrade = Math.ceil(
    (nextThreshold.minProgress * totalWorkoutsExpected) / 100,
  );
  return Math.max(0, minWorkoutsForNextGrade - actualWorkouts);
}

/**
 * Summarize training frequency into consistency bands for progressively larger periods.
 *
 * @param {Array|null} parsedData
 * @returns {Array|null}
 */
export function processConsistency(parsedData) {
  if (!parsedData || parsedData.length === 0) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const workoutRangeDays = differenceInCalendarDays(
    parseISO(today),
    parseISO(parsedData[0].date),
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

  for (let i = parsedData.length - 1; i >= 0; i -= 1) {
    const entryDate = parsedData[i].date;
    if (parsedData[i].isGoal) continue;

    for (let j = periodStartDates.length - 1; j >= 0; j -= 1) {
      if (entryDate < periodStartDates[j].startDate) break;
      periodDates[periodStartDates[j].label].add(entryDate);
    }
  }

  return relevantPeriods.map((period) => {
    const actualWorkouts = periodDates[period.label].size;
    const totalWorkoutsExpected = Math.round((period.days / 7) * 3);
    const rawPercentage = (actualWorkouts / totalWorkoutsExpected) * 100;
    const consistencyPercentage = Math.min(Math.round(rawPercentage), 100);

    let graceDayWarning = false;
    if (period.label === "Week" && actualWorkouts >= totalWorkoutsExpected) {
      const strictStartDate = subtractDays(today, 6);
      let strictCount = 0;
      for (const date of periodDates[period.label]) {
        if (date >= strictStartDate) strictCount += 1;
      }
      graceDayWarning = strictCount < totalWorkoutsExpected;
    }

    let tooltip = "";
    if (graceDayWarning) {
      tooltip = `${actualWorkouts} sessions this week — lift today to maintain your grade`;
    } else if (actualWorkouts > totalWorkoutsExpected) {
      tooltip = `Achieved ${
        actualWorkouts - totalWorkoutsExpected
      } more than the minimum # of sessions required for 3 per week average`;
    } else if (actualWorkouts === totalWorkoutsExpected) {
      tooltip = "Achieved exactly the required # of sessions for 3 per week average. You can stop lifting now.";
    } else {
      tooltip = `Achieved ${actualWorkouts} sessions (get ${calculateGradeJump(
        actualWorkouts,
        totalWorkoutsExpected,
      )} more in this period to improve your grade)`;
    }

    return {
      label: period.label,
      percentage: consistencyPercentage,
      tooltip,
    };
  });
}
