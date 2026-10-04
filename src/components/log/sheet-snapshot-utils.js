/**
 * Small input helpers for sets the log page writes to the sheet.
 * How a row is described to the write APIs lives with the sync itself, in
 * src/lib/sheet/log-sync-engine.js.
 */

export function getAutoTimestampNotes() {
  return `${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} `;
}

// Accept comma-as-decimal for locale keyboards that only offer `,`.
export function parseWeightInput(value) {
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.includes(".") ? value : value.replace(",", ".");
  return Number.parseFloat(normalized);
}
