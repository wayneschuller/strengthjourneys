import { normalizeDateInput } from "@/lib/date-utils";
import { recordTiming } from "@/lib/processing-utils";
import { normalizeLiftTypeNames } from "@/lib/data-sources/parser-utilities";

const TITLE_COLUMN_CANDIDATES = [
  "Workout",
  "workout",
  "Name",
  "name",
  "Title",
  "title",
];
const SKIP_WORKOUT_TITLES = new Set(["Every", "FT", "AMRAP", "Chipper"]);
const BTWB_LIFT_NAME_OVERRIDES = {
  "back squats": "Back Squat",
  "bench presses": "Bench Press",
  deadlifts: "Deadlift",
  "strict presses": "Strict Press",
  "overhead presses": "Strict Press",
};

function normalizeBtwbLiftType(rawLiftType) {
  if (!rawLiftType) return null;

  const cleaned = String(rawLiftType)
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const override = BTWB_LIFT_NAME_OVERRIDES[cleaned.toLowerCase()];
  return normalizeLiftTypeNames(override || cleaned);
}

function extractLiftType(rawTitle) {
  if (!rawTitle) return null;

  const title = String(rawTitle)
    .replace(/^[^A-Za-z]+/, "")
    .trim();
  if (!title) return null;

  const match = title.match(/^[A-Za-z][A-Za-z '&/()-]*/);
  const parsed = match?.[0]?.replace(/\s+/g, " ").trim();
  if (!parsed || SKIP_WORKOUT_TITLES.has(parsed)) return null;

  return normalizeBtwbLiftType(parsed);
}

function parseDescriptionLine(line) {
  if (!line) return null;

  const trimmed = String(line).trim();
  if (!trimmed) return null;

  const repsFirstMatch = trimmed.match(
    /^(\d+)\s+(.+?)\s*\|\s*([\d.]+)\s*(kg|lb|lbs)$/i,
  );
  if (repsFirstMatch) {
    const reps = Number.parseInt(repsFirstMatch[1], 10);
    const liftType = normalizeBtwbLiftType(repsFirstMatch[2]);
    const weight = Number.parseFloat(repsFirstMatch[3]);
    const unitType = repsFirstMatch[4].toLowerCase().startsWith("kg")
      ? "kg"
      : "lb";

    if (!Number.isFinite(reps) || reps <= 0 || !liftType) return null;
    if (!Number.isFinite(weight) || weight <= 0) return null;

    return { reps, weight, unitType, liftType };
  }

  const weightFirstMatch = trimmed.match(
    /^(\d+)\s+(.+?),\s*([\d.]+)\s*(kg|lb|lbs)\s*\|\s*(\d+)\s*reps?$/i,
  );
  if (weightFirstMatch) {
    const reps = Number.parseInt(weightFirstMatch[5], 10);
    const liftType = normalizeBtwbLiftType(weightFirstMatch[2]);
    const weight = Number.parseFloat(weightFirstMatch[3]);
    const unitType = weightFirstMatch[4].toLowerCase().startsWith("kg")
      ? "kg"
      : "lb";

    if (!Number.isFinite(reps) || reps <= 0 || !liftType) return null;
    if (!Number.isFinite(weight) || weight <= 0) return null;

    return { reps, weight, unitType, liftType };
  }

  const simpleWeightedSetMatch = trimmed.match(
    /^((\d+)\s+)?(.+?),\s*([\d.]+)\s*(kg|lb|lbs)$/i,
  );
  if (simpleWeightedSetMatch) {
    const reps = Number.parseInt(simpleWeightedSetMatch[2], 10);
    const liftType = normalizeBtwbLiftType(simpleWeightedSetMatch[3]);
    const weight = Number.parseFloat(simpleWeightedSetMatch[4]);
    const unitType = simpleWeightedSetMatch[5].toLowerCase().startsWith("kg")
      ? "kg"
      : "lb";

    if (!Number.isFinite(reps) || reps <= 0 || !liftType) return null;
    if (!Number.isFinite(weight) || weight <= 0) return null;

    return { reps, weight, unitType, liftType };
  }

  const repsMatch = trimmed.match(/^(\d+)/);
  if (!repsMatch) return null;

  const weightMatch = trimmed.match(/([\d.]+)\s*(kg|lb|lbs)$/i);
  if (!weightMatch) return null;

  const reps = Number.parseInt(repsMatch[1], 10);
  const weight = Number.parseFloat(weightMatch[1]);
  const unitType = weightMatch[2].toLowerCase().startsWith("kg") ? "kg" : "lb";

  if (!Number.isFinite(reps) || reps <= 0) return null;
  if (!Number.isFinite(weight) || weight <= 0) return null;

  return { reps, weight, unitType, liftType: null };
}

// Parse Beyond the Whiteboard CSV format.
//
// This follows the legacy BTWB importer logic from the user's existing script:
// - detect BTWB via its unique `Pukie` column
// - infer the lift type from the workout title column
// - split the multi-line `Description` cell into individual sets
export function parseBtwbData(data) {
  const startTime = performance.now();
  const columnNames = data[0] || [];
  const workoutDateColumnIndex = columnNames.indexOf("Date");
  const descriptionColumnIndex = columnNames.indexOf("Description");
  const notesColumnIndex = columnNames.indexOf("Notes");
  const workoutTitleColumnIndex = TITLE_COLUMN_CANDIDATES.map((name) =>
    columnNames.indexOf(name),
  ).find((index) => index >= 0);
  const localeHint =
    typeof navigator !== "undefined" && typeof navigator.language === "string"
      ? navigator.language
      : undefined;

  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row[0] == null) continue;

    const date = normalizeDateInput(row[workoutDateColumnIndex], localeHint);
    if (!date) continue;

    const titleLiftType = extractLiftType(
      workoutTitleColumnIndex >= 0 ? row[workoutTitleColumnIndex] : row[1],
    );

    const description = row[descriptionColumnIndex];
    if (!description) continue;

    const notes = row[notesColumnIndex] || undefined;
    const lines = String(description).split(/\r?\n/);

    lines.forEach((line) => {
      const parsedLine = parseDescriptionLine(line);
      if (!parsedLine) return;

      const liftType = titleLiftType || parsedLine.liftType;
      if (!liftType) return;

      parsedData.push({
        date,
        liftType,
        reps: parsedLine.reps,
        weight: parsedLine.weight,
        unitType: parsedLine.unitType,
        notes,
      });
    });
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse BTWB",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
