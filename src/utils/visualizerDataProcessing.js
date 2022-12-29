// visualizerDataProcessing.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Process our parsedData into chart.js ready format for the Strength Visualizer



// Default sample chart for first time user
// FIXME: Make this as interesting as possible to entice new users
export const defaultVisualizerData = {
    datasets: [{
      label: "Back Squat Sample Data",
      data: [
        {
          x: '2015-10-11', 
          y: 196,
          label: "Potential blah da blah",
        }, 
        {
          x: '2015-11-02', 
          y: 170,
          label: "doop de doop",
        },
        {
          x: '2015-11-05', 
          y: 130,
          label: "potential nope",
        },
      ]
    }]
  };

// This is used for testing purposes only
// FIXME: processedData is always an array with one object per lift in the arrray. No datasets object stuff...
export const dummyProcessedData = {
  datasets: [
  {
    label: "Back Squat",
    data: [
    {
    "x": "2015-10-11",
    "y": 106,
    "label": "Potential 1@106kg from 3@100kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 3,
    "weight": 100
    },
    {
    "x": "2015-11-02",
    "y": 106,
    "label": "Potential 1@106kg from 3@100kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 3,
    "weight": 100
    },
    {
    "x": "2015-11-03",
    "y": 109,
    "label": "Potential 1@109kg from 4@100kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 4,
    "weight": 100
    },
  ]
  },
  {
    label: "Deadlift",
    data: [
    {
    "x": "2015-10-01",
    "y": 170,
    "label": "Lifted 1@170kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 1,
    "weight": 170
    },
    {
    "x": "2015-11-08",
    "y": 144,
    "label": "Potential 1@144kg from 2@140kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 2,
    "weight": 140
  },
  {
    "x": "2015-11-23",
    "y": 155,
    "label": "Potential 1@155kg from 3@146kg.",
    "method": "Brzycki",
    "notes": "",
    "afterLabel": [],
    "isUpdated": true,
    "url": "",
    "reps": 3,
    "weight": 146
  }],
  }]
};

export let unitType = "lb"; // Default to freedom units
let equation = "Brzycki"; // Our favourite preferred equation - it does not over promise

// Process the parsedData array of lifts into processedData (AKA charts.js format for the visualizer)
// We collect only the best set per lift type per day, according to highest estimated one rep max
export function processVisualizerData(parsedData) {
  console.log("processVisualizerData()...");

  const processedData = []; // See dummyProcessedData[] for our structure design

  for (const lift of parsedData) {
    const liftIndex = getProcessedLiftIndex(processedData, lift.name);

    // Main task - find the best e1rm estimate on this date
    let oneRepMax = estimateE1RM(lift.reps, lift.weight);

    // Prepare our data label
    // FIXME: use the unit type in the lift.units, if missing fall back to global unitType
    let label = "";
    if (lift.reps == 1) label = `Lifted 1@${lift.weight}${unitType}.`;
    else label = `Potential 1@${oneRepMax}${unitType} from ${lift.reps}@${lift.weight}${unitType}.`;

    var url = lift.url;
    if (!url) url = "";

    // Do we already have any processed data on this date?
    let dateIndex = processedData[liftIndex].data.findIndex(
      (processedLift) => processedLift.x === lift.date
    );

    if (dateIndex === -1) {
      // Push new lift tuple on this new date (in chartjs friendly format)
      processedData[liftIndex].data.push({
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
    if (processedData[liftIndex].data[dateIndex].method !== equation) {
      processedData[liftIndex].data[dateIndex].y = oneRepMax;
      processedData[liftIndex].data[dateIndex].method = equation;
      continue; // Continue iterating through parsedData
    }

    // If this processed lift is stale and is the same e1rm/date as this parsed lift, then refresh it
    // This is important for refreshing data from Google Sheets
    if (
      processedData[liftIndex].data[dateIndex].isUpdated === false &&
      oneRepMax === processedData[liftIndex].data[dateIndex].y
    ) {
      processedData[liftIndex].data[dateIndex].isUpdated = true;
      continue; // Continue iterating through parsedData
    }

    // If the parsed lift e1rm is higher than what we had on this date, then update.
    // Because our chart always has the best lift per day
    if (oneRepMax > processedData[liftIndex].data[dateIndex].y) {
      processedData[liftIndex].data[dateIndex].y = oneRepMax;
      processedData[liftIndex].data[dateIndex].label = label;
      processedData[liftIndex].data[dateIndex].notes = lift.notes;
      processedData[liftIndex].data[dateIndex].method = equation;
      processedData[liftIndex].data[dateIndex].isUpdated = true;
      processedData[liftIndex].data[dateIndex].url = url;
      processedData[liftIndex].data[dateIndex].reps = lift.reps;
      processedData[liftIndex].data[dateIndex].weight = lift.weight;
      continue; // Continue iterating through parsedData
    }
  }

  console.log(
    `   ...processVisualiserData() complete: ${processedData.length} different types of lifts. (${equation} equation)`
  );

  // Remove any left over stale items (needed for refreshing data from Google Sheets)
  processedData.forEach((liftType) => {
    // Loop backwards through e1rmLineData mutating it to remove stale entries
    for (let i = liftType.data.length - 1; i >= 0; i--) {
      if (liftType.data[i].isUpdated === false) {
        // console.log(`Found stale ${liftType.name} graph entry #${i} is ${JSON.stringify(liftType.data[i])}`);
        liftType.data.splice(i, 1);
      }
    }
  });

  // Every element of processedData now has a data array of chart tuples
  // Let's sort each data array by date (x entry) so it draws lines correctly
  // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
  // FIXME: if we presort parsedData, then e1rmLineData will already be sorted?
  processedData.forEach((arr) => arr.data.sort((a, b) => new Date(a.x) - new Date(b.x)));

  // Also sort our processedData so the most popular lift types get charts first
  processedData.sort((a, b) => b.data.length - a.data.length);


  // If we have many lift types (> 15) then intelligently ignore uninteresting data.
  // We remove any lift types if:
  // 1) we have not performed that lift type in the last 2 years 
  // AND
  // 2) we only did that lift type less than 10 times. 
  //
  // So just keep lifting or do lots of a lift type to keep it as a chat option 
  if (processedData.length > 15) {
    const twoYearsInMilliseconds = 2 * 365 * 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
  
    for (let i = processedData.length - 1; i >= 0; i--) {
      const lastDate = new Date(processedData[i].data[processedData[i].data.length-1].x);

      if ((currentTime - lastDate.getTime() > twoYearsInMilliseconds) && (processedData[i].data.length < 10)) {
        processedData.splice(i, 1); // delete the minor obsolete lift 
      }
    }
  }

  return(processedData);
}

// Find interesting achievements
export function processAchievements(parsedData, processedData) {

  // FIXME: clearing annotations is needed for data refresh. I will leave the code here for now
  // but likely it should go elsewhere once we have data refresh working.
  // Clear old chart annotations
  // for (var member in liftAnnotations) delete liftAnnotations[member];

  let liftAnnotations = {};

  // For each lift find achievements
  processedData.forEach((liftType, index) => {
    // Clear old afterLabels with achievements so we can recreate them

    // if (index >= maxChartLines) return; // Achievements and annotations only useful where we have chart lines
    liftType.data.forEach((lift) => {
      lift.afterLabel.splice(0, lift.afterLabel.length); // empty array
      if (lift.notes) lift.afterLabel.push(lift.notes); // Put any notes back in first
      else lift.afterLabel = [];
    });

    // We go 'backwards' and look at the original parsed data for just this lift type
    const lifts = parsedData.filter((lift) => lift.name === liftType.label);

    findPRs(lifts, 1, "single", index, processedData, liftAnnotations);

    findPRs(lifts, 3, "triple", index, processedData, liftAnnotations);

    findPRs(lifts, 5, "five", index, processedData, liftAnnotations);
  });

  return(liftAnnotations);
}

// Helper function to find top 20 singles, threes and fives for each main lift
function findPRs(rawLifts, reps, prName, datasetIndex, processedData, liftAnnotations) {
  const name = processedData[datasetIndex].label;

  // console.log(`Finding ${reps}-rep PRs for ${name}`);

  // console.log(rawLifts);

  // Filter for this rep style
  let repLifts = rawLifts.filter((lift) => lift.reps == reps);

  // console.log(repLifts);

  // Sort by weight. (award any ties to the earlier lift)
  // FIXME: any ties on the SAME day should go to the later lift
  repLifts.sort((a, b) => {
    if (a.weight === b.weight) {
      return new Date(a.date) - new Date(b.date);
    }
    return b.weight - a.weight;
  });

  // Process the top 20 of this rep style (if we have that many)
  for (let i = 0; i < 20 && i < repLifts.length; i++) {
    // Match the lift to the chart line point.
    const dateIndex = processedData[datasetIndex].data.findIndex(
      (lift) => lift.x === repLifts[i].date
    );
    processedData[datasetIndex].data[dateIndex].afterLabel.push(
      `#${i + 1} best ${name} ${prName} of all time (${reps}@${repLifts[i].weight}${
        repLifts[i].units
      })`
    );

    // Actual top PR gets a special chartjs annotation marker on the chart
    if (i == 0) 
      liftAnnotations[`${name}_best_${reps}RM`] = createAchievementAnnotation(
        repLifts[i].date,
        estimateE1RM(reps, repLifts[i].weight),
        `${reps}RM`,
        "rgba(255, 99, 132, 0.25)",
        datasetIndex
      );
  }
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(date, weight, text, background, datasetIndex) {
  return {
    type: "label",
    // borderColor: (context) => context.chart.data.datasets[datasetIndex].backgroundColor,
    borderRadius: 3,
    borderWidth: 2,
    yAdjust: 20,
    content: [text],
    xValue: date,
    yValue: weight,
    backgroundColor: background,
    padding: {
      top: 2,
      left: 2,
      right: 2,
      bottom: 1,
    },
    // scaleID: 'y',
    display: false,   // Default to false and we can turn them on later
  };
}



// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight) {
  if (reps === 0) {
    console.error("Somebody passed 0 reps... naughty.");
    return 0;
  }

  if (reps === 1) return weight; // Heavy single requires no estimate!

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
  // processData(); // FIXME 202212 should be processVisualizerData?
  // myChart.update();

}

// Return the index for the liftType string in our processedData
// If the lift doesn't exist in processedData, create one.
function getProcessedLiftIndex(processedData, liftType) {

  let liftIndex = processedData.findIndex((lift) => lift.label === liftType);

  if (liftIndex === -1) {
    // Create a processedLift data structure for this new lift type

    // Choose beautiful colors. FIXME: Make configurable in UI
    let color; 
    switch (liftType) {
      case "Back Squat":
        color = "#ae2012";
        break;
      case "Deadlift":
        color = "#ee9b00";
        break;
      case "Bench Press":
        color = "#03045e";
        break;
      case "Strict Press":
        color = "#0a9396";
        break;
      default:
        color = `#${Math.floor(Math.random() * 16777215).toString(16)}`; 
    }

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
      selected: false,    // Our chips UI underneath the chart will select lifts for the chart
      hidden: false,      // This is for chart.js config - always show
    };
    liftIndex = processedData.push(processedLiftType) - 1;
  }

  return liftIndex;
}
