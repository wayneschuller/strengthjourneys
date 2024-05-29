"use client";
import { getLiftColor } from "@/lib/get-lift-color";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";
import { brightenHexColor } from "@/lib/get-lift-color";

// This function uniquely processes the parsed data for the Visualizer
export function processVisualizerData(
  parsedData,
  selectedLiftTypes,
  e1rmFormula,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window

  const startTime = performance.now();

  const datasets = {}; // We build chart.js datasets with the lift type as the object key
  const recentLifts = {}; // To track the most recent lift entry for each type

  parsedData.forEach((entry) => {
    const liftTypeKey = entry.liftType;

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftTypeKey)) {
      return;
    }

    // Skip if it is a goal/target entry
    if (entry.isGoal) return;

    // Lazy initialization of dataset for the lift type
    if (!datasets[liftTypeKey]) {
      const color = getLiftColor(liftTypeKey);
      const brightColor = brightenHexColor(color, 1.1);

      datasets[liftTypeKey] = {
        label: liftTypeKey,
        data: new Map(), // Using Map for efficient lookups
        backgroundColor: color,
        borderColor: brightColor,
        borderWidth: 1,
        pointStyle: (context) =>
          context.raw.isHistoricalPR ? "circle" : "cross",
        radius: (context) => (context.raw.isHistoricalPR ? 3 : 3),
        hitRadius: 15,
        hoverRadius: 8,
        cubicInterpolationMode: "monotone",
      };

      recentLifts[liftTypeKey] = null;
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    const currentDate = new Date(entry.date);

    // Check if the current date already has a better E1RM
    if (datasets[liftTypeKey].data.has(entry.date)) {
      const currentData = datasets[liftTypeKey].data.get(entry.date);
      if (currentData.y >= oneRepMax) {
        return; // Skip update if the existing E1RM is greater or equal
      }
    }

    // Data decimation - skip lower lifts if there was something bigger the last N day window
    if (recentLifts[liftTypeKey]) {
      const recentDate = new Date(recentLifts[liftTypeKey].date);
      const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

      // Check if we already have a much better lift in the data decimation window
      if (
        dayDiff <= decimationDaysWindow &&
        oneRepMax <= recentLifts[liftTypeKey].oneRepMax * 0.95
      ) {
        return; // Skip this entry
      }
    }

    // Prepare the full entry data
    const fullEntry = {
      ...entry, // Spread the original entry to include all properties
      x: entry.date, // Chart.js specific x-value
      y: oneRepMax, // Chart.js specific y-value
      oneRepMax, // Include oneRepMax explicitly for easy access
    };

    // Update the dataset and the tracking structure
    datasets[liftTypeKey].data.set(entry.date, fullEntry);
    recentLifts[liftTypeKey] = fullEntry; // Store the full entry for future comparisons
  });

  // Generate goal datasets
  const goalDatasets = createGoalDatasets(
    parsedData,
    datasets,
    e1rmFormula,
    selectedLiftTypes,
  );

  // Merge regular and goal datasets
  const sortedDatasets = Object.values(datasets)
    .concat(Object.values(goalDatasets))
    .map((dataset) => ({
      ...dataset,
      data: Array.from(dataset.data.values()),
    }));

  devLog(
    "processVisualizerData execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}

// Create dashed lines for goal points set by the google sheet isGoal column
// We do a second pass of the data here. It could be included in the main parse loop
// but it is fairly quick.
export function createGoalDatasets(
  parsedData,
  datasets,
  e1rmFormula,
  selectedLiftTypes,
) {
  const goalDatasets = {};

  parsedData.forEach((entry) => {
    if (!entry.isGoal) return; // Skip non-goal entries

    const liftTypeKey = entry.liftType;

    // Skip if the lift type is not in the selected list
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftTypeKey)) {
      return;
    }

    if (!goalDatasets[liftTypeKey]) {
      const color = getLiftColor(liftTypeKey);
      const brightColor = brightenHexColor(color, 1.1);

      goalDatasets[liftTypeKey] = {
        label: `${liftTypeKey} Goal`,
        data: new Map(),
        borderColor: brightColor,
        borderDash: [5, 5], // Nice dashed line
        borderWidth: 1,
        pointRadius: 5,
        fill: false,
      };
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    goalDatasets[liftTypeKey].data.set(entry.date, {
      x: entry.date,
      y: oneRepMax,
      ...entry,
    });
  });

  return goalDatasets;
}
