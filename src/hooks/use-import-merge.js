// Binds the import merge rules (src/lib/import/import-merge.js) to the app:
// the preview and the linked sheet from the data provider, the real write to
// the sheet, the toast, and what a finished merge does to the preview.
//
// Every place a merge can start uses this hook, and a new one must too. It is
// what keeps them asking, writing and reporting the same way. A screen takes
// `merge`, calls it from its button, and decides only where to go once the
// result says the preview is done.

import { useCallback, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { writeImportHistory } from "@/lib/import/import-history-client";
import {
  compareImportToSheet,
  createImportWriter,
} from "@/lib/import/import-merge";

/**
 * The app's one import writer. The screens that write a whole import into a
 * new sheet, or sets typed in by hand, call it directly.
 */
export const importWriter = createImportWriter({ write: writeImportHistory });

/**
 * @param {object} options
 * @param {string} options.source Which screen this is, for analytics.
 * @param {string} [options.comparisonSource] The analytics name for the
 *   record `noteComparison` keeps, on a screen that calls it.
 * @returns {{
 *   merge: () => Promise<object>,
 *   isMerging: boolean,
 *   isComparisonPending: boolean,
 *   comparison: object|null,
 *   noteComparison: () => void,
 * }} `merge` resolves with the result described on `merge` in
 *   import-merge.js, after the toast has been shown and the sheet asked to
 *   reload. `comparison` is what the preview would add to the linked sheet,
 *   or null when there is no preview or no sheet to compare it with.
 */
export function useImportMerge({ source, comparisonSource = source }) {
  const {
    dataSource,
    hasLinkedSheet,
    sheetInfo,
    parsedData,
    sheetParsedData,
    isLoading,
    importedFormatId,
    importedFormatName,
    mutate,
    clearImportedData,
  } = useUserLiftingData();
  const { toast } = useToast();
  const [isMerging, setIsMerging] = useState(false);

  // Outside a preview, `parsedData` is the sheet's own rows, which are not
  // an import of anything.
  const isPreview = dataSource === "import" && hasLinkedSheet;
  const ssid = isPreview ? (sheetInfo?.ssid ?? null) : null;
  const isComparisonPending =
    isPreview && isLoading && !Array.isArray(sheetParsedData);
  const comparison = isPreview
    ? compareImportToSheet(parsedData || [], sheetParsedData, importedFormatId)
    : null;

  const merge = useCallback(async () => {
    try {
      const result = await importWriter.merge(
        {
          ssid,
          importedEntries: parsedData,
          sheetEntries: sheetParsedData,
          comparisonPending: isComparisonPending,
          formatId: importedFormatId,
          formatName: importedFormatName,
          source,
        },
        { onWriteStart: () => setIsMerging(true) },
      );
      if (result.notice) toast(result.notice);
      if (result.status === "merged") {
        mutate();
        if (result.previewDone) clearImportedData();
      }
      return result;
    } finally {
      setIsMerging(false);
    }
  }, [
    ssid,
    parsedData,
    sheetParsedData,
    isComparisonPending,
    importedFormatId,
    importedFormatName,
    source,
    toast,
    mutate,
    clearImportedData,
  ]);

  const noteComparison = useCallback(() => {
    void importWriter.noteComparison({
      ssid,
      importedEntries: parsedData,
      sheetEntries: sheetParsedData,
      comparisonPending: isComparisonPending,
      formatId: importedFormatId,
      formatName: importedFormatName,
      source: comparisonSource,
    });
  }, [
    ssid,
    parsedData,
    sheetParsedData,
    isComparisonPending,
    importedFormatId,
    importedFormatName,
    comparisonSource,
  ]);

  return { merge, isMerging, isComparisonPending, comparison, noteComparison };
}
