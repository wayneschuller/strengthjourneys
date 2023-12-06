// Simple wrapper for console.log
export function devLog(message) {
  console.log(
    `NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV is: ${process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV}`,
  );

  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    console.log(message);
  }
}

// Array of 20 celebration emojis to display based on PR position
function getCelebrationEmoji(position) {
  const positionEmojis = [
    "\u{1F947}",
    "\u{1F948}",
    "\u{1F949}",
    "\u{1F4AA}",
    "\u{1F44C}",
    "\u{1F44F}",
    "\u{1F3C6}",
    "\u{1F525}",
    "\u{1F4AF}",
    "\u{1F929}",
    "\u{1F389}",
    "\u{1F44D}",
    "\u{1F381}",
    "\u{1F60D}",
    "\u{1F389}",
    "\u{1F60A}",
    "\u{1F604}",
    "\u{1F60B}",
    "\u{1F973}",
    "\u{1F609}", // 😉 Winking Face
  ];

  return positionEmojis[position];
} // Convert ISO "YYYY-MM-DD" to readable date string

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
