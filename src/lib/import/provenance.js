/**
 * Human-readable import provenance helpers.
 * Keep source identity understandable in the user-owned Sheet while still
 * giving merge deduplication stable facts such as workout time and set number.
 */

const HEVY_SET_PROVENANCE_PATTERN = /\(Hevy:\s*(.*)\s*·\s*set\s+(\d+)\)/i;
const NOTES_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?:\s|$)/;

export function formatLocalISODate(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildVisibleImportProvenance(formatName, importedOn) {
  const source = String(formatName || "External").trim() || "External";
  const date = formatLocalISODate(importedOn);
  return date ? `(${source} import ${date})` : `(${source} import)`;
}

export function buildHevySetProvenance(workoutTitle, setIndex) {
  const title = String(workoutTitle || "Workout")
    .replace(/\s+/g, " ")
    .trim();
  const numericSetIndex = Number(setIndex);

  if (!Number.isInteger(numericSetIndex) || numericSetIndex < 0) {
    return `(Hevy: ${title})`;
  }

  // Hevy exports zero-based set_index values; Sheets should read naturally.
  return `(Hevy: ${title} · set ${numericSetIndex + 1})`;
}

export function getImportedSourceIdentity(entry) {
  if (!entry || typeof entry.notes !== "string") return null;

  const timeMatch = entry.notes.match(NOTES_TIME_PATTERN);
  const provenanceMatch = entry.notes.match(HEVY_SET_PROVENANCE_PATTERN);
  if (!timeMatch || !provenanceMatch) return null;

  const date = String(entry.date || "").trim();
  const liftType = String(entry.liftType || "").trim();
  const workoutTitle = provenanceMatch[1].replace(/\s+/g, " ").trim();
  const setNumber = provenanceMatch[2];
  if (!date || !liftType || !workoutTitle || !setNumber) return null;

  return [
    "hevy",
    date,
    timeMatch[0].trim(),
    workoutTitle,
    liftType,
    setNumber,
  ].join("|");
}

export function hasVisibleImportProvenance(notes, formatName) {
  const source = String(formatName || "External")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .trim();
  if (!source || typeof notes !== "string") return false;
  return new RegExp(`\\(${source} import \\d{4}-\\d{2}-\\d{2}\\)`, "i").test(
    notes,
  );
}
