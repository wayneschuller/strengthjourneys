// Simple wrapper for console.log
export function devLog(...messages) {
  // We setup this special env variable on Vercel dev and preview but NOT production builds
  // This is so non-localhost clients can see devLogs on Vercel preview builds
  // Development machines should add this to their .env or .env.local
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    console.log(...messages);
  }
}

export const coreLiftTypes = [
  "Back Squat",
  "Deadlift",
  "Bench Press",
  "Strict Press",
  "Snatch",
  "Power Snatch",
  "Clean",
  "Power Clean",
  "Front Squat",
];

// Function to get a celebration emoji based on the provided position
export function getCelebrationEmoji(position) {
  // Array of celebration emojis corresponding to different positions
  const positionEmojis = [
    "\u{1F947}", // 🥇 First Place Medal
    "\u{1F948}", // 🥈 Second Place Medal
    "\u{1F949}", // 🥉 Third Place Medal
    "\u{1F4AA}", // 💪 Flexed Biceps
    "\u{1F44C}", // 👌 OK Hand
    "\u{1F44F}", // 👏 Clapping Hands
    "\u{1F3C6}", // 🏆 Trophy
    "\u{1F525}", // 🔥 Fire
    "\u{1F4AF}", // 💯 Hundred Points
    "\u{1F929}", // 🤩 Star-Struck
    "\u{1F389}", // 🎉 Party Popper
    "\u{1F44D}", // 👍 Thumbs Up
    "\u{1F381}", // 🎁 Wrapped Gift
    "\u{1F60D}", // 😍 Heart Eyes
    "\u{1F389}", // 🎉 Party Popper (Duplicate, added for emphasis)
    "\u{1F60A}", // 😊 Smiling Face with Smiling Eyes
    "\u{1F604}", // 😄 Smiling Face with Open Mouth and Smiling Eyes
    "\u{1F60B}", // 😋 Face Savoring Food
    "\u{1F973}", // 🥳 Partying Face
    "\u{1F609}", // 😉 Winking Face
  ];

  // Return the celebration emoji based on the provided position
  return positionEmojis[position];
}

// Convert ISO "YYYY-MM-DD" to readable date string
export function getReadableDateString(ISOdate) {
  let date = new Date(ISOdate);

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthNamesFull = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let dateString = `${month} ${day}`;
  const currentYear = new Date().getFullYear();

  // Include the year only if it's not the current year
  if (year !== currentYear) {
    dateString += `, ${year}`;
  }

  return dateString;
}

// Loop through the data once and collect top PRs for each lift, reps 1..10
// This info will likely be used by both Analyzer and Visualizer components
// The return format: topLiftsByTypeAndReps["Back Squat"][4][17] = lift tuple of 18th best Back Squat 5RM ever
export function processTopLiftsByTypeAndReps(parsedData) {
  const startTime = performance.now();
  const topLiftsByTypeAndReps = {};
  const topLiftsByTypeAndRepsLast12Months = {};

  const now = new Date();
  const last12Months = new Date(now.setFullYear(now.getFullYear() - 1));

  // Check the date range using the first and last entries
  const firstYear = new Date(parsedData[0].date).getFullYear();
  const lastYear = new Date(
    parsedData[parsedData.length - 1].date,
  ).getFullYear();
  const yearRange = lastYear - firstYear;

  parsedData.forEach((entry) => {
    const { liftType, reps, date } = entry;

    if (entry.isGoal) return; // Dreams do not count

    // Ensure that the reps value is within the expected range
    if (reps < 1 || reps > 10) {
      return;
    }

    if (!topLiftsByTypeAndReps[liftType]) {
      topLiftsByTypeAndReps[liftType] = Array.from({ length: 10 }, () => []);
    }

    let repArray = topLiftsByTypeAndReps[liftType][reps - 1];
    repArray.push(entry);

    // Collect best lifts of the last 12 months
    const entryDate = new Date(date);
    if (entryDate >= last12Months) {
      if (!topLiftsByTypeAndRepsLast12Months[liftType]) {
        topLiftsByTypeAndRepsLast12Months[liftType] = Array.from(
          { length: 10 },
          () => [],
        );
      }

      let last12MonthsRepArray =
        topLiftsByTypeAndRepsLast12Months[liftType][reps - 1];
      last12MonthsRepArray.push(entry);
    }
  });

  // Calculate the maximum number of entries to keep
  const maxEntries = yearRange <= 2 ? 5 : 20;

  // Function to sort and trim arrays
  const sortAndTrimArrays = (dataStructure, maxEntries) => {
    Object.keys(dataStructure).forEach((liftType) => {
      dataStructure[liftType].forEach((repArray) => {
        repArray.sort((a, b) => b.weight - a.weight);
        if (repArray.length > maxEntries) {
          repArray.length = maxEntries;
        }
      });
    });
  };

  sortAndTrimArrays(topLiftsByTypeAndReps, maxEntries);
  sortAndTrimArrays(topLiftsByTypeAndRepsLast12Months, maxEntries);

  devLog(
    `processTopLiftsByTypeAndReps() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months };
}

// liftTypes is an array sorted by lift set frequency descending of these objects:
// {
// "liftType": "Back Squat",
// "totalSets": 78,
// "totalReps": 402,
// "newestDate": "2023-12-11",
// "oldestDate": "2023-11-18"
// }
//
// FIXME: should liftTypes just be big object like topLiftsBySetsandReps? Merge into topLiftsBySetsAndReps?
// So far it is only 3ms on slow PC with my biggest dataset.
//
export function calculateLiftTypes(parsedData) {
  const startTime = performance.now();

  devLog(`calculateLiftTypes length: ${parsedData.length}`);
  const liftTypeStats = {};
  parsedData.forEach((lift) => {
    if (lift.isGoal) return; // Don't include goals here

    const liftType = lift.liftType;
    if (!liftTypeStats[liftType]) {
      liftTypeStats[liftType] = {
        totalSets: 0,
        totalReps: 0,
        newestDate: lift.date, // Initialize with the first encountered date
        oldestDate: lift.date, // Since parsedData is sorted by date
      };
    } else {
      // Since parsedData is sorted, the last date encountered is the newest
      liftTypeStats[liftType].newestDate = lift.date;
    }
    liftTypeStats[liftType].totalSets += 1;
    liftTypeStats[liftType].totalReps += lift.reps;
  });

  const sortedLiftTypes = Object.keys(liftTypeStats)
    .map((liftType) => ({
      liftType: liftType,
      totalSets: liftTypeStats[liftType].totalSets,
      totalReps: liftTypeStats[liftType].totalReps,
      newestDate: liftTypeStats[liftType].newestDate,
      oldestDate: liftTypeStats[liftType].oldestDate,
    }))
    .sort((a, b) => b.totalSets - a.totalSets);

  devLog(
    `calculateLiftTypes() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedLiftTypes;
}

// This is run once when data is imported
// Assumes parsedData is sorted chronologically.
export const markHigherWeightAsHistoricalPRs = (parsedData) => {
  const startTime = performance.now();
  const bestRecordsMap = {};

  // Directly modify the objects for performance
  parsedData.forEach((record) => {
    if (record.reps === 0) return; // Ignore fail records
    if (record.isGoal) return; // Don't include goals here

    const key = `${record.liftType}-${record.reps}`;

    if (!bestRecordsMap[key] || record.weight > bestRecordsMap[key].weight) {
      bestRecordsMap[key] = record;
      record.isHistoricalPR = true; // Directly set the property
    } else {
      record.isHistoricalPR = false; // Directly set the property
    }
  });

  // No need to re-sort if parsedData is already sorted by date

  devLog(
    `markPRs() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return parsedData;
};

export function findLiftPositionInTopLifts(liftTuple, topLiftsByTypeAndReps) {
  const { liftType, reps } = liftTuple;

  // Check if the lift type and rep range exists in the data structure
  if (
    topLiftsByTypeAndReps[liftType] &&
    topLiftsByTypeAndReps[liftType][reps - 1]
  ) {
    const topLifts = topLiftsByTypeAndReps[liftType][reps - 1];

    for (let i = 0; i < topLifts.length; i++) {
      let lift = topLifts[i];
      // Assuming we compare based on weight, adjust the condition as needed
      if (
        lift.date === liftTuple.date &&
        lift.weight === liftTuple.weight &&
        lift.reps === liftTuple.reps &&
        lift.notes === liftTuple.notes &&
        lift.URL === liftTuple.URL
      ) {
        // FIXME: this annotation stuff could simply just go in JSX
        const prSentenceReport = `${getCelebrationEmoji(i)}  #${i + 1} best ${
          lift.reps
        }RM`;

        return { rank: i, annotation: prSentenceReport }; // Return the position (index) of the lift in the array
      }
    }
  }

  return { rank: -1, annotation: null }; // Return -1 if the lift is not found
}
