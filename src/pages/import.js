import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import Image from "next/image";
import { useRouter } from "next/router";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useToast } from "@/hooks/use-toast";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";


const BIG_FOUR = [
  { name: "Back Squat", icon: "/back_squat.svg" },
  { name: "Bench Press", icon: "/bench_press.svg" },
  { name: "Deadlift", icon: "/deadlift.svg" },
  { name: "Strict Press", icon: "/strict_press.svg" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2004 }, (_, i) => CURRENT_YEAR - i);
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

function LiftEntryRow({ entry, onChange, onRemove, canRemove }) {
  const daysAvailable = entry.year && entry.month
    ? getDaysInMonth(entry.year, entry.month)
    : 31;
  const days = Array.from({ length: daysAvailable }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-end gap-2 py-2">
      {/* Weight */}
      <div className="w-24">
        <Label className="text-muted-foreground text-xs">Weight</Label>
        <Input
          type="number"
          min="0"
          step="any"
          placeholder="225"
          value={entry.weight}
          onChange={(e) => onChange({ ...entry, weight: e.target.value })}
          className="h-9"
        />
      </div>

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
  const [expanded, setExpanded] = useState(true);

  const addEntry = () => {
    const defaultYear = CURRENT_YEAR - 2;
    onUpdate([
      ...entries,
      { weight: "", reps: "1", year: defaultYear, month: "", day: "" },
    ]);
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
        <Image src={lift.icon} alt={lift.name} width={32} height={32} className="dark:invert" />
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
              key={idx}
              entry={entry}
              onChange={(updated) => updateEntry(idx, updated)}
              onRemove={() => removeEntry(idx)}
              canRemove={entries.length > 1}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={addEntry}
          >
            <Plus className="mr-1 h-4 w-4" /> Add another
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { sheetInfo, mutate, parsedData, isDemoMode } = useUserLiftingData();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Unit toggle
  const [unit, setUnit] = useState("kg");
  // Try to default from athlete bio
  const bioCtx = useAthleteBio();
  const detectedUnit = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return null;
    let kg = 0, lb = 0;
    for (const e of parsedData) {
      if (e.unitType === "kg") kg++;
      else if (e.unitType === "lb") lb++;
    }
    return lb > kg ? "lb" : "kg";
  }, [parsedData]);

  // Set unit once from detected
  const [unitInitialized, setUnitInitialized] = useState(false);
  if (detectedUnit && !unitInitialized) {
    setUnit(detectedUnit);
    setUnitInitialized(true);
  }

  // Lift entries state: { [liftName]: [{ weight, reps, year, month, day }] }
  const defaultYear = CURRENT_YEAR - 2;
  const [liftEntries, setLiftEntries] = useState(() =>
    Object.fromEntries(
      BIG_FOUR.map((lift) => [
        lift.name,
        [{ weight: "", reps: "1", year: defaultYear, month: "", day: "" }],
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
            [{ weight: "", reps: "1", year: defaultYear, month: "", day: "" }],
          ]),
        ),
      );
    } catch (err) {
      toast({ title: "Import failed", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [validEntries, sheetInfo, mutate, toast, defaultYear]);

  // Auth gate
  if (authStatus === "unauthenticated") {
    return (
      <>
        <NextSeo title="Import Data" noindex />
        <PageContainer className="py-16 text-center">
          <Dumbbell className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Sign in to import data</h2>
          <p className="text-muted-foreground mb-4">
            You need to be signed in with a connected Google Sheet to import lifting history.
          </p>
          <Button onClick={() => router.push("/")}>Go to Home</Button>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <NextSeo title="Import Data" noindex />
      <PageContainer>
        <PageHeader>
          <PageHeaderHeading icon={Upload}>Import Data</PageHeaderHeading>
          <PageHeaderDescription>
            Add your lifting history from memory or other apps. Everything here
            is optional — you can always come back and add more later.
          </PageHeaderDescription>
        </PageHeader>

        {/* Quick Add Section */}
        <section className="mx-auto mb-12 max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick Add Best Lifts</h2>
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground text-sm">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            Enter your most memorable lifts for each movement. You don&apos;t need exact dates — just the year is enough.
            These will be added to your Google Sheet as historical entries.
          </p>

          {BIG_FOUR.map((lift) => (
            <LiftSection
              key={lift.name}
              lift={lift}
              entries={liftEntries[lift.name]}
              onUpdate={(entries) => updateLiftEntries(lift.name, entries)}
              unit={unit}
            />
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-muted-foreground text-xs">
              {validEntries.length} {validEntries.length === 1 ? "entry" : "entries"} ready to save
            </p>
            <Button
              onClick={handleSave}
              disabled={saving || validEntries.length === 0 || !sheetInfo?.ssid}
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

          {!sheetInfo?.ssid && authStatus === "authenticated" && (
            <p className="text-destructive text-sm">
              No Google Sheet connected. Connect one from the home page first.
            </p>
          )}
        </section>

        {/* File Upload Section (Coming Soon) */}
        <section className="mx-auto mb-16 max-w-2xl">
          <h2 className="mb-4 text-lg font-semibold">Import from Another App</h2>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileUp className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 font-semibold">File Import — Coming Soon</h3>
              <p className="text-muted-foreground mb-4 max-w-sm text-sm">
                We&apos;re building support for importing data from popular lifting apps
                including Strong, JEFIT, FitNotes, Hevy, and more.
              </p>
              <p className="text-muted-foreground text-xs">
                Supported formats will include .csv, .xlsx, and .xls
              </p>
            </CardContent>
          </Card>
        </section>
      </PageContainer>
    </>
  );
}
