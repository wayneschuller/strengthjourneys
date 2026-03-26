import { useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import Image from "next/image";
import { useRouter } from "next/router";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { UnitChooser } from "@/components/unit-type-chooser";
import { useToast } from "@/hooks/use-toast";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  FileUp,
  Download,
  ExternalLink,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { Separator } from "@/components/ui/separator";

const BIG_FOUR = [
  { name: "Back Squat", icon: "/back_squat.svg" },
  { name: "Bench Press", icon: "/bench_press.svg" },
  { name: "Deadlift", icon: "/deadlift.svg" },
  { name: "Strict Press", icon: "/strict_press.svg" },
];

// Default placeholder weights per unit
const DEFAULT_PLACEHOLDER = { kg: "100", lb: "225" };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

let _entryIdCounter = 0;
function nextEntryId() {
  return ++_entryIdCounter;
}

function makeEntry(overrides = {}) {
  return { id: nextEntryId(), weight: "", reps: "1", year: CURRENT_YEAR - 2, month: "", day: "", ...overrides };
}
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function makeDate(year, month, day) {
  if (!year) return null;
  const y = String(year);
  const m = month ? String(month).padStart(2, "0") : "01";
  const d = day ? String(day).padStart(2, "0") : "01";
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function LiftEntryRow({ entry, onChange, onRemove, canRemove, unit }) {
  const daysAvailable = entry.year && entry.month
    ? getDaysInMonth(entry.year, entry.month)
    : 31;
  const days = Array.from({ length: daysAvailable }, (_, i) => i + 1);
  const placeholder = DEFAULT_PLACEHOLDER[unit] || "225";

  return (
    <div className="flex flex-wrap items-end gap-2 py-2">
      {/* Reps */}
      <div className="w-16">
        <Label className="text-muted-foreground text-xs">Reps</Label>
        <Input
          type="number"
          min="1"
          max="100"
          placeholder="1"
          value={entry.reps}
          onChange={(e) => onChange({ ...entry, reps: e.target.value })}
          className="h-9"
        />
      </div>

      {/* Weight */}
      <div className="w-24">
        <Label className="text-muted-foreground text-xs">Weight ({unit})</Label>
        <Input
          type="number"
          min="0"
          step="any"
          placeholder={placeholder}
          value={entry.weight}
          onChange={(e) => onChange({ ...entry, weight: e.target.value })}
          className="h-9"
        />
      </div>

      {/* Year */}
      <div className="w-24">
        <Label className="text-muted-foreground text-xs">Year</Label>
        <Select
          value={entry.year ? String(entry.year) : ""}
          onValueChange={(v) => onChange({ ...entry, year: Number(v), month: "", day: "" })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Month (optional, only if year picked) */}
      {entry.year && (
        <div className="w-28">
          <Label className="text-muted-foreground text-xs">Month</Label>
          <Select
            value={entry.month ? String(entry.month) : ""}
            onValueChange={(v) => onChange({ ...entry, month: Number(v), day: "" })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Day (optional, only if month picked) */}
      {entry.year && entry.month && (
        <div className="w-20">
          <Label className="text-muted-foreground text-xs">Day</Label>
          <Select
            value={entry.day ? String(entry.day) : ""}
            onValueChange={(v) => onChange({ ...entry, day: Number(v) })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Remove */}
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Remove entry"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function LiftSection({ lift, entries, onUpdate, unit }) {
  const [expanded, setExpanded] = useState(false);

  const addEntry = () => {
    onUpdate([...entries, makeEntry()]);
  };

  const updateEntry = (idx, updated) => {
    const next = [...entries];
    next[idx] = updated;
    onUpdate(next);
  };

  const removeEntry = (idx) => {
    onUpdate(entries.filter((_, i) => i !== idx));
  };

  const filledCount = entries.filter((e) => e.weight).length;

  return (
    <Card className="overflow-hidden">
      <button
        className="hover:bg-muted/30 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Image src={lift.icon} alt={lift.name} width={48} height={48} className="dark:invert" />
        <span className="flex-1 font-semibold">{lift.name}</span>
        {filledCount > 0 && (
          <span className="text-muted-foreground text-sm">
            {filledCount} {filledCount === 1 ? "entry" : "entries"}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>

      {expanded && (
        <CardContent className="border-border border-t pt-3 pb-3">
          <p className="text-muted-foreground mb-2 text-xs">
            Weight in {unit}. Reps defaults to 1 if left blank. Date precision is flexible — just a year is fine.
          </p>
          {entries.map((entry, idx) => (
            <LiftEntryRow
              key={entry.id}
              entry={entry}
              onChange={(updated) => updateEntry(idx, updated)}
              onRemove={() => removeEntry(idx)}
              canRemove={entries.length > 1}
              unit={unit}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={addEntry}
          >
            <Plus className="mr-1 h-4 w-4" /> Add another {lift.name}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function deduplicateEntries(importedData, existingData) {
  if (!Array.isArray(existingData) || existingData.length === 0) {
    return { newEntries: importedData, skippedCount: 0 };
  }

  // Build a set of existing entry signatures for fast lookup
  const existingKeys = new Set();
  for (const e of existingData) {
    if (e.isGoal) continue;
    // Normalize: date + liftType + reps + weight (rounded to avoid float issues)
    existingKeys.add(`${e.date}|${e.liftType}|${e.reps}|${Math.round((e.weight ?? 0) * 100)}`);
  }

  const newEntries = [];
  let skippedCount = 0;
  for (const e of importedData) {
    if (e.isGoal) continue;
    const key = `${e.date}|${e.liftType}|${e.reps}|${Math.round((e.weight ?? 0) * 100)}`;
    if (existingKeys.has(key)) {
      skippedCount++;
    } else {
      newEntries.push(e);
    }
  }

  return { newEntries, skippedCount };
}

function FileImportSection({ importFile, clearImportedData, isImportedData, importedFormatName, parsedData, toast, router, sheetInfo, existingParsedData, mutate, selectSheet, isAuthenticated }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [merging, setMerging] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext)) {
      setImportError("Unsupported file type. Please use a .csv file.");
      return;
    }

    setImporting(true);
    setImportError(null);
    try {
      const { count, formatName } = await importFile(file);

      if (!isAuthenticated) {
        // Not signed in → read-only explore mode
        toast({
          title: "Data loaded!",
          description: `Parsed ${count} entries from ${formatName} format. Exploring in read-only mode.`,
        });
        router.push("/");
        return;
      }

      // Signed in — auto-action based on whether they have a sheet
      // (The actual merge/create happens via the post-import UI below,
      //  but we set importing=false so the UI renders)
      toast({
        title: "Data loaded!",
        description: `Parsed ${count} entries from ${formatName} format.`,
      });
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }, [importFile, toast, isAuthenticated, router]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const canMerge = !!sheetInfo?.ssid;

  // Write imported entries to a Google Sheet (existing or newly created)
  const writeEntriesToSheet = useCallback(async (targetSsid, entries) => {
    const apiEntries = entries.map((e) => ({
      date: e.date,
      liftType: e.liftType,
      reps: e.reps,
      weight: e.weight,
      unitType: e.unitType || "kg",
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

  // Merge into existing sheet (dedup against existing data)
  const handleMerge = useCallback(async () => {
    if (!parsedData || !sheetInfo?.ssid) return;

    const { newEntries, skippedCount } = deduplicateEntries(parsedData, existingParsedData);

    if (newEntries.length === 0) {
      toast({
        title: "Nothing new to merge",
        description: `All ${skippedCount} entries already exist in your sheet.`,
      });
      return;
    }

    setMerging(true);
    try {
      const data = await writeEntriesToSheet(sheetInfo.ssid, newEntries);

      const skippedNote = skippedCount > 0
        ? ` Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
        : "";

      toast({
        title: "Data merged into your sheet!",
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
  }, [parsedData, existingParsedData, sheetInfo, writeEntriesToSheet, clearImportedData, mutate, toast, router]);

  // Create a new Google Sheet and populate it with the imported data
  const handleCreateSheetFromImport = useCallback(async () => {
    if (!parsedData || parsedData.length === 0) return;

    setMerging(true);
    try {
      // Step 1: Create a blank sheet via the link API
      const linkRes = await fetch("/api/sheet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "bootstrap", mode: "create_blank" }),
      });
      const linkPayload = await linkRes.json();

      if (!linkRes.ok || !linkPayload?.ssid) {
        throw new Error(linkPayload?.error || "Failed to create Google Sheet");
      }

      // Step 2: Write all imported entries into the new sheet
      const nonGoalEntries = parsedData.filter((e) => !e.isGoal);
      const data = await writeEntriesToSheet(linkPayload.ssid, nonGoalEntries);

      // Step 3: Link the sheet in the app
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
  }, [parsedData, writeEntriesToSheet, selectSheet, clearImportedData, mutate, toast, router]);

  // Already imported — show status + action options
  if (isImportedData) {
    const entryCount = parsedData?.filter((e) => !e.isGoal)?.length || 0;

    // Signed-in user without a sheet: offer to create a new sheet
    const showCreateSheet = isAuthenticated && !sheetInfo?.ssid;

    // Signed-in user with existing sheet: offer merge with dedup
    const showMerge = isAuthenticated && !showCreateSheet && canMerge;

    const { newEntries, skippedCount } = showMerge
      ? deduplicateEntries(parsedData || [], existingParsedData)
      : { newEntries: parsedData?.filter((e) => !e.isGoal) || [], skippedCount: 0 };

    return (
      <section className="mx-auto mb-12 max-w-5xl">
        <h2 className="mb-4 text-lg font-semibold">Import from Another App</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            {merging ? (
              <>
                <Loader2 className="text-primary mb-3 h-10 w-10 animate-spin" />
                <h3 className="mb-1 font-semibold">
                  {showCreateSheet ? "Creating your Google Sheet..." : "Merging into your sheet..."}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {showCreateSheet
                    ? `Setting up a new Strength Journeys sheet with ${entryCount} entries.`
                    : `Adding ${newEntries.length} new entries to your sheet.`}
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="text-primary mb-3 h-10 w-10" />
                <h3 className="mb-1 font-semibold">
                  {importedFormatName} data loaded
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {entryCount} {entryCount === 1 ? "entry" : "entries"} parsed and ready.
                </p>

                {/* Signed-in: Create new Google Sheet from imported data */}
                {showCreateSheet && (
                  <div className="w-full max-w-md space-y-3">
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll create a new Google Sheet in your Drive and populate
                      it with your {entryCount} {entryCount === 1 ? "entry" : "entries"}.
                      This becomes your permanent data backend — fully yours.
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

                {/* Signed-in with existing sheet: Merge */}
                {showMerge && (
                  <div className="w-full max-w-md space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Merge this data into your existing Strength Journeys spreadsheet.
                      {skippedCount > 0 && (
                        <> {skippedCount} duplicate{skippedCount === 1 ? "" : "s"} will be skipped.</>
                      )}
                    </p>
                    <Button
                      onClick={handleMerge}
                      disabled={newEntries.length === 0}
                      className="w-full gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Merge {newEntries.length} {newEntries.length === 1 ? "entry" : "entries"} into sheet
                    </Button>
                    {newEntries.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        All entries already exist in your sheet — nothing to merge.
                      </p>
                    )}
                  </div>
                )}

                {/* Not signed in: view-only explore */}
                {!isAuthenticated && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push("/")}>
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
      <h2 className="mb-4 text-lg font-semibold">Import from Another App</h2>
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
                Drag &amp; drop a CSV file here
              </h3>
              <p className="text-muted-foreground mb-4 max-w-sm text-sm">
                Import your lifting history from TurnKey, or a Strength Journeys
                CSV export. More formats coming soon.
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
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                Your data stays in your browser — nothing is uploaded to a server.
              </p>
            </>
          )}
          {importError && (
            <p className="text-destructive mt-4 max-w-md text-sm">{importError}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function escapeCsvField(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvFromParsedData(parsedData) {
  const header = "Date,Lift Type,Reps,Weight,Notes,Label,URL";
  const entries = parsedData.filter((e) => !e.isGoal);

  // parsedData is date-ascending with intraday order preserved.
  // Group by date, then reverse the groups for newest-first output
  // while keeping warmup→work-set order within each date.
  const grouped = [];
  let currentDate = null;
  let currentGroup = [];
  for (const e of entries) {
    if (e.date !== currentDate) {
      if (currentGroup.length > 0) grouped.push(currentGroup);
      currentGroup = [];
      currentDate = e.date;
    }
    currentGroup.push(e);
  }
  if (currentGroup.length > 0) grouped.push(currentGroup);
  grouped.reverse();

  const rows = grouped.flat().map((e) => {
    const weight = `${e.weight}${e.unitType}`;
    return [e.date, e.liftType, e.reps, weight, e.notes || "", e.label || "", e.URL || ""]
      .map(escapeCsvField)
      .join(",");
  });
  return [header, ...rows].join("\n");
}

function downloadCsv(csvString, filename) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { sheetInfo, mutate, parsedData, isDemoMode, isReturningUserLoading, importFile, clearImportedData, isImportedData, importedFormatName, hasUserData, isReadOnly, sheetParsedData, selectSheet } = useUserLiftingData();
  const { isMetric, toggleIsMetric } = useAthleteBio();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const unit = isMetric ? "kg" : "lb";

  // Lift entries state: { [liftName]: [{ id, weight, reps, year, month, day }] }
  const [liftEntries, setLiftEntries] = useState(() =>
    Object.fromEntries(
      BIG_FOUR.map((lift) => [
        lift.name,
        [makeEntry()],
      ]),
    ),
  );

  const updateLiftEntries = useCallback((liftName, entries) => {
    setLiftEntries((prev) => ({ ...prev, [liftName]: entries }));
  }, []);

  // Collect all valid entries for saving
  const validEntries = useMemo(() => {
    const result = [];
    for (const [liftType, entries] of Object.entries(liftEntries)) {
      for (const e of entries) {
        const w = parseFloat(e.weight);
        if (!w || w <= 0 || !e.year) continue;
        result.push({
          date: makeDate(e.year, e.month, e.day),
          liftType,
          reps: parseInt(e.reps, 10) || 1,
          weight: w,
          unitType: unit,
        });
      }
    }
    return result;
  }, [liftEntries, unit]);

  const handleSave = useCallback(async () => {
    if (validEntries.length === 0) {
      toast({ title: "Nothing to save", description: "Enter at least one lift with a weight and year.", variant: "destructive" });
      return;
    }
    if (!sheetInfo?.ssid) {
      toast({ title: "No sheet connected", description: "Connect a Google Sheet first from the home page.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sheet/import-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: sheetInfo.ssid, entries: validEntries }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Import failed", description: data.error || "Something went wrong.", variant: "destructive" });
        return;
      }

      toast({
        title: "History imported!",
        description: `Added ${data.insertedRows} rows across ${data.dateCount} date${data.dateCount === 1 ? "" : "s"}.`,
      });

      // Refresh data
      mutate();

      // Clear filled entries
      setLiftEntries(
        Object.fromEntries(
          BIG_FOUR.map((lift) => [
            lift.name,
            [makeEntry()],
          ]),
        ),
      );
    } catch (err) {
      toast({ title: "Import failed", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [validEntries, sheetInfo, mutate, toast]);

  // Loading gate — prevent flash for returning users
  if (authStatus === "loading" || isReturningUserLoading) {
    return (
      <>
        <NextSeo title="Import & Export Data" noindex />
        <PageContainer className="py-16 text-center">
          <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <NextSeo title="Import & Export Data" noindex />
      <PageContainer>
        <PageHeader>
          <PageHeaderHeading icon={Upload}>Import Data</PageHeaderHeading>
          <PageHeaderDescription>
            Add your lifting history from another app or from memory.
            Your data stays in your browser — nothing is uploaded to a server.
          </PageHeaderDescription>
        </PageHeader>

        {/* File Import Section — always visible, no auth required */}
        <FileImportSection
          importFile={importFile}
          clearImportedData={clearImportedData}
          isImportedData={isImportedData}
          importedFormatName={importedFormatName}
          parsedData={parsedData}
          toast={toast}
          router={router}
          sheetInfo={sheetInfo}
          existingParsedData={sheetParsedData}
          mutate={mutate}
          selectSheet={selectSheet}
          isAuthenticated={authStatus === "authenticated"}
        />

        {/* Quick Add Section — only for users with write access (GSheet mode) */}
        {!isReadOnly && (
          <section className="mx-auto mb-12 max-w-5xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quick Add Best Lifts</h2>
              <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
            </div>

            <p className="text-muted-foreground text-sm">
              Enter your most memorable lifts for each movement. You don&apos;t need exact dates — just the year is enough.
              These will be added to your Google Sheet as historical entries.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {BIG_FOUR.map((lift) => (
                <LiftSection
                  key={lift.name}
                  lift={lift}
                  entries={liftEntries[lift.name]}
                  onUpdate={(entries) => updateLiftEntries(lift.name, entries)}
                  unit={unit}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-xs">
                {validEntries.length} {validEntries.length === 1 ? "entry" : "entries"} ready to save
              </p>
              <Button
                onClick={handleSave}
                disabled={saving || validEntries.length === 0}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Dumbbell className="mr-2 h-4 w-4" /> Save to Sheet
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {/* Export Section */}
        {hasUserData && !isImportedData && (
          <section className="mx-auto mb-16 max-w-5xl">
            <h2 className="mb-4 text-lg font-semibold">Export Your Data</h2>

            {/* Primary: Open Google Sheet */}
            {sheetInfo?.url && (
              <Card className="mb-4">
                <CardContent className="flex flex-col items-center py-8 text-center sm:flex-row sm:gap-6 sm:text-left">
                  <a
                    href={sheetInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group shrink-0"
                  >
                    <img
                      src={GOOGLE_SHEETS_ICON_URL}
                      alt="Google Sheets"
                      width={80}
                      height={80}
                      className="transition-transform group-hover:scale-105"
                    />
                  </a>
                  <div className="mt-4 flex-1 sm:mt-0">
                    <h3 className="mb-1 text-base font-semibold">
                      {sheetInfo.filename || "Your Google Sheet"}
                    </h3>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Your data already lives in your own Google Sheet — it&apos;s
                      always yours. Open it anytime to view, edit, or share.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={sheetInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Google Sheets
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Secondary: Download CSV */}
            {parsedData && parsedData.length > 0 && (
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <Download className="text-muted-foreground h-8 w-8 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">Download as CSV</h3>
                    <p className="text-muted-foreground text-xs">
                      {parsedData.filter((e) => !e.isGoal).length} rows
                      — portable format for backups or other apps
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const csv = buildCsvFromParsedData(parsedData);
                      const name = sheetInfo?.filename
                        ? `${sheetInfo.filename.replace(/\s+/g, "_")}.csv`
                        : "strength_journeys_export.csv";
                      downloadCsv(csv, name);
                      toast({ title: "CSV downloaded" });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        )}
      </PageContainer>
    </>
  );
}
