/*
 * Stable identities and presentation helpers for every supported import source.
 * Parser display names may evolve, but persisted ritual metadata must keep using
 * durable IDs so returning users can switch formats without losing continuity.
 */

const IMPORT_SOURCES = [
  { id: "hevy", name: "Hevy" },
  { id: "strong", name: "Strong" },
  { id: "stronglifts", name: "StrongLifts" },
  { id: "wodify", name: "Wodify" },
  { id: "btwb", name: "BTWB" },
  { id: "turnkey", name: "TurnKey" },
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
