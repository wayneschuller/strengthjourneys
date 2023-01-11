/** @format */
// getLiftColor.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

// Provide good defaults for popular barbell lifts
export function getLiftColor(liftType) {
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

  return color;
}
