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
const SKIP_WORKOUT_TITLES = new Set(["Every", "FT", "RFT", "RFQ", "AMRAP", "Chipper", "Complex", "Lifting", "RemRep", "EMOM", "Tabata"]);
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
    .replace(/^\d+x\s*/i, "")
    .replace(/^\d+\s*(?:mins?|minutes?|:\d{2})\s*/i, "")
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
 * Parse a complex/bracket line into multiple lift entries.
 * Format: "1x [ 1 Pause Power Clean + 1 Pause Hang Clean + 1 Split Jerk ] | 40 kg"
 * Returns an array of { reps, weight, unitType, liftType } or null if not a complex line.
 */
function parseComplexLine(line) {
  if (!line) return null;
  const trimmed = String(line).trim();

  // Match: optional-multiplier [ movements ] | weight unit
  const match = trimmed.match(
    /^(\d+)x?\s*\[\s*(.+?)\s*\]\s*\|\s*([\d.]+)\s*(kg|lb|lbs)$/i,
  );
  if (!match) return null;

  const weight = Number.parseFloat(match[3]);
  const unitType = match[4].toLowerCase().startsWith("kg") ? "kg" : "lb";
  if (!Number.isFinite(weight) || weight <= 0) return null;

  // Split movements by "+"
  const movements = match[2].split(/\s*\+\s*/);
  const results = [];

  for (const movement of movements) {
    // Each movement: "1 Pause Power Clean" or "2 Front Squats"
    const movementMatch = movement.match(/^(\d+)\s+(.+)$/);
    if (!movementMatch) continue;

    const reps = Number.parseInt(movementMatch[1], 10);
    const liftType = normalizeBtwbLiftType(movementMatch[2]);
    if (!Number.isFinite(reps) || reps <= 0 || !liftType) continue;

    results.push({ reps, weight, unitType, liftType });
  }

  return results.length > 0 ? results : null;
}

/**
 * Extract a round count from a WOD description block.
 * Matches patterns like "5 rounds of:", "3 rounds, each round for time, of:",
 * "5 rounds, 1:30 each, of:".
 * Returns 0 if no round pattern is found.
 */
function extractDescriptionRoundCount(descriptionText) {
  const match = String(descriptionText).match(/^(\d+)\s+rounds?\b/im);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Extract completed round count from the Formatted Result column.
 * AMRAP results look like "7 rounds | 140 reps" or "3 rounds + 14 Wall Balls".
 * The integer part is the number of fully completed rounds.
 */
function extractResultRoundCount(formattedResult) {
  const match = String(formattedResult).match(/^(\d+)\s+rounds?\b/i);
  return match ? Number.parseInt(match[1], 10) : 0;
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
  const formattedResultColumnIndex = col("Formatted Result");
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

    // Determine round multiplier:
    // - "Sets" blocks list each set individually, no multiplication
    // - RFT WODs: round count is in the Description ("5 rounds of:")
    // - AMRAPs: completed rounds are in Formatted Result ("7 rounds | 140 reps")
    const setsBlock = isSetsBlock(description);
    const formattedResult =
      formattedResultColumnIndex >= 0
        ? row[formattedResultColumnIndex] || ""
        : "";
    const descRounds = extractDescriptionRoundCount(description);
    const resultRounds = extractResultRoundCount(formattedResult);
    const roundCount = setsBlock ? 1 : descRounds || resultRounds || 1;

    const lines = String(description).split(/\r?\n/);

    lines.forEach((line) => {
      // Try complex bracket format first (e.g. "1x [ 1 Power Clean + 1 Jerk ] | 40 kg")
      const complexEntries = parseComplexLine(line);
      if (complexEntries) {
        const complexNotes = combinedNotes
          ? `Complex: ${combinedNotes}`
          : "Complex";
        for (const entry of complexEntries) {
          for (let r = 0; r < roundCount; r++) {
            parsedData.push({
              date,
              liftType: entry.liftType,
              reps: entry.reps,
              weight: entry.weight,
              unitType: entry.unitType,
              notes: complexNotes,
            });
          }
        }
        return;
      }

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
