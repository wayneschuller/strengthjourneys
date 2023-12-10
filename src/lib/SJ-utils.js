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
function getCelebrationEmoji(position) {
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
