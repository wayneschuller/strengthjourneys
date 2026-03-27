import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  FileUp,
  Loader2,
  X,
} from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import {
  analyzeImportedEntries,
  deduplicateImportedEntries,
} from "@/lib/import/dedupe";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    parsedData,
    importFile,
    clearImportedData,
    isImportedData,
    importedFormatName,
    sheetParsedData,
    selectSheet,
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
  const sheetName = sheetInfo?.filename || "your Google Sheet";

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

        if (!isAuthenticated) {
          toast({
            title: "Data loaded!",
            description: `Parsed ${count} entries from ${formatName} format. Exploring in preview mode.`,
          });
          router.push("/");
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
    [importFile, isAuthenticated, router, toast],
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

    const res = await fetch("/api/sheet/import-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid: targetSsid, entries: apiEntries }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to write data to sheet");
    }
    return data;
  }, []);

  const handleMerge = useCallback(async () => {
    if (!parsedData || !sheetInfo?.ssid) return;

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
    toast,
    writeEntriesToSheet,
  ]);

  const handleCreateSheetFromImport = useCallback(async () => {
    if (!parsedData || parsedData.length === 0) return;

    setMerging(true);
    try {
      const linkRes = await fetch("/api/sheet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "bootstrap", mode: "create_blank" }),
      });
      const linkPayload = await linkRes.json();

      if (!linkRes.ok || !linkPayload?.ssid) {
        throw new Error(linkPayload?.error || "Failed to create Google Sheet");
      }

      const nonGoalEntries = parsedData.filter((entry) => !entry.isGoal);
      const data = await writeEntriesToSheet(linkPayload.ssid, nonGoalEntries);

      selectSheet(linkPayload.ssid, {
        url: linkPayload.webViewLink ?? null,
        filename: linkPayload.name ?? null,
        modifiedTime: linkPayload.modifiedTime ?? null,
        modifiedByMeTime: linkPayload.modifiedByMeTime ?? null,
      });

      toast({
        title: "Google Sheet created!",
        description: `Added ${data.insertedRows} entries across ${data.dateCount} date${data.dateCount === 1 ? "" : "s"} to your new sheet.`,
      });

      clearImportedData();
      mutate();
      router.push("/");
    } catch (err) {
      toast({
        title: "Import failed",
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
    selectSheet,
    toast,
    writeEntriesToSheet,
  ]);

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
                      {isFullyDuplicate
                        ? `This file already matches your linked Strength Journeys sheet. All ${skippedCount} ${skippedCount === 1 ? "entry" : "entries"} are already there.`
                        : isPartialOverlap
                          ? `${newEntries.length} new ${newEntries.length === 1 ? "entry" : "entries"} can be merged into your linked Strength Journeys sheet. ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} will be skipped.`
                          : `Merge this data into your linked Strength Journeys sheet.${skippedCount > 0 ? ` ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} will be skipped.` : ""}`}
                    </p>
                    {newEntries.length > 0 ? (
                      <Button onClick={handleMerge} className="w-full gap-2">
                        <ArrowRight className="h-4 w-4" />
                        Merge {newEntries.length}{" "}
                        {newEntries.length === 1 ? "entry" : "entries"} into
                        linked sheet
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/")}
                    >
                      <Dumbbell className="mr-2 h-4 w-4" /> Explore Dashboard
                    </Button>
                  </div>
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
                Drag &amp; drop a CSV or Excel file here
              </h3>
              <p className="text-muted-foreground mb-1 max-w-md text-sm">
                {mergeMode ? (
                  <>
                    Drop a file and we&apos;ll merge your history straight into{" "}
                    <strong className="text-foreground">
                      &ldquo;{sheetName}&rdquo;
                    </strong>{" "}
                    - duplicates are skipped automatically.
                  </>
                ) : createMode ? (
                  "Drop a file and we'll create a brand new Strength Journeys Google Sheet in your Drive, ready to go."
                ) : (
                  "Import your lifting history from Hevy, Strong, Wodify, BTWB, TurnKey, or a Strength Journeys export in CSV, XLS, or XLSX format."
                )}
              </p>
              <p className="text-muted-foreground mb-4 text-xs">
                {isAuthenticated
                  ? "Your CSV, XLS, or XLSX file is parsed in the browser, then written to your Google Sheet."
                  : "Your CSV, XLS, or XLSX data opens in preview mode right in your browser."}
              </p>
              <Button
                variant="outline"
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
                  Want to explore someone else&apos;s data without changing your
                  sheet? Sign out first, then import - it opens in preview mode.
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
