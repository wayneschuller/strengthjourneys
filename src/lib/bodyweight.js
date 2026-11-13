/**
 * The lifter's bodyweight over time, as read from weigh-in rows in their log.
 *
 * A weigh-in is an ordinary row of the sheet whose lift type is "Bodyweight"
 * (or "Body Weight", "BW", "Weigh-in"), with the weight in the Weight column
 * and any comment in Notes. Reps are left blank. The parser takes these rows
 * out of the lifts, so PRs, tonnage, sessions and streaks never see them, and
 * hands them here as a separate list (see getSheetBodyweightEntries in the
 * Strength Journeys parser).
 *
 * Between two weigh-ins the weight is drawn as a straight line: a lifter whose
 * weight changes a lot will usually weigh in, and a meet brings a weigh-in
 * anyway, so the line is a fair guess. Before the first weigh-in the first
 * one stands, and after the last the last one stands. The trend is never
 * projected forward.
 *
 * Everything that wants "what did they weigh on this date" asks
 * bodyweightAt(), so a chart, a past strength rating and the AI coach can
 * never disagree about the same day.
 */

import { normalizeDateInput } from "@/lib/date-utils";
import { convertWeightAndUnitType } from "@/lib/import/parsers/parser-utilities";
import { convertWeight, toKg } from "@/lib/weight-units";

/** The lift type the app writes on a weigh-in row. */
export const WEIGH_IN_LIFT_TYPE = "Bodyweight";

// Names a lifter might type for a weigh-in, compared with case, spaces and
// punctuation set aside ("Weigh-in", "body weight", "BW").
const WEIGH_IN_NAMES = new Set(["bodyweight", "bw", "weighin"]);

const DAY_MS = 86400000;

/** Is this lift-type cell a weigh-in rather than a lift? */
export function isWeighInLiftType(liftType) {
  if (liftType == null || liftType === "") return false;
  const key = String(liftType)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return WEIGH_IN_NAMES.has(key);
}

/**
 * One weigh-in per date, oldest first, each with its weight in kg beside the
 * value the lifter wrote. When a date has two, the one higher in the sheet
 * wins, since the log writes newer rows above older ones.
 *
 * @param {object[]|null} entries Weigh-in entries from the parser.
 * @returns {{date: string, value: number, unitType: string, kg: number,
 *   notes: string, rowIndex: number|undefined}[]}
 */
export function getBodyweightSeries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return EMPTY_SERIES;
  const byDate = new Map();
  for (const entry of entries) {
    if (!entry?.date || !(entry.weight > 0)) continue;
    const existing = byDate.get(entry.date);
    if (
      existing &&
      (existing.rowIndex ?? Infinity) <= (entry.rowIndex ?? Infinity)
    ) {
      continue;
    }
    byDate.set(entry.date, entry);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      value: entry.weight,
      unitType: entry.unitType ?? "lb",
      kg: toKg(entry.weight, entry.unitType),
      notes: entry.notes ?? "",
      rowIndex: entry.rowIndex,
    }));
}

const EMPTY_SERIES = Object.freeze([]);

/**
 * What the lifter weighed on a date, in the unit asked for: the weigh-in that
 * day, or the straight line between the weigh-ins either side of it.
 *
 * @param {ReturnType<typeof getBodyweightSeries>} series
 * @param {string} date YYYY-MM-DD
 * @param {string} [unitType="kg"]
 * @returns {number|null} Null only when there are no weigh-ins at all.
 */
export function bodyweightAt(series, date, unitType = "kg") {
  const kg = bodyweightKgAt(series, date);
  return kg === null ? null : convertWeight(kg, "kg", unitType);
}

function bodyweightKgAt(series, date) {
  if (!series?.length || !date) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (date <= first.date) return first.kg;
  if (date >= last.date) return last.kg;

  // The last weigh-in on or before the date. Dates compare as text.
  let low = 0;
  let high = series.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (series[middle].date <= date) low = middle;
    else high = middle - 1;
  }
  const before = series[low];
  if (before.date === date) return before.kg;
  const after = series[low + 1];
  const span = dayNumber(after.date) - dayNumber(before.date);
  const into = dayNumber(date) - dayNumber(before.date);
  return before.kg + ((after.kg - before.kg) * into) / span;
}

/** The newest weigh-in, or null. */
export function getLatestWeighIn(series) {
  return series?.length ? series[series.length - 1] : null;
}

/**
 * The newest weigh-in on or before a date, and how far it moved from the one
 * before it, for a label such as "↓0.4 since Thu".
 */
export function getWeighInChange(series, date) {
  if (!series?.length) return null;
  let index = -1;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].date <= date) {
      index = i;
      break;
    }
  }
  if (index < 1) return null;
  const current = series[index];
  const previous = series[index - 1];
  return {
    current,
    previous,
    changeKg: current.kg - previous.kg,
  };
}

/**
 * The series sampled for a chart: every real weigh-in, plus a point on the
 * interpolated line at each date asked for (lift dates, say), so a second
 * line can be drawn against it.
 */
export function bodyweightOnDates(series, dates, unitType = "kg") {
  if (!series?.length) return [];
  return dates.map((date) => ({
    date,
    bodyweight: bodyweightAt(series, date, unitType),
  }));
}

const LINE =
  /^\s*([^\s,;\t]+)[\s,;\t]+(\d[\d.,]*\s*(?:kgs?|lbs?|kilos?|pounds?)?)(?:[\s,;\t]+(.*))?$/i;

/**
 * Read a pasted table of weigh-ins. Later lines for the same date win. Dates
 * after today are left out, along with any line that has no date or weight.
 */
export function parseWeighInTable(text, { unit, todayIso, bodyweightSeries }) {
  const localeHint =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const byDate = new Map();
  let skipped = 0;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    // Blank lines and a header row ("Date, Weight") say nothing to skip.
    if (!/\d/.test(line)) continue;
    const match = LINE.exec(line);
    const date = match ? normalizeDateInput(match[1], localeHint) : null;
    if (!match || !date || date > todayIso) {
      skipped += 1;
      continue;
    }
    const { value, unitType, _explicitUnit } = convertWeightAndUnitType(
      match[2].replace(/\s+/g, ""),
    );
    if (!(value > 0)) {
      skipped += 1;
      continue;
    }
    byDate.set(date, {
      date,
      weight: roundTenth(value),
      unitType: _explicitUnit ? unitType : unit,
      notes: (match[3] ?? "").trim(),
    });
  }

  const existing = new Map(
    (bodyweightSeries ?? []).map((weighIn) => [weighIn.date, weighIn]),
  );
  const rows = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const before = existing.get(row.date);
      if (!before) return { ...row, status: "new" };
      const sameWeight =
        Math.abs(convertWeight(row.weight, row.unitType, "kg") - before.kg) <
        0.05;
      const sameNotes = !row.notes || row.notes === (before.notes ?? "");
      if (sameWeight && sameNotes) return { ...row, status: "same" };
      return {
        ...row,
        status: "update",
        previous: `${before.value} ${before.unitType}`,
      };
    });
  return { rows, skipped };
}

function roundTenth(value) {
  return Math.round(Number(value) * 10) / 10;
}

function dayNumber(date) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
