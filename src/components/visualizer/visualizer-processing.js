"use client";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";

export function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  showAllData = false,
) {
  if (!parsedData) return {};

  const startTime = performance.now();

  const dataMap = new Map();
  const recentLifts = {}; // Used for weekly bests data decimation
  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window

  let weightMax = 0;
  let weightMin = 1000;

  parsedData.forEach(({ date, liftType, reps, weight, isGoal, unitType }) => {
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

    // Data decimation - skip lower lifts if there was something bigger the last N day window
    // FIXME: this is slowing down the loop?
    const currentDate = new Date(date);
    if (!showAllData && recentLifts[liftType]) {
      const recentDate = new Date(recentLifts[liftType].date);
      const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

      // Check if we already have a much better lift in the data decimation window
      if (
        dayDiff <= decimationDaysWindow &&
        oneRepMax <= recentLifts[liftType].oneRepMax * 0.95
      ) {
        return; // Skip this entry
      }
    }

    if (!liftData[liftType] || oneRepMax > liftData[liftType]) {
      liftData[liftType] = oneRepMax;
      // const timeStamp = new Date(date).getTime(); // Convert to Unix timestamp for x-axis
      // liftData.x = timeStamp;
      liftData.unitType = unitType;
      liftData[`${liftType}_reps`] = reps;
      liftData[`${liftType}_weight`] = weight;
    }

    recentLifts[liftType] = { date: date, oneRepMax: oneRepMax }; // Store the full entry for best of week comparisons
  });

  const dataset = [];
  dataMap.forEach((lifts, date) => {
    dataset.push({ date, ...lifts });
  });

  devLog(
    "processVisualizerData execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  devLog(`${dataset.length} points of chart data`);
  return { dataset, weightMax, weightMin };
}
