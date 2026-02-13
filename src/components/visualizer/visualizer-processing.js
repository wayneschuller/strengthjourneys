"use client";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog, logTiming } from "@/lib/processing-utils";

export function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  showAllData = false,
) {
  if (!parsedData) return {};

  const startTime = performance.now();

  const dataMap = new Map(); // A per date mapping of the best lift per lifttype on that date
  const recentLifts = {}; // Used for weekly bests data decimation
  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window
  let mostRecentDate = parsedData[parsedData.length - 1].date; // The most recent session date (assumes parsedData chronologically sorted)

  let weightMax = 0;
  let weightMin = 1000;

  parsedData.forEach(
    ({ date, liftType, reps, weight, isGoal, unitType, label }) => {
      if (date < timeRange) return; // Skip if date out of range of chart
      if (isGoal) return; // FIXME: implement goal dashed lines at some point

      // Skip if the lift type is not selected
      if (selectedLiftTypes && !selectedLiftTypes.includes(liftType)) {
        return;
      }

      const oneRepMax = estimateE1RM(reps, weight, e1rmFormula);

      if (!dataMap.has(date)) {
        dataMap.set(date, {});
      }
      const liftData = dataMap.get(date);

      if (weightMax < oneRepMax) weightMax = oneRepMax;
      if (weight < weightMin) weightMin = weight;

      // Data decimation - skip lower lifts if there was something much bigger the last N day window
      // Don't decimate the most recent session because it's confusing to the user
      if (!showAllData && date !== mostRecentDate && recentLifts[liftType]) {
        const recentDate = new Date(recentLifts[liftType].date);
        const currentDate = new Date(date);
        const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

        // Check if we already have a much better lift in the data decimation window
        if (
          dayDiff <= decimationDaysWindow &&
          oneRepMax <= recentLifts[liftType].oneRepMax * 0.95
        ) {
          return; // Skip this entry
        }
      }

      // Check if this is the best lift oneRepMax for this date and if so store it
      if (!liftData[liftType] || oneRepMax > liftData[liftType]) {
        liftData[liftType] = oneRepMax;
        liftData.unitType = unitType;
        liftData[`${liftType}_reps`] = reps;
        liftData[`${liftType}_weight`] = weight;
        if (label) {
          liftData.label = label;
          devLog(`Special user label inserted: ${label} (date: ${date})`);
        }
      }

      recentLifts[liftType] = { date: date, oneRepMax: oneRepMax }; // Remember this for best of week comparisons
    },
  );

  // Convert to recharts date oriented array of data tuples
  const dataset = [];
  dataMap.forEach((lifts, date) => {
    dataset.push({
      date,
      ...lifts,
      rechartsDate: Date.UTC(
        new Date(date).getFullYear(),
        new Date(date).getMonth(),
        new Date(date).getDate(),
      ),
    });
  });
  // devLog(`${dataset.length} points of chart data`);

  logTiming("processVisualizerData", performance.now() - startTime);

  return { dataset, weightMax, weightMin };
}

// Calculate January 1 of each year for label placement
export const getYearLabels = (data) => {
  if (!data || data.length === 0) return []; // Handle null or empty data
  const years = [];
  const startYear = new Date(data[0].date).getFullYear();
  const endYear = new Date(data[data.length - 1].date).getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(`${year}-01-01`).getTime();
    years.push({ date: yearStart, label: year });
  }
  return years;
};
