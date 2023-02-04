/** @format */
// processData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

import { estimateE1RM } from "./estimateE1RM";
import { getLiftColor } from "./getLiftColor";
import { processAchievements, updateAchievements } from "./processVisualizerData";
import { processAnalyzerPieData, processAnalyzerPRCardData } from "./processAnalyzerData";

// --------------------------------------------------------------------------------------------
// processData()
//
// Process the parsedData array of lifts into data structures ready for the <Visualiser /> and <Analyzer />
//
// --------------------------------------------------------------------------------------------
export function processData(parsedData, setVisualizerData, setAnalyzerData) {
  console.log("processData()...");

  let visualizerE1RMLineData = [];

  let equation = localStorage.getItem("equation");
  if (!equation) equation = "Brzycki"; // Probably not needed. Just in case.

  processEstimateData(parsedData, visualizerE1RMLineData, equation);

  console.log(
    `   ...processVisualiserData() complete: ${visualizerE1RMLineData.length} different types of lifts. (${equation} equation)`
  );

  /*  FIXME: NOT NEEDED CURRENTLY - PARKED FOR REFERENCE
  // Remove any left over stale items (needed for refreshing data from Google Sheets)
  visualizerE1RMLineData.forEach((liftType) => {
    // Loop backwards through e1rmLineData mutating it to remove stale entries
    for (let i = liftType.data.length - 1; i >= 0; i--) {
      if (liftType.data[i].isUpdated === false) {
        // console.log(`Found stale ${liftType.name} graph entry #${i} is ${JSON.stringify(liftType.data[i])}`);
        liftType.data.splice(i, 1);
      }
    }
  });
  */

  // Every element of processedData now has a data array of chart tuples
  // Let's sort each data array by date (x entry) so it draws lines correctly
  // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
  // FIXME: if we presort parsedData, then .data will already be sorted?
  visualizerE1RMLineData.forEach((arr) => arr.data.sort((a, b) => new Date(a.x) - new Date(b.x)));

  // Also sort our processedData so the most popular lift types get charts first
  visualizerE1RMLineData.sort((a, b) => b.data.length - a.data.length);

  // If we have many lift types (> 15) then intelligently ignore uninteresting data.
  // We remove any lift types if:
  // 1) we have not performed that lift type in the last 2 years
  // AND
  // 2) we only did that lift type less than 10 times.
  //
  // Advice to user: Keep lifting or do lots of a lift type to keep it visualized
  if (visualizerE1RMLineData.length > 15) {
    const twoYearsInMilliseconds = 2 * 365 * 24 * 60 * 60 * 1000;
    const currentTime = Date.now();

    for (let i = visualizerE1RMLineData.length - 1; i >= 0; i--) {
      // console.log(`checking last date for lift type ${visualizerE1RMLineData[i].label} `);
      // console.log(visualizerE1RMLineData[i].data[visualizerE1RMLineData[i].data.length - 1].x);
      const lastDate = new Date(visualizerE1RMLineData[i].data[visualizerE1RMLineData[i].data.length - 1].x);

      if (currentTime - lastDate.getTime() > twoYearsInMilliseconds && visualizerE1RMLineData[i].data.length < 10) {
        // processedData[i].data.splice(0); // delete the minor obsolete lift chart data (but we keep the PRs)
        // console.log(`Ignoring minor lift type ${visualizerE1RMLineData[i].label}`);
        visualizerE1RMLineData.splice(i, 1); // delete the minor obsolete lift
      }
    }
  }

  // Let's only keep the top 10 remaining lifts.
  visualizerE1RMLineData.splice(10); // FIXME: this could be configurable in settings

  // Get the top lifts by session for the main Analyzer Pie chart
  let analyzerPieData = processAnalyzerPieData(parsedData, visualizerE1RMLineData);
  let analyzerPRCardData = processAnalyzerPRCardData(parsedData, visualizerE1RMLineData);

  // Do we have a localStorage selectedLifts item? First time user will not have one.
  // FIXME: don't do this in demo mode?
  const selectedLiftsItem = localStorage.getItem("selectedLifts");
  if (selectedLiftsItem === null) {
    let selectedLifts = visualizerE1RMLineData.map((item) => item.label);
    localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts)); // Default to select all
  }

  // Process the PRs/Achivements and return some chartjs annotation config.
  var annotations = processAchievements(parsedData, visualizerE1RMLineData, equation);

  // 10 day padding for the beginning and end of our data makes chart look nice
  // Use the most popular lift to set some aesthetic x-axis padding at start and end
  // There is a chance loading another data set will require a new range, but unlikely.
  // FIXME: just check ALL the first tuples in every lift and use the most recent one.
  let padDateMin = new Date(visualizerE1RMLineData[0].data[0].x); // First tuple in first lift
  padDateMin = padDateMin.setDate(padDateMin.getDate() - 10);

  // Set a padDateMax 10 days from the newest tuple date
  let padDateMax = new Date(visualizerE1RMLineData[0].data[visualizerE1RMLineData[0].data.length - 1].x); // Last tuple in first lift
  padDateMax = padDateMax.setDate(padDateMax.getDate() + 10);

  // Search through the processed data and find the largest y value
  let highestWeight = -1;
  visualizerE1RMLineData.forEach((liftType) => {
    liftType.data.forEach((lift) => {
      if (lift.y > highestWeight) highestWeight = lift.y;
    });
  });
  highestWeight = Math.ceil(highestWeight / 49) * 50; // Round up to the next mulitiple of 50

  // Set React state for our main data structures
  setAnalyzerData({
    // FIXME: put metadata here (such as calendarHeatmapData)
    analyzerPieData: analyzerPieData,
    analyzerPRCardData: analyzerPRCardData,
  });

  setVisualizerData({
    padDateMin: padDateMin,
    padDateMax: padDateMax,
    highestWeight: highestWeight,
    achievementAnnotations: annotations,
    visualizerE1RMLineData: visualizerE1RMLineData,
    // We could wrap the datasets for chartjs here, but nevermind we will do it in the <Line /> chart component
    // visualizerE1RMLineData: {datasets: processedData},
  });
}

// ------------------------------------------------------------------------------------------------
//  processEstimateData()
//
//  Loop through every parsed data and record the best lift for each type on that day.
//  Best lift is defined as the highest e1rm estimate.
//  Because we might be mutating existing visualiserData we need to pass it in.
// ------------------------------------------------------------------------------------------------
function processEstimateData(parsedData, visualizerE1RMLineData, equation) {
  for (const lift of parsedData) {
    const liftIndex = getProcessedLiftIndex(visualizerE1RMLineData, lift.name);

    // Main task - find the best e1rm estimate on this date
    let oneRepMax = estimateE1RM(lift.reps, lift.weight, equation);

    // Give informative data label for tooltip
    let label = "";
    if (lift.reps === 1) label = `Lifted 1@${lift.weight}${lift.unitType}.`;
    else label = `Potential 1@${oneRepMax}${lift.unitType} from ${lift.reps}@${lift.weight}${lift.unitType}.`;

    var url = lift.url;
    if (!url) url = "";

    // Do we already have any processed data on this date?
    let dateIndex = visualizerE1RMLineData[liftIndex].data.findIndex((processedLift) => processedLift.x === lift.date);

    if (dateIndex === -1) {
      // Push new lift tuple on this new date (in chartjs friendly format)
      visualizerE1RMLineData[liftIndex].data.push({
        x: lift.date,
        y: oneRepMax,
        label: label,
        method: equation,
        notes: lift.notes,
        afterLabel: [],
        isUpdated: true,
        url: url,
        unitType: lift.unitType,
        reps: lift.reps,
        weight: lift.weight,
      });
      continue; // Continue iterating through parsedData
    }

    // From here dateIndex is valid - we have a matching date.
    // Handle a number of cases where the parsed lift date has a date match in the processed graph data.
    // If we are changing equation method, then update the y value
    // FIXME: what happens if changing the equation changes the top estimate lift for that session?
    // FIXME: should we be setting .isUpdated here?
    if (visualizerE1RMLineData[liftIndex].data[dateIndex].method !== equation) {
      visualizerE1RMLineData[liftIndex].data[dateIndex].y = oneRepMax;
      visualizerE1RMLineData[liftIndex].data[dateIndex].method = equation;
      continue; // Continue iterating through parsedData
    }

    // If this processed lift is stale and is the same e1rm/date as this parsed lift, then refresh it
    // This is important for refreshing data from Google Sheets
    if (
      visualizerE1RMLineData[liftIndex].data[dateIndex].isUpdated === false &&
      oneRepMax === visualizerE1RMLineData[liftIndex].data[dateIndex].y
    ) {
      visualizerE1RMLineData[liftIndex].data[dateIndex].isUpdated = true;
      continue; // Continue iterating through parsedData
    }

    // If the parsed lift e1rm is higher than what we had on this date, then update.
    // Because our chart always has the best lift per day
    if (oneRepMax > visualizerE1RMLineData[liftIndex].data[dateIndex].y) {
      visualizerE1RMLineData[liftIndex].data[dateIndex].y = oneRepMax;
      visualizerE1RMLineData[liftIndex].data[dateIndex].label = label;
      visualizerE1RMLineData[liftIndex].data[dateIndex].notes = lift.notes;
      visualizerE1RMLineData[liftIndex].data[dateIndex].method = equation;
      visualizerE1RMLineData[liftIndex].data[dateIndex].isUpdated = true;
      visualizerE1RMLineData[liftIndex].data[dateIndex].url = url;
      visualizerE1RMLineData[liftIndex].data[dateIndex].unitType = lift.unitType;
      visualizerE1RMLineData[liftIndex].data[dateIndex].reps = lift.reps;
      visualizerE1RMLineData[liftIndex].data[dateIndex].weight = lift.weight;
      continue;
    }
  }
}

// When equation changes, we need to update the chart
// Discretely mutate React state internally
// This will animate the chart automatically, without changing React state or
// re-rendering the entire chart component.
export function updateE1RMEquation(parsedData, visualizerE1RMLineData) {
  const equation = localStorage.getItem("equation");

  processEstimateData(parsedData, visualizerE1RMLineData, equation);

  updateAchievements(parsedData, visualizerE1RMLineData);
}

// Prepare for a data source reload while preserving as much chart as possible.
// Normally used when we refresh the data from google sheets.
// FIXME: This function is needed for google autorefresh but this feature is not yet implemented
function prepareDataRefresh(parsedData, processedData, replaceData) {
  // Empty the parsedData array
  // This assumes we are loading a similar dataset.
  // Do not do this when concatenatng a complementary data source.
  if (replaceData) {
    parsedData.splice(0, parsedData.length); // empty the array
  }

  // Iterate through processedData and mark everything as stale
  processedData.forEach((liftType) => {
    liftType.data.forEach((lift) => {
      lift.isUpdated = false;
    });
  });
}

// Return the index for the liftType string in our processedData
// If the lift doesn't exist in processedData, create one.
function getProcessedLiftIndex(processedData, liftType) {
  let liftIndex = processedData.findIndex((lift) => lift.label === liftType);

  if (liftIndex === -1) {
    // Create a processedLift data structure for this new lift type

    const color = getLiftColor(liftType);

    // It is reverse logic because the option key is 'hidden' - positive selected means negative hidden
    // FIXME: don't do this in demo mode - everything should be { hidden: false }
    const hidden = !wasLiftSelected(liftType);

    let processedLiftType = {
      label: liftType,
      data: [],
      backgroundColor: color,
      borderColor: "rgb(50, 50, 50)",
      borderWidth: 2,
      pointStyle: "circle",
      radius: 4,
      hitRadius: 20,
      hoverRadius: 10,
      cubicInterpolationMode: "monotone",
      hidden: hidden, // This is for chart.js config - always show
    };
    liftIndex = processedData.push(processedLiftType) - 1;
  }

  return liftIndex;
}

// Look in our localStorage to see if a lift type is in the selectedList from a previous session
export function wasLiftSelected(liftType) {
  let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));

  // If there is no localStorage item we will just say yes to everything for the first time user.
  // At the end of the processing chain we will put all the lifts into selectedLifts localStorage
  // (don't create localStorage here in the middle of processing - just say YES/TRUE always)
  if (selectedLifts === null) return true;

  return selectedLifts.includes(liftType);
}
