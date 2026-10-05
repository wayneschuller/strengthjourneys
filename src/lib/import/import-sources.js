/*
 * Stable identities and presentation helpers for every supported import source.
 * Parser display names may evolve, but persisted ritual metadata must keep using
 * durable IDs so returning users can switch formats without losing continuity.
 *
 * This is the one place a format's id and display name are written. Each
 * parser takes its own from requireImportSource(), and the dispatcher takes
 * them from the parser. Keep this file free of parser imports: the import
 * profile API reads it on a best-effort path and should not load nine parsers
 * to look up a name.
 */

const IMPORT_SOURCES = [
  { id: "hevy", name: "Hevy" },
  { id: "strong", name: "Strong" },
  { id: "stronglifts", name: "StrongLifts" },
  { id: "fitbod", name: "Fitbod" },
  { id: "fitnotes", name: "FitNotes" },
  { id: "wodify", name: "Wodify" },
  { id: "btwb", name: "BTWB" },
  // A coach's app: its date is the day a workout was scheduled, which is
  // often a day or more from the day it was lifted. The merge allows for that
  // when it looks for sets already in the sheet (see dedupe.js). The apps a
  // lifter logs in themselves date a set by when it happened.
  { id: "turnkey", name: "TurnKey", scheduledDates: true },
  { id: "strength-journeys", name: "Strength Journeys" },
];

const SOURCES_BY_ID = new Map(
  IMPORT_SOURCES.map((source) => [source.id, source]),
);

const SOURCE_ALIASES = new Map([
  ["stronglifts 5x5", "stronglifts"],
  ["strength journeys csv", "strength-journeys"],
  ["external", "external"],
  ["unknown", "external"],
]);

// A parser's own identity. Unlike getImportSource below, which forgives
// whatever an old profile stored, this throws on an id not listed above, so a
// typo in a parser fails when the module loads instead of importing a
// lifter's file as "External".
export function requireImportSource(id) {
  const source = SOURCES_BY_ID.get(id);
  if (!source) throw new Error(`No import source is declared for "${id}".`);
  return source;
}

export function getImportSource({ formatId, formatName } = {}) {
  const requestedId = String(formatId || "")
    .trim()
    .toLowerCase();
  if (SOURCES_BY_ID.has(requestedId)) return SOURCES_BY_ID.get(requestedId);

  const normalizedName = String(formatName || "")
    .trim()
    .toLowerCase();
  const aliasedId = SOURCE_ALIASES.get(normalizedName);
  if (aliasedId === "external") {
    return { id: "external", name: formatName || "External" };
  }
  if (aliasedId && SOURCES_BY_ID.has(aliasedId)) {
    return SOURCES_BY_ID.get(aliasedId);
  }

  const matched = IMPORT_SOURCES.find(
    (source) => source.name.toLowerCase() === normalizedName,
  );
  if (matched) return matched;

  return {
    id: requestedId || "external",
    name: String(formatName || "External").trim() || "External",
  };
}

export function getLatestImportedWorkoutDate(entries = []) {
  let latestDate = null;
  for (const entry of entries) {
    const date = typeof entry?.date === "string" ? entry.date : null;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      (!latestDate || date > latestDate)
    ) {
      latestDate = date;
    }
  }
  return latestDate;
}

export function getRepeatImportHref(profile, surface = "repeat-import") {
  const params = new URLSearchParams({ source: surface });
  if (profile?.lastSourceId) params.set("preferred", profile.lastSourceId);
  return `/import?${params.toString()}`;
}

// How to name the last import's source in a sentence. A lifter who uploaded
// their own Strength Journeys export is already in Strength Journeys, so the
// bare name reads as the app rather than as a file they brought in.
export function getLastImportSourcePhrase(profile) {
  if (profile?.lastSourceId === "strength-journeys") {
    return "a Strength Journeys export";
  }
  return profile?.lastSourceName || "another app";
}

export function formatWorkoutFreshnessDate(date, locale = undefined) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export { IMPORT_SOURCES };
