/**
 * The one home for writing an import into a lifter's sheet.
 *
 * Three screens can start a merge (the import page, the preview banner and
 * the sheet setup dialog) and two more write a whole import into a sheet that
 * was just created. They used to each carry their own copy of the steps, and
 * the copies drifted. Everything that decides what a merge does, and what the
 * lifter is told about it, is here: the duplicate check, the question asked
 * before sets are added for lifts already logged that day, the outcome, the
 * record kept of it, and the wording. A screen calls `merge` and decides only
 * where to go afterwards.
 *
 * Nothing here touches React, the network or the browser. The one write
 * comes in through `io`, which is what lets scripts/validate-import-merge.mjs
 * run these exact rules. The app's own instance is in
 * src/hooks/use-import-merge.js.
 */

import {
  analyzeImportedEntries,
  describeNearbyDuplicates,
  describeOverlappingSets,
} from "@/lib/import/dedupe";
import { getLatestImportedWorkoutDate } from "@/lib/import/import-sources";

/** A set as the import route takes it. */
export function toSheetEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    date: entry.date,
    liftType: entry.liftType,
    reps: entry.reps,
    weight: entry.weight,
    unitType: entry.unitType || "kg",
    ...(entry.notes ? { notes: entry.notes } : {}),
  }));
}

// The duplicate check walks every set in the import and the sheet, and each
// screen showing a preview asks for it on every render. They all hold the
// same two arrays, so the last answer is kept and handed to each of them.
let lastComparison = null;

/**
 * What an import would add to a sheet, and what the sheet already has.
 *
 * @returns {object} See analyzeImportedEntries in dedupe.js.
 */
export function compareImportToSheet(importedEntries, sheetEntries, formatId) {
  if (
    lastComparison &&
    lastComparison.importedEntries === importedEntries &&
    lastComparison.sheetEntries === sheetEntries &&
    lastComparison.formatId === formatId
  ) {
    return lastComparison.result;
  }
  const result = analyzeImportedEntries(importedEntries || [], sheetEntries, {
    formatId,
  });
  lastComparison = { importedEntries, sheetEntries, formatId, result };
  return result;
}

// The record of an import the server keeps beside the lifter's import
// profile: what was offered and what became of it.
function buildImportSummary(importedEntries, comparison) {
  const { newEntriesCount, duplicateCount, conflictCount } = comparison;
  return {
    outcome:
      newEntriesCount > 0
        ? "merged"
        : conflictCount > 0
          ? "conflicts_only"
          : "already_current",
    candidateEntryCount: importedEntries.length,
    skippedCount: duplicateCount,
    conflictCount,
    latestWorkoutDate: getLatestImportedWorkoutDate(importedEntries),
  };
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

// --- What the lifter is told -------------------------------------------------
//
// One wording for every screen. Each returns a toast: title, description and,
// where it matters, a variant or duration.

function checkingNotice() {
  return {
    title: "Still checking your sheet",
    description:
      "Wait a moment so Strength Journeys can compare this preview against your linked data.",
  };
}

function askNotice(question) {
  return {
    title: "Your sheet may already have these",
    description: `${question} Press merge again to add them.`,
    duration: 20000,
  };
}

function mergedNotice({ data, comparison, formatName }) {
  const { duplicateCount, nearbyCount, conflictCount } = comparison;
  const skippedNote =
    duplicateCount > 0
      ? ` Skipped ${duplicateCount} ${plural(duplicateCount, "duplicate", "duplicates")}.`
      : "";
  const conflictNote =
    conflictCount > 0
      ? ` Left ${conflictCount} changed ${plural(conflictCount, "set", "sets")} untouched for review.`
      : "";
  return {
    title: "Merged into your sheet",
    description: `Added ${data.insertedRows} rows across ${data.dateCount} ${plural(data.dateCount, "date", "dates")}.${skippedNote}${describeNearbyDuplicates(nearbyCount, formatName)}${conflictNote}`,
  };
}

function alreadyCurrentNotice({ comparison, formatName }) {
  return {
    title: "Your training data is already up to date",
    description: `All ${comparison.duplicateCount} entries already exist in your sheet.${describeNearbyDuplicates(comparison.nearbyCount, formatName)} You can still import another supported format at any time.`,
  };
}

function conflictsOnlyNotice({ conflictCount }) {
  return {
    title: "Changed sets need review",
    description: `${conflictCount} ${plural(conflictCount, "set has", "sets have")} matching source details but different lifting data. Nothing was overwritten.`,
    variant: "destructive",
  };
}

function failedNotice(error) {
  return {
    title: "Merge failed",
    description: error?.message || "Something went wrong. Please try again.",
    variant: "destructive",
  };
}

/**
 * @param {object} io
 * @param {(request: {ssid: string, entries: object[], source: string,
 *   formatId?: string, formatName?: string, importSummary?: object,
 *   trackImportRitual?: boolean}) => Promise<{insertedRows: number,
 *   dateCount: number}>} io.write Writes sets into the sheet and records the
 *   import. Resolves with what the route answered; rejects when it refused.
 */
export function createImportWriter(io) {
  // The comparison the lifter was last asked about, so the second press of a
  // merge button goes ahead. A different file, or a sheet that has changed
  // since, is asked afresh. Shared by every screen: asked on one, answered
  // on any.
  let askedAbout = null;
  // The last comparison recorded as having nothing to add, so looking at a
  // preview and then pressing merge on it is one record, not two.
  let recordedComparison = null;

  function comparisonKey({ ssid, importedEntries, comparison, formatId }) {
    return [
      ssid,
      formatId || "unknown",
      importedEntries.length,
      getLatestImportedWorkoutDate(importedEntries),
      comparison.duplicateCount,
      comparison.conflictCount,
    ].join(":");
  }

  // Tell the server an import was looked at and had nothing to add. It is
  // convenience metadata for the lifter's import profile, so a failure here
  // is never the lifter's problem.
  async function recordNothingToAdd(input, comparison) {
    const key = comparisonKey({ ...input, comparison });
    if (recordedComparison === key) return;
    recordedComparison = key;
    try {
      await io.write({
        ssid: input.ssid,
        entries: [],
        source: input.source,
        formatId: input.formatId,
        formatName: input.formatName,
        importSummary: buildImportSummary(input.importedEntries, comparison),
      });
    } catch {
      // The preview is still right without the record.
    }
  }

  return {
    /**
     * Merge an import preview into the lifter's linked sheet.
     *
     * @param {object} input
     * @param {string} input.ssid The linked sheet.
     * @param {object[]} input.importedEntries The preview's sets.
     * @param {object[]|null} input.sheetEntries The sheet's parsed rows.
     * @param {boolean} input.comparisonPending The sheet has not loaded yet.
     * @param {string} [input.formatId]
     * @param {string} [input.formatName]
     * @param {string} input.source Which screen asked, for analytics.
     * @param {object} [hooks]
     * @param {() => void} [hooks.onWriteStart] Called just before the sheet
     *   is written to, so a screen shows "saving" only while something is.
     * @returns {Promise<{status: "not_ready"|"checking"|"asked"|"merged"|
     *   "already_current"|"conflicts_only"|"failed", notice: object|null,
     *   previewDone: boolean, comparison?: object, data?: object,
     *   error?: Error}>} `notice` is the toast to show. `previewDone` is true
     *   when everything in the preview is now in the sheet, so the preview
     *   can be cleared; changed sets left for review keep it open.
     */
    async merge(input, { onWriteStart } = {}) {
      const { ssid, importedEntries, sheetEntries, formatId, formatName } =
        input;
      const still = (status, notice, extra = {}) => ({
        status,
        notice,
        previewDone: false,
        ...extra,
      });

      if (!ssid || !Array.isArray(importedEntries) || !importedEntries.length) {
        return still("not_ready", null);
      }
      if (input.comparisonPending) return still("checking", checkingNotice());

      const comparison = compareImportToSheet(
        importedEntries,
        sheetEntries,
        formatId,
      );
      const { newEntries, overlapCount, conflictCount } = comparison;

      const question = describeOverlappingSets(
        overlapCount,
        newEntries.length,
        formatId,
      );
      if (question) {
        const asking = `${formatId}|${newEntries.length}|${overlapCount}`;
        if (askedAbout !== asking) {
          askedAbout = asking;
          return still("asked", askNotice(question), { comparison });
        }
      }

      if (newEntries.length === 0) {
        onWriteStart?.();
        await recordNothingToAdd(input, comparison);
        return conflictCount > 0
          ? still("conflicts_only", conflictsOnlyNotice(comparison), {
              comparison,
            })
          : still(
              "already_current",
              alreadyCurrentNotice({ comparison, formatName }),
              { comparison },
            );
      }

      onWriteStart?.();
      try {
        const data = await io.write({
          ssid,
          entries: toSheetEntries(newEntries),
          source: input.source,
          formatId,
          formatName,
          importSummary: buildImportSummary(importedEntries, comparison),
        });
        return {
          status: "merged",
          notice: mergedNotice({ data, comparison, formatName }),
          previewDone: conflictCount === 0,
          comparison,
          data,
        };
      } catch (error) {
        return still("failed", failedNotice(error), { comparison, error });
      }
    },

    /**
     * A preview that has nothing to add is on screen: record that it was
     * checked, once. Does nothing while there is something to merge.
     */
    async noteComparison(input) {
      const { ssid, importedEntries, sheetEntries, formatId } = input;
      if (!ssid || !Array.isArray(importedEntries) || !importedEntries.length) {
        return;
      }
      if (input.comparisonPending) return;
      const comparison = compareImportToSheet(
        importedEntries,
        sheetEntries,
        formatId,
      );
      if (comparison.newEntriesCount > 0) return;
      await recordNothingToAdd(input, comparison);
    },

    /**
     * Write every set of an import into a sheet that has nothing in it yet,
     * so there is nothing to compare against and nothing to ask.
     *
     * @returns {Promise<object>} What the route answered. Rejects when it
     *   refused; the error carries the route's `errorCode` when it sent one.
     */
    writeWholeImport({ ssid, entries, formatId, formatName, source }) {
      return io.write({
        ssid,
        entries: toSheetEntries(entries),
        source,
        formatId,
        formatName,
        importSummary: {
          outcome: "merged",
          candidateEntryCount: entries.length,
          skippedCount: 0,
          conflictCount: 0,
          latestWorkoutDate: getLatestImportedWorkoutDate(entries),
        },
      });
    },

    /**
     * Write sets the lifter typed in by hand on the import page. They came
     * from no app, so they leave the import profile alone.
     */
    writeManualEntries({ ssid, entries, source }) {
      return io.write({
        ssid,
        entries: toSheetEntries(entries),
        source,
        formatName: "Strength Journeys",
        trackImportRitual: false,
      });
    },
  };
}
