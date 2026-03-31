/**
 * Shared file-import workflow used by the main /import page.
 * Preserve route-specific follow-up behavior: some entry points want to stay on
 * /import after parsing, while hero-driven imports should bounce home in preview mode.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  FileUp,
  Loader2,
  NotebookText,
  X,
} from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  getStandardForLiftDate,
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useToast } from "@/hooks/use-toast";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  analyzeImportedEntries,
  deduplicateImportedEntries,
} from "@/lib/import/dedupe";
import { postImportHistory } from "@/lib/import-history-client";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { PENDING_SHEET_ACTIONS } from "@/lib/pending-sheet-action";
import { DailyHeatmap } from "@/components/home-dashboard/the-long-game-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function getReadableDateShort(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ImportedDataOverview({ parsedData }) {
  const { age, bodyWeight, sex, isMetric } = useAthleteBio();
  const hasBio = age && bodyWeight && sex;

  const stats = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return null;
    const entries = parsedData.filter((e) => !e.isGoal);
    if (entries.length === 0) return null;

    const dates = [...new Set(entries.map((e) => e.date))].sort();

    // Build lift map: frequency + best E1RM set per lift
    const liftMap = {};
    for (const e of entries) {
      if (!e.weight || e.weight <= 0 || !e.reps || e.reps <= 0) continue;
      if (!liftMap[e.liftType]) {
        liftMap[e.liftType] = { count: 0, bestE1RM: 0, bestSet: null };
      }
      liftMap[e.liftType].count++;
      const e1rm = estimateE1RM(e.reps, e.weight, "Brzycki");
      if (e1rm > liftMap[e.liftType].bestE1RM) {
        liftMap[e.liftType].bestE1RM = e1rm;
        liftMap[e.liftType].bestSet = e;
      }
    }

    const preferredUnit = isMetric ? "kg" : "lb";
    const topLifts = Object.entries(liftMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, { count, bestE1RM, bestSet }]) => {
        const needsConversion = bestSet.unitType !== preferredUnit;
        const displayWeight = needsConversion
          ? Math.round(
              (preferredUnit === "kg"
                ? bestSet.weight / 2.2046
                : bestSet.weight * 2.2046) * 10,
            ) / 10
          : bestSet.weight;
        const displayE1RM = needsConversion
          ? Math.round(
              preferredUnit === "kg"
                ? bestE1RM / 2.2046
                : bestE1RM * 2.2046,
            )
          : bestE1RM;
        return {
          name,
          count,
          bestE1RM: displayE1RM,
          reps: bestSet.reps,
          weight: displayWeight,
          unitType: preferredUnit,
          date: bestSet.date,
        };
      });

    return {
      sessionCount: dates.length,
      totalSets: entries.length,
      dateRange: { first: dates[0], last: dates[dates.length - 1] },
      liftTypeCount: Object.keys(liftMap).length,
      topLifts,
    };
  }, [parsedData, isMetric]);

  const yearIntervals = useMemo(() => {
    if (!stats?.dateRange?.first || !stats?.dateRange?.last) return [];
    const startYear = new Date(stats.dateRange.first).getFullYear();
    const endYear = new Date(stats.dateRange.last).getFullYear();
    const intervals = [];
    for (let year = endYear; year >= startYear; year--) {
      intervals.push({
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        year,
      });
    }
    return intervals;
  }, [stats]);

  if (!stats) return null;

  const buildCalcUrl = (reps, weight, unitType) => {
    const calcIsMetric = unitType === "kg";
    return `/calculator?reps=${JSON.stringify(reps)}&weight=${JSON.stringify(weight)}&calcIsMetric=${JSON.stringify(calcIsMetric)}&formula=${JSON.stringify("Brzycki")}`;
  };

  return (
    <div className="mt-4 w-full text-left">
      {/* Summary line */}
      <div className="text-muted-foreground mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-sm">
        <span>
          <strong className="text-foreground">{stats.sessionCount}</strong>{" "}
          sessions
        </span>
        <span aria-hidden="true" className="text-border">
          &bull;
        </span>
        <span>
          <strong className="text-foreground">{stats.totalSets}</strong> sets
        </span>
        <span aria-hidden="true" className="text-border">
          &bull;
        </span>
        <span>
          <strong className="text-foreground">{stats.liftTypeCount}</strong>{" "}
          exercises
        </span>
        <span aria-hidden="true" className="text-border">
          &bull;
        </span>
        <span>
          {getReadableDateShort(stats.dateRange.first)} to{" "}
          {getReadableDateShort(stats.dateRange.last)}
        </span>
      </div>

      {/* Two-column layout: heatmaps + top lifts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Activity heatmaps — yearly breakdown */}
        {yearIntervals.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Training activity
            </p>
            <div className="flex flex-col gap-2">
              {yearIntervals.map((interval) => {
                const isCurrentYear =
                  interval.year === new Date().getFullYear();
                return (
                  <div
                    key={interval.year}
                    className="flex items-start gap-3"
                  >
                    <span
                      className={`shrink-0 pt-1 text-right text-xs tabular-nums ${
                        isCurrentYear
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/70"
                      }`}
                      style={{ width: 36 }}
                    >
                      {interval.year}
                    </span>
                    <div
                      className={`min-w-0 flex-1 ${isCurrentYear ? "" : "opacity-80"}`}
                    >
                      <DailyHeatmap
                        parsedData={parsedData}
                        startDate={interval.startDate}
                        endDate={interval.endDate}
                        isSharing={false}
                        showMonthLabels={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top lifts with best E1RM */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Top lifts
          </p>
          <div className="space-y-2">
            {stats.topLifts.map((lift) => {
              const strengthRating =
                hasBio
                  ? (() => {
                      const standard = getStandardForLiftDate(
                        age,
                        lift.date,
                        bodyWeight,
                        sex,
                        lift.name,
                        isMetric,
                      );
                      return standard
                        ? getStrengthRatingForE1RM(lift.bestE1RM, standard)
                        : null;
                    })()
                  : null;

              return (
                <div
                  key={lift.name}
                  className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {lift.name}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {lift.count} sets &middot; Best:{" "}
                      {lift.reps}x{lift.weight}
                      {lift.unitType} on {getReadableDateShort(lift.date)}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <Link
                      href={buildCalcUrl(lift.reps, lift.weight, lift.unitType)}
                      className="text-primary text-sm font-semibold tabular-nums hover:underline"
                    >
                      E1RM: {lift.bestE1RM}
                      {lift.unitType}
                    </Link>
                    {strengthRating && (
                      <div className="text-muted-foreground text-xs">
                        {STRENGTH_LEVEL_EMOJI[strengthRating]} {strengthRating}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportWorkflowSection({
  title = "Import from Another App",
  description,
}) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();
  const {
    sheetInfo,
    mutate,
    isLoading,
    parsedData,
    importFile,
    clearImportedData,
    isImportedData,
    importedFormatName,
    sheetParsedData,
  } = useUserLiftingData();

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [merging, setMerging] = useState(false);

  const isAuthenticated = authStatus === "authenticated" && !!session;
  const canMerge = !!sheetInfo?.ssid;
  const mergeMode = isAuthenticated && canMerge;
  const createMode = isAuthenticated && !canMerge;
  const isSheetComparisonPending =
    mergeMode && isLoading && !Array.isArray(sheetParsedData);
  const sheetName = sheetInfo?.filename || "your Google Sheet";
  const returnToPath =
    typeof router.query?.returnTo === "string"
      ? router.query.returnTo
      : router.query?.from === "hero"
        ? "/"
        : null;

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "txt", "xls", "xlsx"].includes(ext)) {
        setImportError(
          "Unsupported file type. Please use a .csv, .xls, or .xlsx file.",
        );
        return;
      }

      setImporting(true);
      setImportError(null);
      try {
        const { count, formatName } = await importFile(file);

        if (returnToPath) {
          toast({
            title: "Data loaded!",
            description: `Parsed ${count} entries from ${formatName} format. Exploring in preview mode.`,
          });
          router.push(returnToPath);
          return;
        }

        toast({
          title: "Data loaded!",
          description: `Parsed ${count} entries from ${formatName} format.`,
        });
      } catch (err) {
        setImportError(err.message);
      } finally {
        setImporting(false);
      }
    },
    [importFile, returnToPath, router, toast],
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer?.files?.[0]);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const writeEntriesToSheet = useCallback(async (targetSsid, entries) => {
    const apiEntries = entries.map((entry) => ({
      date: entry.date,
      liftType: entry.liftType,
      reps: entry.reps,
      weight: entry.weight,
      unitType: entry.unitType || "kg",
    }));

    const res = await postImportHistory(
      { ssid: targetSsid, entries: apiEntries },
      { source: "import_workflow", formatName: importedFormatName },
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to write data to sheet");
    }
    return data;
  }, [importedFormatName]);

  const handleMerge = useCallback(async () => {
    if (!parsedData || !sheetInfo?.ssid) return;
    if (isSheetComparisonPending) {
      toast({
        title: "Still checking your sheet",
        description: "Wait a moment so Strength Journeys can compare this preview against your linked data.",
      });
      return;
    }

    const { newEntries, skippedCount } = deduplicateImportedEntries(
      parsedData,
      sheetParsedData,
    );

    if (newEntries.length === 0) {
      toast({
        title: "Nothing new to merge",
        description: `All ${skippedCount} entries already exist in your linked sheet.`,
      });
      return;
    }

    setMerging(true);
    try {
      const data = await writeEntriesToSheet(sheetInfo.ssid, newEntries);
      const skippedNote =
        skippedCount > 0
          ? ` Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
          : "";

      toast({
        title: "Data merged into your linked sheet!",
        description: `Added ${data.insertedRows} rows across ${data.dateCount} date${data.dateCount === 1 ? "" : "s"}.${skippedNote}`,
      });

      clearImportedData();
      mutate();
      router.push("/");
    } catch (err) {
      toast({
        title: "Merge failed",
        description: err.message || "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  }, [
    clearImportedData,
    mutate,
    parsedData,
    router,
    sheetInfo,
    sheetParsedData,
    isSheetComparisonPending,
    toast,
    writeEntriesToSheet,
  ]);

  const handleCreateSheetFromImport = useCallback(() => {
    if (!parsedData || parsedData.length === 0) return;

    // Route preview saves through the shared sheet dialog so the rare missing-
    // scope recovery rail stays in one place instead of becoming a page mode.
    openSheetSetupDialog("bootstrap", {
      action: PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT,
    });
  }, [parsedData]);

  if (isImportedData) {
    const entryCount =
      parsedData?.filter((entry) => !entry.isGoal)?.length || 0;
    const showCreateSheet = isAuthenticated && !sheetInfo?.ssid;
    const showMerge = isAuthenticated && !showCreateSheet && canMerge;
    const importAnalysis = showMerge
      ? analyzeImportedEntries(parsedData || [], sheetParsedData)
      : null;
    const newEntries =
      importAnalysis?.newEntries ||
      parsedData?.filter((entry) => !entry.isGoal) ||
      [];
    const skippedCount = importAnalysis?.duplicateCount || 0;
    const isFullyDuplicate =
      importAnalysis?.status === "already_in_linked_sheet";
    const isPartialOverlap = importAnalysis?.status === "partial_overlap";

    return (
      <section className="mx-auto mb-12 max-w-5xl">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            {merging ? (
              <>
                <Loader2 className="text-primary mb-3 h-10 w-10 animate-spin" />
                <h3 className="mb-1 font-semibold">
                  {showCreateSheet
                    ? "Creating your Google Sheet..."
                    : "Merging into your linked sheet..."}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {showCreateSheet
                    ? `Setting up a new Strength Journeys sheet with ${entryCount} entries.`
                    : `Adding ${newEntries.length} new entries to your linked sheet.`}
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="text-primary mb-3 h-10 w-10" />
                <h3 className="mb-1 font-semibold">
                  {showMerge && isFullyDuplicate
                    ? "Already in your linked sheet"
                    : importedFormatName + " data loaded"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {showMerge && isFullyDuplicate
                    ? `All ${skippedCount} ${skippedCount === 1 ? "entry" : "entries"} from this file already exist in your linked sheet.`
                    : `${entryCount} ${entryCount === 1 ? "entry" : "entries"} parsed and ready.`}
                </p>

                {showCreateSheet && (
                  <div className="w-full max-w-md space-y-3">
                    <p className="text-muted-foreground text-sm">
                      We&apos;ll create a new Google Sheet in your Drive and
                      populate it with your {entryCount}{" "}
                      {entryCount === 1 ? "entry" : "entries"}. This becomes
                      your permanent data backend - fully yours.
                    </p>
                    <Button
                      onClick={handleCreateSheetFromImport}
                      disabled={entryCount === 0}
                      className="w-full gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Create Google Sheet with this data
                    </Button>
                  </div>
                )}

                {showMerge && (
                  <div className="w-full max-w-md space-y-3">
                    <p className="text-muted-foreground text-sm">
                      {isSheetComparisonPending
                        ? "Checking your linked Strength Journeys sheet for duplicates before merge."
                        : isFullyDuplicate
                        ? `This file already matches your linked Strength Journeys sheet. All ${skippedCount} ${skippedCount === 1 ? "entry" : "entries"} are already there.`
                        : isPartialOverlap
                          ? `${newEntries.length} new ${newEntries.length === 1 ? "entry" : "entries"} can be merged into your linked Strength Journeys sheet. ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} will be skipped.`
                          : `Merge this data into your linked Strength Journeys sheet.${skippedCount > 0 ? ` ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} will be skipped.` : ""}`}
                    </p>
                    {newEntries.length > 0 ? (
                      <Button
                        onClick={handleMerge}
                        className="w-full gap-2"
                        disabled={isSheetComparisonPending}
                      >
                        <ArrowRight className="h-4 w-4" />
                        {isSheetComparisonPending
                          ? "Checking linked sheet..."
                          : `Merge ${newEntries.length} ${newEntries.length === 1 ? "entry" : "entries"} into linked sheet`}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        No merge is needed. You can clear this preview or import
                        a different file.
                      </p>
                    )}
                  </div>
                )}

                {!isAuthenticated && (
                  <>
                    <ImportedDataOverview parsedData={parsedData} />
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push("/")}
                      >
                        <Dumbbell className="mr-2 h-4 w-4" /> Explore Home
                        Dashboard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/log")}
                      >
                        <NotebookText className="mr-2 h-4 w-4" /> Browse Your
                        Sessions
                      </Button>
                      <GoogleSignInButton
                        size="sm"
                        cta="import_overview"
                      >
                        Save my data
                      </GoogleSignInButton>
                    </div>
                  </>
                )}

                <Separator className="my-5 w-full" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearImportedData();
                    toast({ title: "Imported data cleared" });
                  }}
                >
                  <X className="mr-2 h-4 w-4" /> Clear &amp; start over
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto mb-12 max-w-5xl">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-3xl text-sm leading-6">
          {description}
        </p>
      )}
      <Card
        className={`border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          {importing ? (
            <>
              <Loader2 className="text-muted-foreground mb-4 h-12 w-12 animate-spin" />
              <h3 className="mb-2 font-semibold">Parsing file...</h3>
            </>
          ) : (
            <>
              <FileUp className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 font-semibold">
                Drop your lifting history here
              </h3>
              <p className="text-muted-foreground mb-1 max-w-md text-sm">
                {mergeMode ? (
                  <>
                    Preview your data before merging into your sheet.
                  </>
                ) : createMode ? (
                  "We'll create a Google Sheet in your Drive and populate it with your data — ready to explore."
                ) : (
                  "CSV or Excel from Hevy, Strong, Wodify, BTWB, TurnKey, or any spreadsheet export."
                )}
              </p>
              {mergeMode && (
                <p className="text-muted-foreground mb-3 max-w-md text-xs">
                  We&apos;ll show you a full preview first - then you can
                  choose to merge it into{" "}
                  <strong className="text-foreground">
                    &ldquo;{sheetName}&rdquo;
                  </strong>
                  .
                </p>
              )}
              {!isAuthenticated && (
                <p className="text-muted-foreground mb-3 flex items-center justify-center gap-3 text-xs">
                  <span>No account required</span>
                  <span aria-hidden="true" className="text-border">
                    &bull;
                  </span>
                  <span>Instant preview</span>
                </p>
              )}
              <Button
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-2 h-4 w-4" /> Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {mergeMode && (
                <p className="text-muted-foreground mt-4 max-w-sm text-xs">
                  No changes are made until you confirm the merge.
                </p>
              )}
            </>
          )}
          {importError && (
            <p className="text-destructive mt-4 max-w-md text-sm">
              {importError}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
