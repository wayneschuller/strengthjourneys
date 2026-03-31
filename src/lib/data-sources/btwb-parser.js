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
  "overhead presses": "Strict Press",
  "strict presses": "Strict Press",
};

/**
 * Convert a plural BTWB lift name to singular.
 * Handles the common English patterns found in BTWB exports:
 *   "Presses" -> "Press", "Flies" -> "Fly", "Carries" -> "Carry",
 *   "Snatches" -> "Snatch", "Squats" -> "Squat", etc.
 *
 * Only the LAST word is de-pluralized so compound names like
 * "Dumbbell Hang Power Cleans" -> "Dumbbell Hang Power Clean".
 */
function depluralizeLiftName(name) {
  if (!name) return name;
  const words = name.split(" ");
  let last = words[words.length - 1];

  // Don't touch single-character or very short words
  if (last.length <= 2) return name;

  // Order matters: check more specific suffixes first
  if (/resses$/i.test(last)) {
    // Presses -> Press
    last = last.replace(/es$/i, "");
  } else if (/lies$/i.test(last)) {
    // Flies -> Fly
    last = last.replace(/ies$/i, "y");
  } else if (/ries$/i.test(last)) {
    // Carries -> Carry
    last = last.replace(/ies$/i, "y");
  } else if (/[csxz]hes$/i.test(last)) {
    // Snatches, Lunches -> Snatch, Lunch
    last = last.replace(/es$/i, "");
  } else if (/[csxz]es$/i.test(last)) {
    // Raises, Bridges -> Raise, Bridge (but not "Presses" - handled above)
    last = last.replace(/s$/i, "");
  } else if (/s$/i.test(last) && !/ss$/i.test(last)) {
    // Squats -> Squat, Rows -> Row, Curls -> Curl
    // But not "Press" (no trailing s) or words ending in "ss"
    last = last.replace(/s$/i, "");
  }

  words[words.length - 1] = last;
  return words.join(" ");
}

function normalizeBtwbLiftType(rawLiftType) {
  if (!rawLiftType) return null;

  const cleaned = String(rawLiftType)
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const override = BTWB_LIFT_NAME_OVERRIDES[cleaned.toLowerCase()];
  if (override) return normalizeLiftTypeNames(override);

  const singular = depluralizeLiftName(cleaned);
  return normalizeLiftTypeNames(singular);
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

/**
 * Extract a round count from a WOD description block.
 * Matches patterns like "5 rounds of:", "3 rounds, each round for time, of:",
 * "5 rounds, 1:30 each, of:".
 * Returns 1 if no round pattern is found (straight-through sets).
 */
function extractRoundCount(descriptionText) {
  const match = String(descriptionText).match(/^(\d+)\s+rounds?\b/im);
  return match ? Number.parseInt(match[1], 10) : 1;
}

/**
 * Check if a description block is a "Sets" block (explicit set listing)
 * vs a WOD prescription (rounds of movements).
 * "Sets" blocks already list each set individually so should NOT be multiplied.
 */
function isSetsBlock(descriptionText) {
  return /^Sets\s*$/m.test(String(descriptionText));
}

// Parse Beyond the Whiteboard CSV format.
//
// Supports two known BTWB export column layouts:
//   Legacy (pre-2026): Date, Workout, Result, Prescribed, Pukie, Work performed, Work time, Formatted Result, Notes, Description
//   Current (2026+):   Date, Formatted Result, Result, Performed, Workout, Description, Notes
//
// Both share the same Description cell format (multi-line set data).
// Column positions are resolved by name, so either layout works.
//
// For WOD entries ("N rounds of: ..."), weighted exercises are extracted
// and multiplied by the round count to produce individual sets.
export function parseBtwbData(data) {
  const startTime = performance.now();
  const columnNames = data[0] || [];

  const col = (name) => columnNames.indexOf(name);
  const workoutDateColumnIndex = col("Date");
  const descriptionColumnIndex = col("Description");
  const notesColumnIndex = col("Notes");
  const workoutTitleColumnIndex = TITLE_COLUMN_CANDIDATES.map((name) =>
    col(name),
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

    // Merge Description and Notes into a single notes field
    const rawNotes = row[notesColumnIndex] || "";
    const descText = String(description).trim();
    const notesText = String(rawNotes).replace(/^""+|""+$/g, "").trim();
    const combinedNotes =
      [descText, notesText].filter(Boolean).join("\n") || undefined;

    // Determine if this is a round-based WOD vs explicit "Sets" listing
    const setsBlock = isSetsBlock(description);
    const roundCount = setsBlock ? 1 : extractRoundCount(description);

    const lines = String(description).split(/\r?\n/);

    lines.forEach((line) => {
      const parsedLine = parseDescriptionLine(line);
      if (!parsedLine) return;

      const liftType = titleLiftType || parsedLine.liftType;
      if (!liftType) return;

      // For WOD rounds, emit one set per round
      for (let r = 0; r < roundCount; r++) {
        parsedData.push({
          date,
          liftType,
          reps: parsedLine.reps,
          weight: parsedLine.weight,
          unitType: parsedLine.unitType,
          notes: combinedNotes,
        });
      }
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
