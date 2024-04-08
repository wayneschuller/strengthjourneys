/** @format */
// getLiftColor.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

import { devLog } from "./processing-utils";

// Provide good defaults for popular barbell lifts
export function getLiftColor(liftType) {
  const storageKey = `SJ_${liftType}_color`; // Use a namespaced key for localStorage
  let color = localStorage.getItem(storageKey);

  // devLog(`getLiftColor called for ${liftType}`);

  if (!color) {
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
      case "Press":
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
    localStorage.setItem(storageKey, color);
  }

  return color;
}

// Current color palette inspired from:
// https://coolors.co/palette/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226
// {"Rich Black FOGRA 29":"001219","Blue Sapphire":"005f73","Viridian Green":"0a9396","Middle Blue Green":"94d2bd","Medium Champagne":"e9d8a6","Gamboge":"ee9b00","Alloy Orange":"ca6702","Rust":"bb3e03","Rufous":"ae2012","Ruby Red":"9b2226"}

export function brightenHexColor(hex, factor) {
  // Convert hex to RGB
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Brighten the color
  r = Math.min(255, Math.floor(r * factor));
  g = Math.min(255, Math.floor(g * factor));
  b = Math.min(255, Math.floor(b * factor));

  // Convert back to hex
  r = r.toString(16).padStart(2, "0");
  g = g.toString(16).padStart(2, "0");
  b = b.toString(16).padStart(2, "0");

  return `#${r}${g}${b}`;
}
