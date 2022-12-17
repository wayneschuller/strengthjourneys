// visualizerDataProcessing.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Process our parsedData into chart.js ready format for the Strength Visualizer

import { 
  minChartLines,
  maxChartLines
} from "../pages/visualizer";

import { parsedData } from "./parseData";

// Global variables
export const processedData = []; // Array with one element per lift type of charts.js graph friendly data and special achievements
export const liftAnnotations = {}; // chart.js annotations plugin config for special achivements such as 1RM, 3RM, 5RM.
export let myChart = null;
export let chartTitle = "Strength History";
export let padDateMin, padDateMax;
export let unitType = "lb"; // Default to freedom units
let equation = "Brzycki"; // Our favourite preferred equation - it does not over promise

// Process the parsedData array of lifts into processedData (AKA charts.js format for the visualizer)
// We collect only the best set per lift type per day, according to highest estimated one rep max
export function processData() {
  for (const lift of parsedData) {
    const liftIndex = getProcessedLiftIndex(lift.name);

    // Main task - find the best e1rm estimate on this date
    let oneRepMax = estimateE1RM(lift.reps, lift.weight);

    // Prepare our data label
    // FIXME: use the unit type in the lift.units, if missing fall back to global unitType
    let label = "";
    if (lift.reps === 1) label = `Lifted 1@${lift.weight}${unitType}.`;
    else label = `Potential 1@${oneRepMax}${unitType} from ${lift.reps}@${lift.weight}${unitType}.`;

    var url = lift.url;
    if (!url) url = "";

    // Do we already have any processed data on this date?
    let dateIndex = processedData[liftIndex].e1rmLineData.findIndex(
      (processedLift) => processedLift.x == lift.date
    );

    if (dateIndex === -1) {
      // Push new lift on this new date (in chartjs friendly format)
      processedData[liftIndex].e1rmLineData.push({
        x: lift.date,
        y: oneRepMax,
        label: label,
        method: equation,
        notes: lift.notes,
        afterLabel: [],
        isUpdated: true,
        url: url,
        reps: lift.reps,
        weight: lift.weight,
      });
      continue; // Continue iterating through parsedData
    }

    // From here dateIndex is valid - we have a matching date.
    // Handle a number of cases where the parsed lift date has a date match in the processed graph data.

    // If we are changing equation method, then update the y value
    if (processedData[liftIndex].e1rmLineData[dateIndex].method != equation) {
      processedData[liftIndex].e1rmLineData[dateIndex].y = oneRepMax;
      processedData[liftIndex].e1rmLineData[dateIndex].method = equation;
      continue; // Continue iterating through parsedData
    }

    // If this processed lift is stale and is the same e1rm/date as this parsed lift, then refresh it
    // This is important for refreshing data from Google Sheets
    if (
      processedData[liftIndex].e1rmLineData[dateIndex].isUpdated === false &&
      oneRepMax === processedData[liftIndex].e1rmLineData[dateIndex].y
    ) {
      processedData[liftIndex].e1rmLineData[dateIndex].isUpdated = true;
      continue; // Continue iterating through parsedData
    }

    // If the parsed lift e1rm is higher than what we had on this date, then update.
    // Because our chart always has the best lift per day
    if (oneRepMax > processedData[liftIndex].e1rmLineData[dateIndex].y) {
      processedData[liftIndex].e1rmLineData[dateIndex].y = oneRepMax;
      processedData[liftIndex].e1rmLineData[dateIndex].label = label;
      processedData[liftIndex].e1rmLineData[dateIndex].notes = lift.notes;
      processedData[liftIndex].e1rmLineData[dateIndex].method = equation;
      processedData[liftIndex].e1rmLineData[dateIndex].isUpdated = true;
      processedData[liftIndex].e1rmLineData[dateIndex].url = url;
      processedData[liftIndex].e1rmLineData[dateIndex].reps = lift.reps;
      processedData[liftIndex].e1rmLineData[dateIndex].weight = lift.weight;
      continue; // Continue iterating through parsedData
    }
  }

  console.log(
    `Processed parsedData into ${processedData.length} different types of lifts. (${equation} equation)`
  );

  // Remove any left over stale items (needed for refreshing data from Google Sheets)
  processedData.forEach((liftType) => {
    // Loop backwards through e1rmLineData mutating it to remove stale entries
    for (let i = liftType.e1rmLineData.length - 1; i >= 0; i--) {
      if (liftType.e1rmLineData[i].isUpdated === false) {
        // console.log(`Found stale ${liftType.name} graph entry #${i} is ${JSON.stringify(liftType.e1rmLineData[i])}`);
        liftType.e1rmLineData.splice(i, 1);
      }
    }
  });

  // We now know how many lift types we have. So reduce the number of expected chart lines if needed.
  // 202212 FIXME: logic not right and js dumbness
  // if (processedData.length < minChartLines) minChartLines = processedData.length;

  // Every element of processedData now has a e1rmLineData array
  // Let's sort each e1rmLineData array by date (x entry) so it draws lines correctly
  // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
  // FIXME: if we presort parsedData, then e1rmLineData will already be sorted
  processedData.forEach((arr) => arr.e1rmLineData.sort((a, b) => new Date(a.x) - new Date(b.x)));

  // Also sort our processedData so the most popular lift types get charts first
  processedData.sort((a, b) => b.e1rmLineData.length - a.e1rmLineData.length);

  // Find achievements and put on chart
  processAchievements();
}

// Find interesting achievements
function processAchievements() {
  // Clear old chart annotations
  for (var member in liftAnnotations) delete liftAnnotations[member];

  // For each lift find achievements
  processedData.forEach((liftType, index) => {
    // Clear old afterLabels with achievements so we can recreate them
    if (index >= maxChartLines) return; // Achievements and annotations only useful where we have chart lines
    liftType.e1rmLineData.forEach((lift) => {
      lift.afterLabel.splice(0, lift.afterLabel.length); // empty array
      if (lift.notes) lift.afterLabel.push(lift.notes); // Put any notes back in first
      else lift.afterLabel = [];
    });

    // Get the parsed data for just this lift type
    const lifts = parsedData.filter((lift) => lift.name === liftType.name);

    findPRs(lifts, 1, "single", index);

    findPRs(lifts, 3, "triple", index);

    findPRs(lifts, 5, "five", index);
  });
}

// Helper function to find top 20 singles, threes and fives for each main lift
function findPRs(rawLifts, reps, prName, datasetIndex) {
  // Filter for this rep style
  let repLifts = rawLifts.filter((lift) => lift.reps === reps);

  // Sort by weight. (award ties to the earlier lift)
  repLifts.sort((a, b) => {
    if (a.weight === b.weight) {
      return new Date(a.date) - new Date(b.date);
    }
    return b.weight - a.weight;
  });

  const name = processedData[datasetIndex].name;

  // Process the top 20 of this rep style (if we have that many)
  for (let i = 0; i < 20 && i < repLifts.length; i++) {
    // Match the lift to the chart line point.
    const dateIndex = processedData[datasetIndex].e1rmLineData.findIndex(
      (lift) => lift.x === repLifts[i].date
    );
    processedData[datasetIndex].e1rmLineData[dateIndex].afterLabel.push(
      `#${i + 1} best ${name} ${prName} of all time (${reps}@${repLifts[i].weight}${
        repLifts[i].units
      })`
    );

    // Actual top PR gets a special annotation marker on the chart
    // if (i == 0)
      // liftAnnotations[`${name}_best_${reps}RM`] = createAchievementAnnotation(
        // repLifts[i].date,
        // estimateE1RM(reps, repLifts[i].weight),
        // `${reps}RM`,
        // "rgba(255, 99, 132, 0.25)",
        // datasetIndex
      // );
  }
}


// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight) {
  if (reps == 0) {
    console.error("Somebody passed 0 reps... naughty.");
    return 0;
  }

  if (reps == 1) return weight; // Heavy single requires no estimate!

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
      break;
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
      break;
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
      break;
    case "Mayhew":
      return Math.round((100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)));
      break;
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
      break;
    case "Wathen":
      return Math.round((100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)));
      break;
    case "Brzycki":
      return Math.round(weight / (1.0278 - 0.0278 * reps));
      break;
    default: // Repeat Brzycki formula as a default here
      return Math.round(weight / (1.0278 - 0.0278 * reps));
      break;
  }
}

// Prepare for a data source reload while preserving as much chart as possible.
// Normally used when we refresh the data from google sheets.
// FIXME: this function should be in parseData.js
function prepareDataRefresh(replaceData) {
  // Empty the parsedData array
  // This assumes we are loading a similar dataset.
  // Do not do this when concatenatng a complementary data source.
  if (replaceData) {
    parsedData.splice(0, parsedData.length); // empty the array
  }

  // Iterate through processedData and mark everything as stale
  processedData.forEach((liftType) => {
    liftType.e1rmLineData.forEach((lift) => {
      lift.isUpdated = false;
    });
  });
}

// Used to detect a click on a graph point and open URL in the data.
export function chartClickHandler(event, item) {
  if (item && item.length > 0) {
    const url = processedData[item[0].datasetIndex].e1rmLineData[item[0].index].url;
    if (url) window.open(url);
  }
}

// Callback handler for button to easy zoom in and out
function toggleZoom() {
  const toggleInput = document.getElementById("toggleZoom");
  if (toggleInput.value == "Show All Time") {
    // The user wants to zoom out to show all data
    myChart.resetZoom();

    // Change the toggle button
    toggleInput.value = "Show Recent";
    toggleInput.innerHTML = "Show Recent"; // FIXME: why do we set both .value and .innerHTML???
  } else {
    // The user wants to zoom in to show recent data
    // Set the zoom/pan to the last 6 months of data if we have that much
    let xAxisMin = new Date(padDateMax - 1000 * 60 * 60 * 24 * 30 * 6);
    if (xAxisMin < padDateMin) xAxisMin = padDateMin;
    let xAxisMax = new Date(padDateMax);
    myChart.zoomScale("xAxis", { min: xAxisMin, max: xAxisMax }, "default");

    // Change the toggle button
    toggleInput.value = "Show All Time";
    toggleInput.innerHTML = "Show All Time";
  }
}

// Callback handlers for equation html dropup menu
function changeEquation(event, newEquation) {

  if (equation === newEquation) return; // nothing to do

  // Clear class "equations"
  //  links = document.getElementsByClassName("equations");
  //  for (i = 0; i < links.length; i++) {
    //  links[i].className = links[i].className.replace(" active", "");
  //  }
 
   // Add an "active" class to the button that opened the tab
   // This will trigger the css rule to set the color
   event.currentTarget.className += " active";

  // Change the global equation and reprocess and draw the data
  equation = newEquation;
  processData();
  myChart.update();

}




// Return the index for the liftType string in our processedData
// If the lift doesn't exist in processedData, create one.
function getProcessedLiftIndex(liftType) {
  let liftIndex = processedData.findIndex((lift) => lift.name === liftType);

  if (liftIndex === -1) {
    // Create a processedLift data structure for this new lift type
    let processedLiftType = {
      name: liftType,
      e1rmLineData: [],
    };
    liftIndex = processedData.push(processedLiftType) - 1;
  }

  return liftIndex;
}
