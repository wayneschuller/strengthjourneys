/**
 * Detects narrow, high-confidence date typo candidates in parsed lifting data.
 * The detector is intentionally conservative: it only suggests changing the
 * year when the same month/day would place an out-of-order workout between its
 * neighboring sheet sections.
 */

import { getReadableDateString } from "@/lib/date-utils";

const MIN_YEAR_TYPO_DISTANCE_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDateOutlierWarnings(parsedData, options = {}) {
  if (!Array.isArray(parsedData) || parsedData.length < 3) return [];
  if (options.isDemoMode) return [];

  const sections = getContiguousDateSections(parsedData);
  if (sections.length < 3) return [];

  const warnings = [];

  for (let index = 1; index < sections.length - 1; index += 1) {
    const previous = sections[index - 1];
    const current = sections[index];
    const next = sections[index + 1];
    const suggestion = getYearCorrectionCandidate({
      currentDate: current.date,
      previousDate: previous.date,
      nextDate: next.date,
    });

    if (!suggestion) continue;

    warnings.push({
      type: "date-outlier",
      severity: "warning",
      signature: [
        "date-outlier",
        `rows-${current.startRowIndex}-${current.endRowIndex}`,
        current.date,
        suggestion,
      ].join(":"),
      rowIndex: current.startRowIndex,
      startRowIndex: current.startRowIndex,
      endRowIndex: current.endRowIndex,
      currentDate: current.date,
      suggestedDate: suggestion,
      previousDate: previous.date,
      nextDate: next.date,
      affectedSetCount: current.entries.length,
      affectedLiftTypes: [...current.liftTypes],
      title: "Possible date typo",
      actionLabel: `Fix year to ${suggestion.slice(0, 4)}`,
      message: buildDateOutlierMessage({
        currentDate: current.date,
        suggestedDate: suggestion,
        previousDate: previous.date,
        nextDate: next.date,
        affectedSetCount: current.entries.length,
      }),
    });
  }

  return warnings.slice(0, 3);
}

export function applyDateOutlierPreviewFix(parsedData, warning) {
  if (!Array.isArray(parsedData) || warning?.type !== "date-outlier") {
    return parsedData;
  }

  const start = warning.startRowIndex;
  const end = warning.endRowIndex;
  const hasRowRange = Number.isFinite(start) && Number.isFinite(end);

  const nextData = parsedData.map((entry) => {
    const rowMatches =
      hasRowRange &&
      Number.isFinite(entry.rowIndex) &&
      entry.rowIndex >= start &&
      entry.rowIndex <= end;
    const dateMatches = entry.date === warning.currentDate;

    if (!(rowMatches || (!hasRowRange && dateMatches)) || !dateMatches) {
      return entry;
    }

    return { ...entry, date: warning.suggestedDate };
  });

  nextData.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.rowIndex ?? 0) - (b.rowIndex ?? 0);
  });

  return nextData;
}

function getContiguousDateSections(parsedData) {
  const rowBackedEntries = parsedData
    .filter(
      (entry) =>
        !entry.isGoal &&
        entry.date &&
        Number.isFinite(entry.rowIndex),
    )
    .slice()
    .sort((a, b) => a.rowIndex - b.rowIndex);

  const sections = [];

  for (const entry of rowBackedEntries) {
    const current = sections[sections.length - 1];
    if (!current || current.date !== entry.date) {
      sections.push({
        date: entry.date,
        startRowIndex: entry.rowIndex,
        endRowIndex: entry.rowIndex,
        entries: [entry],
        liftTypes: new Set([entry.liftType].filter(Boolean)),
      });
      continue;
    }

    current.endRowIndex = Math.max(current.endRowIndex, entry.rowIndex);
    current.entries.push(entry);
    if (entry.liftType) current.liftTypes.add(entry.liftType);
  }

  return sections;
}

function getYearCorrectionCandidate({ currentDate, previousDate, nextDate }) {
  if (!isYmd(currentDate) || !isYmd(previousDate) || !isYmd(nextDate)) {
    return null;
  }

  const currentYear = currentDate.slice(0, 4);
  const monthDay = currentDate.slice(4);
  const neighborYears = new Set([
    previousDate.slice(0, 4),
    nextDate.slice(0, 4),
  ]);

  for (const year of neighborYears) {
    if (year === currentYear) continue;
    const candidate = `${year}${monthDay}`;
    if (!isYmd(candidate)) continue;
    if (!isBetweenInclusive(candidate, previousDate, nextDate)) continue;
    if (isBetweenInclusive(currentDate, previousDate, nextDate)) continue;
    if (dayDistance(currentDate, candidate) < MIN_YEAR_TYPO_DISTANCE_DAYS) {
      continue;
    }
    return candidate;
  }

  return null;
}

function buildDateOutlierMessage({
  currentDate,
  suggestedDate,
  previousDate,
  nextDate,
  affectedSetCount,
}) {
  const setLabel = affectedSetCount === 1 ? "set" : "sets";
  const suggestedYear = suggestedDate.slice(0, 4);
  const currentYear = currentDate.slice(0, 4);
  const sequenceLabel = getMonthYearLabel(suggestedDate);

  return `We found ${affectedSetCount.toLocaleString()} ${setLabel} in your ${sequenceLabel} sequence with the year set to ${currentYear}. ${formatReadableDateWithYear(suggestedDate)} would fit between ${formatReadableDateWithYear(previousDate)} and ${formatReadableDateWithYear(nextDate)}. Did you mean to use ${suggestedYear} instead?`;
}

function getMonthYearLabel(date) {
  return formatReadableDateWithYear(date)
    .replace(/\s+\d{1,2},?\s+/, " ")
    .trim();
}

function formatReadableDateWithYear(date) {
  const readable = getReadableDateString(date);
  const year = date.slice(0, 4);
  return readable.includes(year) ? readable : `${readable}, ${year}`;
}

function isBetweenInclusive(date, a, b) {
  const min = a < b ? a : b;
  const max = a < b ? b : a;
  return date >= min && date <= max;
}

function dayDistance(a, b) {
  return (
    Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
    MS_PER_DAY
  );
}

function isYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
