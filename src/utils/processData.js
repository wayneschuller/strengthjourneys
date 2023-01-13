/** @format */
// processData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

import { estimateE1RM } from "./estimateE1RM";
import { getLiftColor } from "./getLiftColor";

// Collect some simple stats for doughnut/pie chart in the <Analyzer />

// Here we will get the numbe of sessions for each lift in Pie Chart format (label/value)
// Let's also get the total number of lifts for each lift type
function processAnalyzerPieData(parsedData, processedData) {
  let analyzerPieData = [];

  // Do a survey on total number of each lift lifted
  const liftCounts = parsedData.reduce((counts, lift) => {
    if (counts[lift.name]) {
      counts[lift.name] += 1;
    } else {
      counts[lift.name] = 1;
    }
    return counts;
  }, {});

  // Steal what is useful from the visualizerData for the Analyzer pie chart
  processedData.forEach((lift) => {
    let totalSets = liftCounts[lift.label];
    analyzerPieData.push({
      label: lift.label,
      totalSessions: lift.data.length, // Number of 'lifting sessions' involving this lift
      totalSets: totalSets, // Another possible metric
      backgroundColor: lift.backgroundColor,
      borderColor: lift.borderColor,
    });
  });

  // Object.entries(liftCounts).forEach(([label, lifts]) =>
  // console.log(`label: ${label}, lifts: ${lifts}`)
  // });

  // setAnalyzerData(analyzerPieData);
  return analyzerPieData;
}

// Process the parsedData array of lifts into data structures ready for the <Visualiser /> and <Analyzer />
// We collect only the best set per lift type per day, according to highest estimated one rep max for the visualizer
// When an equation change causes a refresh, we will call this function with only the first three
// arguments. So we cannot access the last three arguments in that case...
export function processData(
  parsedData,
  visualizerData,
  setVisualizerData,
  setAnalyzerData,
  setIsLoading,
  setIsDataReady
) {
  console.log("processData()...");

  let equation = localStorage.getItem("equation");
  if (!equation) equation = "Brzycki"; // Probably not needed. Just in case.

  let isRefresh = false;

  // Do we already have a set of visualizerE1RMLineData? Then this must be a refresh caused by changing the equation method
  let processedData = [];
  if (visualizerData && visualizerData.visualizerE1RMLineData) {
    console.log(`... refreshing old data...`);
    processedData = visualizerData.visualizerE1RMLineData; // We are going to discretely mutate React state to modify chart without a rerender
    isRefresh = true;
  }

  for (const lift of parsedData) {
    const liftIndex = getProcessedLiftIndex(processedData, lift.name);

    // Main task - find the best e1rm estimate on this date
    let oneRepMax = estimateE1RM(lift.reps, lift.weight, equation);

    // Give informative data label for tooltip
    let label = "";
    if (lift.reps === 1) label = `Lifted 1@${lift.weight}${lift.unitType}.`;
    else label = `Potential 1@${oneRepMax}${lift.unitType} from ${lift.reps}@${lift.weight}${lift.unitType}.`;

    var url = lift.url;
    if (!url) url = "";

    // Do we already have any processed data on this date?
    let dateIndex = processedData[liftIndex].data.findIndex((processedLift) => processedLift.x === lift.date);

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
      processedData[liftIndex].data[dateIndex].unitType = lift.unitType;
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
  // FIXME: if we presort parsedData, then .data will already be sorted?
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
      const lastDate = new Date(processedData[i].data[processedData[i].data.length - 1].x);

      if (currentTime - lastDate.getTime() > twoYearsInMilliseconds && processedData[i].data.length < 10) {
        // processedData[i].data.splice(0); // delete the minor obsolete lift chart data (but we keep the PRs)
        processedData.splice(i, 1); // delete the minor obsolete lift
      }
    }
  }

  // Let's only keep the top 10 remaining lifts.
  processedData.splice(10); // FIXME: this could be configurable in settings

  // Get the top lifts by session for the main Analyzer Pie chart
  let analyzerPieData = processAnalyzerPieData(parsedData, processedData);
  let analyzerPRCardData = processAnalyzerPRCardData(parsedData, processedData);

  // Do we have a localStorage selectedLifts item? First time user will not have one.
  const selectedLiftsItem = localStorage.getItem("selectedLifts");
  if (selectedLiftsItem === null) {
    let selectedLifts = processedData.map((item) => item.label);
    localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts)); // Default to select all
  }

  // Process the PRs/Achivements and return some chartjs annotation config.
  if (isRefresh) {
    // If we have annotations this function will just mutate them
    updateAchievements(processedData, equation, visualizerData.achievementAnnotations);
  } else {
    // If annotations are null this function will give us a fresh set
    var annotations = processAchievements(parsedData, processedData, equation);
  }

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
      if (lift.y > highestWeight) highestWeight = lift.y;
    });
  });
  highestWeight = Math.ceil(highestWeight / 49) * 50; // Round up to the next mulitiple of 50

  // If this is not a refresh then set React state to trigger our visualizations
  // If it is a refresh - we will rely on local mutation to change the chart without React knowing
  // because React will rerender everything in a dumb way
  if (!isRefresh) {
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
      visualizerE1RMLineData: processedData,
      // We could wrap the datasets for chartjs here, but nevermind we will do it in the <Line /> component
      // visualizerE1RMLineData: {datasets: processedData},
    });

    setIsLoading(false); // Stop the loading animations
    setIsDataReady(true); // This should trigger <Visualizer /> and <Analyzer /> rendering
  }
}

// When refreshing, we want to simply update the y position of the annotations based on a new equation
// We can reuse the PR data stored in processedData for each lift
function updateAchievements(processedData, equation, achievementAnnotations) {
  // console.log(`updateAnnotations(). Mutating Y values on existing annotations`);

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
function processAchievements(parsedData, processedData, equation) {
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

  // Process the top 20 of this rep style (if we have that many)
  for (let i = 0; i < 20 && i < repLifts.length; i++) {
    // Match the lift to the chart line point.
    const dateIndex = processedData[datasetIndex].data.findIndex((lift) => lift.x === repLifts[i].date);
    processedData[datasetIndex].data[dateIndex].afterLabel.push(
      `#${i + 1} best ${liftType} ${prName} of all time (${reps}@${repLifts[i].weight}${repLifts[i].unitType})`
    );

    // Actual best lift for this rep scheme
    if (i === 0) {
      // Actual top PR gets a special chartjs annotation marker on the chart
      liftAnnotations[`${liftType}_best_${reps}RM`] = createAchievementAnnotation(
        liftType,
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
function createAchievementAnnotation(liftType, date, weight, text, background, datasetIndex) {
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
    yValue: weight,
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

// Prepare for a data source reload while preserving as much chart as possible.
// Normally used when we refresh the data from google sheets.
// FIXME: This function is needed for google autorefresh but this feature is not implemented
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
function wasLiftSelected(liftType) {
  let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));

  // If there is no localStorage item we will just say yes to everything for the first time user.
  // At the end of the processing chain we will put all the lifts into selectedLifts localStorage
  // (don't create localStorage here in the middle of processing - just say YES/TRUE always)
  if (selectedLifts === null) return true;

  return selectedLifts.includes(liftType);
}

function processAnalyzerPRCardData(parsedData, processedData) {
  // We are creating a first time set of annotations
  let analyzerPRCardData = {};

  // For each lift find important statistics for the <Analyzer /> page
  processedData.forEach((liftType, index) => {
    // Find the best n-rep maxes for this lift type
    // We go 'backwards' and look at the original parsed data for just this lift type
    const rawLifts = parsedData.filter((lift) => lift.name === liftType.label);

    // We use a processed tuple to get the best session lift each time
    // So the date field will be x not .date (FIXME: we could change this)
    const firstLift = liftType.data[0];
    const lastLift = liftType.data[liftType.data.length - 1];

    // Alternative but it gets the warmups not the top lift of the first session
    // const firstLift = rawLifts[rawLifts.length - 1];
    // const lastLift = rawLifts[0];

    // Get the i-rep maxes for this lift type up to a 10 rep max
    // Collect interesting data along the way
    let repPRLifts = {};
    let repRecentLifts = {};
    let recentHighlights = [];
    for (let reps = 1; reps <= 10; reps++) {
      // Filter for this rep style
      let repLifts = rawLifts.filter((lift) => lift.reps === reps);

      if (repLifts.length === 0) continue; // They don't have any lifts for this rep scheme

      // Let's make an array of the top 5 lifts for this rep scheme
      let recentLifts = [];
      for (let i = 0; i < 5; i++) {
        if (repLifts[i] === undefined) break; // We ran out of lifts
        recentLifts.push(repLifts[i]);
      }

      // Store the most recent 5 lifts for this rep scheme
      repRecentLifts[reps] = recentLifts;

      // Sort by weight. (award any ties to the earlier lift)
      repLifts.sort((a, b) => {
        if (a.weight === b.weight) {
          // Same weight tie goes to the earlier lift
          return new Date(a.date) - new Date(b.date);
        }
        // Different weights - bigger is better
        return b.weight - a.weight;
      });

      // Let's make an array of the top 5 lifts for this rep scheme
      let prLifts = [];
      for (let i = 0; i < 5; i++) {
        if (repLifts[i] === undefined) break; // We ran out of lifts
        prLifts.push(repLifts[i]);
      }

      // Store the top 5 lifts for this rep scheme
      repPRLifts[reps] = prLifts;

      for (let i = 0; i < 20; i++) {
        if (repLifts[i] === undefined) break; // We ran out of lifts

        let date = new Date(repLifts[i].date);
        if (date < new Date().setDate(new Date().getDate() - 30)) continue; // Too old, keep looking

        // Encouragement emojies: clapping, trophy, fire, 100, starstuck
        let encouragements = ["\u{1F44F}", "\u{1F3C6}", "\u{1F525}", "\u{1F4AF}", "\u{1F929}"];
        let emoji;
        switch (i) {
          case 0:
            emoji = "\u{1F947}";
            break;
          case 1:
            emoji = "\u{1F948}";
            break;
          case 2:
            emoji = "\u{1F949}";
            break;
          default:
            if (i > 2 && i < 10) {
              // Choose a random element from the encouragements array
              emoji = encouragements[Math.floor(Math.random() * encouragements.length)];
            } else {
              // ok emoji for 10th place or worse
              emoji = "\u{1F44C}";
            }
        }

        recentHighlights.push(
          `${reps}@${repLifts[i].weight}${repLifts[i].unitType} (${repLifts[i].date}), ${emoji} #${
            i + 1
          } best ${reps}RM ever.`
        );
      }
    }

    // Store key information for this lift type
    analyzerPRCardData[liftType.label] = {
      sessions: liftType.data.length,
      yearlyAverage: 365,
      repPRLifts: repPRLifts,
      repRecentLifts: repRecentLifts,
      recentHighlights: recentHighlights,
      firstLift: firstLift,
      lastLift: lastLift,
    };
  });

  return analyzerPRCardData;
}
