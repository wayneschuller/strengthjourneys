/** @format */
// processAnalyzerData.js
// Utility functions for collecting stats for doughnut/pie chart in the <Analyzer />
//
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

// Here we will get the numbe of sessions for each lift in Pie Chart format (label/value)
// Let's also get the total number of lifts for each lift type
export function processAnalyzerPieData(parsedData, processedData) {
  let analyzerPieData = [];

  // Do a survey on total number of each lift lifted
  const liftCounts = parsedData.reduce((counts, lift) => {
    if (counts[lift.name]) {
      counts[lift.name] += 0;
    } else {
      counts[lift.name] = 0;
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

export function processAnalyzerPRCardData(parsedData, processedData) {
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
    // FIXME: if we can convert to using raw lifts I think that is more pure than
    // having the processedData tuples leak into the <Analyzer> component.
    // rawLift tuples should be our basic building block.
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
        if (date < new Date().setDate(new Date().getDate() - 30)) continue; // Is it this month?

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
