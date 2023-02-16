/** @format */

// processVisualizerData.js
// Utility functions for collecting stats for doughnut/pie chart in the <Visualizer />
// Most of the main E1RM processing happens in processData.js
//
// However we have some utility functions to get annotation data here.
//
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

import { estimateE1RM } from "./estimateE1RM";
import { wasLiftSelected } from "./processData";

// When refreshing, we want to simply update the y position of the annotations based on a new equation
// We can reuse the PR data stored in processedData for each lift
export function updateAchievements(processedData, equation, achievementAnnotations) {
  // console.log(`updateAnnotations(). Mutating Y values on existing annotations`);

  // FIXME: these changes are not applying to the chart when the equation changes
  // FIXME: We do not need to handle 1RM because it's level will not change. :)
  // FIXME: We should be looping through the achievementAnnotations, then for the 3RM and 5RM
  // we can look up the liftType and date in processedData and get the y value from there

  // Loop through each lift and recalculate the e1rm for the achievement label
  processedData.forEach((liftType, index) => {
    let reps;
    let weight;

    if (liftType["1RM"]) {
      reps = liftType["1RM"]["reps"];
      weight = liftType["1RM"]["weight"];
      if (reps && weight)
        achievementAnnotations[`${liftType.label}_best_1RM`].yValue = estimateE1RM(reps, weight, equation);
    }

    if (liftType["3RM"]) {
      reps = liftType["3RM"]["reps"];
      weight = liftType["3RM"]["weight"];
      if (reps && weight)
        achievementAnnotations[`${liftType.label}_best_3RM`].yValue = estimateE1RM(reps, weight, equation);
    }

    if (liftType["5RM"]) {
      reps = liftType["5RM"]["reps"];
      weight = liftType["5RM"]["weight"];
      if (reps && weight)
        achievementAnnotations[`${liftType.label}_best_5RM`].yValue = estimateE1RM(reps, weight, equation);
    }
  });
}

// Find interesting achievements for this dataset
export function processAchievements(parsedData, processedData, equation) {
  // We are creating a first time set of annotations
  let liftAnnotations = {};

  // For each lift find achievements
  processedData.forEach((liftType, index) => {
    // Clear old afterLabels with achievements so we can recreate them

    liftType.data.forEach((lift) => {
      lift.afterLabel.splice(0, lift.afterLabel.length); // empty the array
      if (lift.notes) lift.afterLabel.push(lift.notes);
      // Put any notes back in first
      else lift.afterLabel = [];
    });

    // We go 'backwards' and look at the original parsed data for just this lift type
    const lifts = parsedData.filter((lift) => lift.name === liftType.label);

    findPRs(lifts, 1, "single", index, processedData, liftAnnotations, equation);

    findPRs(lifts, 3, "triple", index, processedData, liftAnnotations, equation);

    findPRs(lifts, 5, "five", index, processedData, liftAnnotations, equation);
  });

  return liftAnnotations;
}

// Helper function to find top 20 singles, threes and fives for each main lift
function findPRs(rawLifts, reps, prName, datasetIndex, processedData, liftAnnotations, equation) {
  const liftType = processedData[datasetIndex].label;

  // console.log(`Finding ${reps}-rep PRs for ${processedData[datasetIndex].label}`);

  // console.log(rawLifts);

  // Filter for this rep style
  let repLifts = rawLifts.filter((lift) => lift.reps === reps);

  // console.log(repLifts);

  // Sort by weight. (award any ties to the earlier lift)
  repLifts.sort((a, b) => {
    if (a.weight === b.weight) {
      // Same weight tie goes to the earlier lift
      return new Date(a.date) - new Date(b.date);
    }

    // Different weights - bigger is better
    return b.weight - a.weight;
  });

  let topHighlights = 20;
  if (repLifts.length < 50) topHighlights = 5; // Novices only get top 5 highlights on visualiser tooltips

  // Process the top highlights of this rep style (if we have that many)
  for (let i = 0; i < topHighlights && i < repLifts.length; i++) {
    if (repLifts[i] === undefined) break; // We ran out of lifts

    // Match the lift to the chart line point.
    const dateIndex = processedData[datasetIndex].data.findIndex((lift) => lift.x === repLifts[i].date);
    processedData[datasetIndex].data[dateIndex].afterLabel.push(
      `#${i + 1} best ${liftType} ${prName} of all time (${reps}@${repLifts[i].weight}${repLifts[i].unitType})`
    );

    // FIXME: Consider using a Javascript Map instead of the liftAnnotations object structure

    // Create some visual annotations for the top lift for this rep scheme
    // The visual annotations are only worthwhile when they have completed
    // more than 10 lifts of this rep and liftType combination.
    if (i === 0 && repLifts.length > 10) {
      // Actual top PR gets a special chartjs annotation marker on the chart
      liftAnnotations[`${liftType}_best_${reps}RM`] = createAchievementAnnotation(
        liftType,
        repLifts[i].date,
        processedData[datasetIndex].data[dateIndex].y, // Put annotation at the line point for this date
        // estimateE1RM(reps, repLifts[i].weight, equation), // FIXME: should this be at the e1rm line height?
        `${reps}RM`,
        "rgba(255, 99, 132, 0.25)",
        datasetIndex
      );
    }
  }
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(liftType, date, yValue, text, background, datasetIndex) {
  const display = wasLiftSelected(liftType);

  return {
    type: "label",
    borderColor: (context) => {
      return context.chart.data.datasets[datasetIndex].backgroundColor;
    },
    borderRadius: 3,
    borderWidth: 2,
    yAdjust: 20,
    content: [text],
    xValue: date,
    yValue: yValue,
    backgroundColor: background,
    padding: {
      top: 2,
      left: 2,
      right: 2,
      bottom: 1,
    },
    display: display, // default to display

    // Below display handler works but is quite slow. So now we show/hide in our legend click handler
    //  display: (context, options) => {
    // let meta = context.chart.getDatasetMeta(datasetIndex);
    // return(meta.visible);
    // },
  };
}
