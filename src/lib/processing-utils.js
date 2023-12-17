// Simple wrapper for console.log
export function devLog(message) {
  // We setup this special env variable on Vercel dev and preview but NOT production builds
  // This is so non-localhost clients can see devLogs on Vercel preview builds
  // Development machines should add this to their .env or .env.local
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    console.log(message);
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

// This is run once at init in the <Layout /> useEffect
// Loop through the data once and collect top PRs for each lift, reps 1..10
// Only do so for selectedLiftTypes
// This info will likely be used by both Analyzer and Visualizer components - so put in context
//
// The return format is: topLiftsByTypeAndReps["Back Squat"][4][17] means 18th best Back Squat 5RM ever
//
export function processTopLiftsByTypeAndReps(parsedData, selectedLiftTypes) {
  const startTime = performance.now();
  const topLiftsByTypeAndReps = {};

  // Check the date range using the first and last entries
  const firstYear = new Date(parsedData[0].date).getFullYear();
  const lastYear = new Date(
    parsedData[parsedData.length - 1].date,
  ).getFullYear();
  const yearRange = lastYear - firstYear;

  parsedData.forEach((entry) => {
    const { liftType, reps } = entry;

    // Skip processing if liftType is not in selectedLiftTypes
    if (!selectedLiftTypes.includes(liftType)) {
      return;
    }

    // Ensure that the reps value is within the expected range
    if (reps < 1 || reps > 10) {
      return;
    }

    if (!topLiftsByTypeAndReps[liftType]) {
      topLiftsByTypeAndReps[liftType] = Array.from({ length: 10 }, () => []);
    }

    let repArray = topLiftsByTypeAndReps[liftType][reps - 1];
    repArray.push(entry);

    // Sort by weight in descending order
    repArray.sort((a, b) => b.weight - a.weight);

    // Adjust the number of top entries to keep based on the year range
    // FIXME: maybe we don't have to do this, just let components choose how much to use?
    const maxEntries = yearRange <= 2 ? 5 : 20;
    if (repArray.length > maxEntries) {
      repArray.length = maxEntries;
    }
  });

  devLog(
    `processWorkoutData() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );
  return topLiftsByTypeAndReps;
}

// This is run once at init in the <Layout /> useEffect
// liftTypes is in our global context state
// It is an array sorted by lift set frequency descending of these objects:
// {
// "liftType": "Back Squat",
// "totalSets": 78,
// "totalReps": 402,
// "newestDate": "2023-12-11",
// "oldestDate": "2023-11-18"
// }
//
//
// FIXME: should liftTypes just be big object like topLiftsBySetsandReps? Merge into topLiftsBySetsAndReps?
// So far it is only 3ms on slow PC with my biggest dataset.
//
export function calculateLiftTypes(parsedData) {
  const startTime = performance.now();

  devLog(`calculateLiftTypes length: ${parsedData.length}`);
  const liftTypeStats = {};
  parsedData.forEach((lift) => {
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

// Usage example:
// const parsedData = [...]; // your data here
// const liftTypes = calculateLiftStats(parsedData);
// setLiftTypes(liftTypes); // if you're using this in a React component

// This is run once at init in the <Layout /> useEffect
// Assumes parsedData is sorted.
export const markHigherWeightAsHistoricalPRs = (parsedData) => {
  const startTime = performance.now();
  const bestRecordsMap = {};

  // Directly modify the objects for performance
  parsedData.forEach((record) => {
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
        lift.reps === liftTuple.reps
      ) {
        return i; // Return the position (index) of the lift in the array
      }
    }
  }

  return -1; // Return -1 if the lift is not found
}
