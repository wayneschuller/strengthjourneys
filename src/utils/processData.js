// processData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Process the parsedData array of lifts into processedData (AKA charts.js format for the visualizer)
// We collect only the best set per lift type per day, according to highest estimated one rep max
export function processVisualizerData(parsedData,
                                      setIsLoading,     
                                      setVisualizerData,
                                      setVisualizerConfig,
                                      ) {

  console.log("processVisualizerData()...");

  let equation = localStorage.getItem('equation');
  if (!equation) equation = "Brzycki"; // Probably not needed. Just in case.

  const processedData = [];

  for (const lift of parsedData) {
    const liftIndex = getProcessedLiftIndex(processedData, lift.name);

    // Main task - find the best e1rm estimate on this date
    let oneRepMax = estimateE1RM(lift.reps, lift.weight, equation);

    // Give informative data label for tooltip
    let label = "";
    if (lift.reps == 1) label = `Lifted 1@${lift.weight}${lift.unitType}.`;
    else label = `Potential 1@${oneRepMax}${lift.unitType} from ${lift.reps}@${lift.weight}${lift.unitType}.`;

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
    if (processedData[liftIndex].data[dateIndex].method != equation) {
      processedData[liftIndex].data[dateIndex].y = oneRepMax;
      processedData[liftIndex].data[dateIndex].method = equation;
      continue; // Continue iterating through parsedData
    }

    // If this processed lift is stale and is the same e1rm/date as this parsed lift, then refresh it
    // This is important for refreshing data from Google Sheets
    if (
      processedData[liftIndex].data[dateIndex].isUpdated == false &&
      oneRepMax == processedData[liftIndex].data[dateIndex].y
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
  // Advice to user: Keep lifting or do lots of a lift type to keep it visualized
  if (processedData.length > 15) {
    const twoYearsInMilliseconds = 2 * 365 * 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
  
    for (let i = processedData.length - 1; i >= 0; i--) {
      const lastDate = new Date(processedData[i].data[processedData[i].data.length-1].x);

      if ((currentTime - lastDate.getTime() > twoYearsInMilliseconds) && (processedData[i].data.length < 10)) {
        // processedData[i].data.splice(0); // delete the minor obsolete lift chart data (but we keep the PRs)
        processedData.splice(i, 1); // delete the minor obsolete lift 
      }
    }
  }

  // FIXME: Let's only keep the top 10 remaining lifts.
  processedData.splice(10); // Delete everything above 10

  // Process the PRs/Achivements and return some chartjs annotation config.
  let annotations = processAchievements(parsedData, processedData, equation);

  // 10 day padding for the beginning and end of our data makes chart look nice
  // Use the most popular lift to set some aesthetic x-axis padding at start and end
  // There is a chance loading another data set will require a new range, but unlikely.
  // FIXME: just check ALL the first tuples in every lift and use the most recent one.
  let padDateMin = new Date(processedData[0].data[0].x); // First tuple in first lift
  padDateMin = padDateMin.setDate(padDateMin.getDate() - 10);

  // FIXME: this could just do 10 days from now
  let padDateMax = new Date(processedData[0].data[processedData[0].data.length - 1].x); // Last tuple in first lift
  padDateMax = padDateMax.setDate(padDateMax.getDate() + 10);

  // Search through the processed data and find the largest y value 
  let highestWeight = -1;
  processedData.forEach((liftType) => {
    liftType.data.forEach((lift) => {
      if (lift.y > highestWeight) 
        highestWeight = lift.y;
    });
  });
  highestWeight = Math.ceil(highestWeight / 49) * 50; // Round up to the next mulitiple of 50
          
  setVisualizerConfig({
                        padDateMin: padDateMin,
                        padDateMax: padDateMax,
                        highestWeight: highestWeight,
                        achievementAnnotations: annotations,
  });

  // Lastly, load in the data.
  setIsLoading(false);            // Stop the loading animations
  setVisualizerData({datasets: processedData});   // This should trigger <Visualizer /> and <Analyzer /> creation
}

// Find interesting achievements
function processAchievements(parsedData, processedData, equation) {

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

    findPRs(lifts, 1, "single", index, processedData, liftAnnotations, equation);

    findPRs(lifts, 3, "triple", index, processedData, liftAnnotations, equation);

    findPRs(lifts, 5, "five", index, processedData, liftAnnotations, equation);
  });

  return(liftAnnotations);
}

// Helper function to find top 20 singles, threes and fives for each main lift
function findPRs(rawLifts, reps, prName, datasetIndex, processedData, liftAnnotations, equation) {
  const liftType = processedData[datasetIndex].label;

  // console.log(`Finding ${reps}-rep PRs for ${processedData[datasetIndex].label}`);

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
      `#${i + 1} best ${liftType} ${prName} of all time (${reps}@${repLifts[i].weight}${
        repLifts[i].unitType
      })`
    );

    // Actual best lift for this rep scheme
    if (i == 0)  {

      // Actual top PR gets a special chartjs annotation marker on the chart
      liftAnnotations[`${liftType}_best_${reps}RM`] = createAchievementAnnotation(
        repLifts[i].date,
        estimateE1RM(reps, repLifts[i].weight, equation),
        `${reps}RM`,
        "rgba(255, 99, 132, 0.25)",
        datasetIndex
      );

      // Keep a special copy of the winning PR for the <Analyzer />
      processedData[datasetIndex][`${reps}RM`] = {
        reps: reps,
        weight: repLifts[i].weight,
        date: repLifts[i].date,
        unitType: repLifts[i].unitType,
        url: repLifts[i].url,
      };
    }
  }
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(date, weight, text, background, datasetIndex) {
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
    yValue: weight,
    backgroundColor: background,
    padding: {
      top: 2,
      left: 2,
      right: 2,
      bottom: 1,
    },
    display: true,  // default to display

    // Below display handler works but is quite slow. So now we show/hide in our legend click handler
    //  display: (context, options) => {
      // let meta = context.chart.getDatasetMeta(datasetIndex);
      // return(meta.visible);
    // },
  };
}



// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight, equation) {
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
      hidden: false,      // This is for chart.js config - always show
    };
    liftIndex = processedData.push(processedLiftType) - 1;
  }

  return liftIndex;
}