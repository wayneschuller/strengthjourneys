/**
 * The session's weigh-in on the log: one slim strip above the lifts, so it
 * reads as part of the day without ever looking like a lift block.
 *
 * With a weigh-in it shows the weight, how far it moved since the one before,
 * and the lifter's note, with an edit button. Without one it is a single
 * "Add weigh-in" chip. Editing happens in place: a number, an optional note,
 * Save, and Delete for one already logged. A menu offers "Paste weigh-ins"
 * for a table of past weights (see WeighInPasteDialog).
 *
 * The weigh-in is a row of the lifter's sheet ("Bodyweight | | 84.2kg |
 * note"), written through the log's sync like any set. Everything about the
 * series itself lives in src/lib/bodyweight.js.
 */
import { useMemo, useState } from "react";
import {
  ClipboardPaste,
  MoreHorizontal,
  Pencil,
  Scale,
  Trash2,
} from "lucide-react";

import { parseWeighInTable } from "@/lib/bodyweight";
import { convertWeight, unitTypeFor } from "@/lib/weight-units";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * @param {Object} props
 * @param {Object|null} props.weighIn The session's weigh-in row from the
 *   log's sync (weight, unitType, notes, _pending), or null.
 * @param {Array} props.bodyweightSeries The sheet's weigh-ins, oldest first.
 * @param {string} props.sessionDate YYYY-MM-DD.
 * @param {string} props.todayIso YYYY-MM-DD.
 * @param {boolean} props.isMetric Display unit.
 * @param {boolean} props.canWrite False in the demo, an import preview, or a
 *   sheet logging cannot write to.
 * @param {boolean} [props.isMeetDay]
 * @param {Function} props.onSave ({date?, weight, unitType, notes}) => void
 * @param {Function} props.onDelete () => void
 */
export function WeighInStrip({
  weighIn,
  bodyweightSeries,
  sessionDate,
  todayIso,
  isMetric,
  canWrite,
  isMeetDay = false,
  onSave,
  onDelete,
}) {
  const unit = unitTypeFor(isMetric);
  const [isEditing, setIsEditing] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [draftWeight, setDraftWeight] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  const shownWeight = weighIn
    ? roundTenth(convertWeight(weighIn.weight, weighIn.unitType, unit))
    : null;
  const change = useMemo(
    () =>
      weighIn
        ? describeChange({
            weighIn,
            series: bodyweightSeries,
            sessionDate,
            todayIso,
            unit,
          })
        : null,
    [weighIn, bodyweightSeries, sessionDate, todayIso, unit],
  );

  const startEditing = () => {
    const latest = bodyweightSeries?.at(-1);
    const startFrom =
      shownWeight ??
      (latest ? roundTenth(convertWeight(latest.kg, "kg", unit)) : "");
    setDraftWeight(startFrom === "" ? "" : String(startFrom));
    setDraftNotes(weighIn?.notes ?? "");
    setIsEditing(true);
  };

  const save = (event) => {
    event?.preventDefault();
    const weight = Number(String(draftWeight).replace(",", "."));
    if (!(weight > 0)) return;
    onSave({
      weight: roundTenth(weight),
      unitType: unit,
      notes: draftNotes.trim(),
    });
    setIsEditing(false);
  };

  if (!weighIn && !canWrite) return null;

  if (isEditing) {
    return (
      <form
        onSubmit={save}
        aria-label="Weigh-in"
        className="bg-card mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5"
      >
        <Scale className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <label className="sr-only" htmlFor="weigh-in-weight">
          Bodyweight in {unit}
        </label>
        <div className="flex items-center gap-1.5">
          <Input
            id="weigh-in-weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            autoFocus
            value={draftWeight}
            onChange={(event) => setDraftWeight(event.target.value)}
            className="h-9 w-24"
          />
          <span className="text-muted-foreground text-sm">{unit}</span>
        </div>
        <label className="sr-only" htmlFor="weigh-in-notes">
          Note
        </label>
        <Input
          id="weigh-in-notes"
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
          placeholder="Note (optional)"
          className="h-9 min-w-[10rem] flex-1"
        />
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm" disabled={!(Number(draftWeight) > 0)}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          {weighIn && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              aria-label="Delete this weigh-in"
              onClick={() => {
                onDelete();
                setIsEditing(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <>
      <section
        aria-label="Weigh-in"
        className={
          weighIn
            ? "bg-card mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2"
            : "mb-4 flex items-center gap-1"
        }
      >
        {weighIn ? (
          <>
            <Scale
              className="text-muted-foreground h-4 w-4 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-muted-foreground">Bodyweight</span>
                <span
                  className={
                    weighIn._pending
                      ? "font-semibold tabular-nums opacity-70"
                      : "font-semibold tabular-nums"
                  }
                >
                  {shownWeight} {unit}
                </span>
                {change && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {change}
                  </span>
                )}
              </p>
              {weighIn.notes && (
                <p className="text-muted-foreground truncate text-xs">
                  {weighIn.notes}
                </p>
              )}
            </div>
            {canWrite && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label="Edit this weigh-in"
                onClick={startEditing}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            onClick={startEditing}
          >
            <Scale className="h-3.5 w-3.5" aria-hidden />
            {isMeetDay ? "Add your meet weigh-in" : "Add weigh-in"}
          </Button>
        )}
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label="More weigh-in options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setIsPasteOpen(true)}>
                <ClipboardPaste className="h-4 w-4" />
                Paste weigh-ins
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </section>
      {canWrite && (
        <WeighInPasteDialog
          open={isPasteOpen}
          onOpenChange={setIsPasteOpen}
          bodyweightSeries={bodyweightSeries}
          todayIso={todayIso}
          unit={unit}
          onSave={onSave}
        />
      )}
    </>
  );
}

/**
 * A table of past weigh-ins pasted in one go: one per line, a date then a
 * weight, then any note, separated by tabs, commas or spaces. That covers a
 * column pair copied from a spreadsheet, a notes app list, or another app's
 * export. Each line is shown before anything is saved, with what it adds or
 * changes.
 */
function WeighInPasteDialog({
  open,
  onOpenChange,
  bodyweightSeries,
  todayIso,
  unit,
  onSave,
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(
    () => parseWeighInTable(text, { unit, todayIso, bodyweightSeries }),
    [text, unit, todayIso, bodyweightSeries],
  );
  const toSave = parsed.rows.filter((row) => row.status !== "same");

  const save = () => {
    for (const row of toSave) {
      onSave({
        date: row.date,
        weight: row.weight,
        unitType: row.unitType,
        notes: row.notes,
      });
    }
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste weigh-ins</DialogTitle>
          <DialogDescription>
            One weigh-in per line: a date, then the weight, then any note. A
            weight without a unit is read in {unit}. Each one becomes a row of
            your sheet on its own date.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`2026-11-01\t186 lb\n2026-11-08\t184.5\tafter the long weekend`}
          className="min-h-[9rem] font-mono text-sm"
          aria-label="Weigh-ins to paste"
        />
        {parsed.rows.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <tbody>
                {parsed.rows.map((row) => (
                  <tr key={row.date} className="border-b last:border-0">
                    <td className="px-3 py-1.5 tabular-nums">{row.date}</td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {row.weight} {row.unitType}
                    </td>
                    <td className="text-muted-foreground truncate px-3 py-1.5 text-xs">
                      {row.status === "new"
                        ? row.notes || "New"
                        : row.status === "update"
                          ? `Replaces ${row.previous}`
                          : "Already logged"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {parsed.skipped > 0 && (
          <p className="text-muted-foreground text-xs">
            {parsed.skipped} line{parsed.skipped === 1 ? "" : "s"} without a
            date and weight we could read {parsed.skipped === 1 ? "is" : "are"}{" "}
            left out.
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!toSave.length} onClick={save}>
            {toSave.length
              ? `Save ${toSave.length} weigh-in${toSave.length === 1 ? "" : "s"}`
              : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "↓0.4 kg since Thu", against the weigh-in before this session's date.
function describeChange({ weighIn, series, sessionDate, todayIso, unit }) {
  let previous = null;
  for (let i = (series?.length ?? 0) - 1; i >= 0; i -= 1) {
    if (series[i].date < sessionDate) {
      previous = series[i];
      break;
    }
  }
  if (!previous) return null;
  const changeKg =
    convertWeight(weighIn.weight, weighIn.unitType, "kg") - previous.kg;
  const amount = roundTenth(Math.abs(convertWeight(changeKg, "kg", unit)));
  const when = describeDate(previous.date, sessionDate, todayIso);
  if (amount === 0) return `same as ${when}`;
  return `${changeKg > 0 ? "↑" : "↓"}${amount} ${unit} since ${when}`;
}

function describeDate(date, sessionDate, todayIso) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const gapDays =
    (Date.parse(`${sessionDate}T00:00:00Z`) - value.getTime()) / 86400000;
  if (gapDays < 7) {
    return value.toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    });
  }
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.slice(0, 4) !== todayIso.slice(0, 4) ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function roundTenth(value) {
  return Math.round(Number(value) * 10) / 10;
}
