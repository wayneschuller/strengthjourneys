/** @format */
// getLiftColor.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

// Provide good defaults for popular barbell lifts
export function getLiftColor(liftType) {
  let color;

  switch (liftType) {
    case "Back Squat":
    case "Squat":
      color = "#9B2226";
      break;
    case "Deadlift":
      color = "#005F73";
      break;
    case "Bench Press":
      color = "#94D2BD";
      break;
    case "Strict Press":
    case "Overhead Press":
      color = "#544B3D";
      break;
    case "Front Squat":
      color = "#0A9396";
      break;
    case "Romanian Deadlift":
      color = "#EE9B00";
      break;
    default:
      color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
  }

  return color;
}

// Current color palette inspired from:
// https://coolors.co/palette/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226
// {"Rich Black FOGRA 29":"001219","Blue Sapphire":"005f73","Viridian Green":"0a9396","Middle Blue Green":"94d2bd","Medium Champagne":"e9d8a6","Gamboge":"ee9b00","Alloy Orange":"ca6702","Rust":"bb3e03","Rufous":"ae2012","Ruby Red":"9b2226"}
