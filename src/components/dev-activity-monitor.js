import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevActivityMonitor } from "@/hooks/use-dev-activity-monitor";

const OPERATION_GUIDES = {
  addSet: {
    action: "Add set to existing lift block",
    api: "POST /api/sheet/insert-row",
    sheets: "insertDimension + updateCells",
  },
  addLift: {
    action: "Add new lift block to session",
    api: "POST /api/sheet/insert-row",
    sheets: "insertDimension + updateCells + optional border",
  },
  deleteSet: {
    action: "Delete one set row",
    api: "POST /api/sheet/delete-row",
    sheets: "values.get verification -> optional values.update -> deleteDimension",
  },
  deleteSession: {
    action: "Delete all rows for the session date",
    api: "DELETE /api/sheet/delete",
    sheets: "range verification -> deleteDimension over session rows",
  },
  updateSet: {
    action: "Edit reps, weight, notes, or URL",
    api: "POST /api/sheet/edit-cell or /api/sheet/edit-row",
    sheets: "values.get verification -> values.update",
  },
  "edit-cell": {
    action: "Edit one field on an existing set",
    api: "POST /api/sheet/edit-cell",
    sheets: "values.get verification -> values.update",
  },
  "edit-row": {
    action: "Edit the full set row",
    api: "POST /api/sheet/edit-row",
    sheets: "values.get verification -> values.update",
  },
  "insert-row": {
    action: "Insert a new row into the sheet",
    api: "POST /api/sheet/insert-row",
    sheets: "batchUpdate insertDimension -> updateCells",
  },
  "delete-row": {
    action: "Delete a row from the sheet",
    api: "POST /api/sheet/delete-row",
    sheets: "values.get verification -> optional values.update -> deleteDimension",
  },
  "delete-session": {
    action: "Delete every row in the selected session",
    api: "DELETE /api/sheet/delete",
    sheets: "range verification -> deleteDimension over session rows",
  },
};

function getGuide(entry) {
  if (entry.op && OPERATION_GUIDES[entry.op]) return OPERATION_GUIDES[entry.op];
  if (entry.label && OPERATION_GUIDES[entry.label]) return OPERATION_GUIDES[entry.label];
  return null;
}

function getEntryTone(entry) {
  if (entry.type === "warning" || entry.type === "swr-error" || entry.ok === false) {
    return {
      badge: "Warning",
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      titleClass: "text-destructive",
      cardClass: "border-destructive/20 bg-destructive/5",
    };
  }

  if (entry.type === "trace") {
    const isApiStage = entry.phase === "request" || entry.ok === true;
    return {
      badge: isApiStage ? "API" : "Sheets",
      badgeClass: isApiStage
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      titleClass: "text-foreground",
      cardClass: "",
    };
  }

  if (entry.type === "ui" || entry.type === "action") {
    return {
      badge: "UI",
      badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      titleClass: "text-foreground",
      cardClass: "",
    };
  }

  if (entry.type === "sync" || entry.type === "swr" || entry.type === "swr-ok") {
    return {
      badge: "Sync",
      badgeClass: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      titleClass: "text-foreground",
      cardClass: "",
    };
  }

  if (entry.type === "timing") {
    return {
      badge: "Timing",
      badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      titleClass: "text-foreground",
      cardClass: "",
    };
  }

  return {
    badge: "Feed",
    badgeClass: "border-border bg-muted text-muted-foreground",
    titleClass: "text-foreground",
    cardClass: "",
  };
}

function getTraceTitle(entry, guide) {
  const phaseLabel = entry.phase === "request" ? "Request" : "Response";
  if (guide?.api) {
    return `${phaseLabel}: ${guide.api}`;
  }
  return `${phaseLabel}: ${entry.op ?? entry.label}`;
}

function getEntryTitle(entry, guide) {
  if (entry.type === "trace") return getTraceTitle(entry, guide);
  if (entry.type === "timing") {
    return `${guide?.action ?? entry.label} finished in ${entry.total}ms`;
  }
  if (entry.type === "ui" || entry.type === "action") {
    return guide?.action ?? entry.label;
  }
  return entry.label;
}

function getTraceSummary(entry) {
  const parts = [];

  if (entry.phase === "request") {
    if (entry.startRowIndex != null && entry.endRowIndex != null) {
      parts.push(`rows ${entry.startRowIndex}-${entry.endRowIndex}`);
    }
    if (entry.insertAfterRowIndex != null) {
      parts.push(`insert after row ${entry.insertAfterRowIndex}`);
    }
    if (entry.rowIndex != null && entry.insertAfterRowIndex == null) {
      parts.push(`target row ${entry.rowIndex}`);
    }
    if (entry.field) {
      parts.push(`field ${entry.field}`);
    }
    if (entry.newSession) {
      parts.push("starts a new session block");
    }
  }

  if (entry.phase === "response") {
    if (entry.ok === true && entry.firstRowIndex != null) {
      parts.push(`created row ${entry.firstRowIndex}`);
    }
    if (entry.ok === true && entry.startRowIndex != null && entry.endRowIndex != null) {
      parts.push(`deleted rows ${entry.startRowIndex}-${entry.endRowIndex}`);
    }
    if (entry.ok === true && entry.rowIndex != null && entry.firstRowIndex == null) {
      parts.push(`confirmed row ${entry.rowIndex}`);
    }
    if (entry.ok === false && entry.code) {
      parts.push(`code ${entry.code}`);
    }
  }

  if (entry.message) {
    parts.push(entry.message);
  }

  return parts.join(" · ");
}

function getEntryLines(entry, guide) {
  const lines = [];

  if (entry.detail) {
    lines.push(entry.detail);
  } else if (entry.type === "trace") {
    const traceSummary = getTraceSummary(entry);
    if (traceSummary) lines.push(traceSummary);
  }

  if (guide?.api && entry.type !== "trace") {
    lines.push(`SJ API: ${guide.api}`);
  }

  if (guide?.sheets) {
    lines.push(`Sheets: ${guide.sheets}`);
  }

  if (entry.type === "trace" && entry.phase === "request" && entry.beforeSnapshot) {
    lines.push("Preflight snapshot captured before writing to Sheets.");
  }

  if (entry.type === "trace" && entry.phase === "response" && entry.ok === false && entry.actual) {
    lines.push("Preflight check found the row contents changed before the write landed.");
  }

  return lines;
}

function getMetaPills(entry) {
  const pills = [];

  if (entry.sessionDate) pills.push(`date ${entry.sessionDate}`);
  if (entry.rowIndex != null) pills.push(`row ${entry.rowIndex}`);
  if (entry.startRowIndex != null) pills.push(`start ${entry.startRowIndex}`);
  if (entry.endRowIndex != null) pills.push(`end ${entry.endRowIndex}`);
  if (entry.insertAfterRowIndex != null) pills.push(`after ${entry.insertAfterRowIndex}`);
  if (entry.field) pills.push(`field ${entry.field}`);
  if (entry.phase) pills.push(entry.phase);
  if (typeof entry.ok === "boolean") pills.push(entry.ok ? "ok" : "failed");

  return pills;
}

function formatCopyLine(entry) {
  const guide = getGuide(entry);
  const title = getEntryTitle(entry, guide);
  const lines = getEntryLines(entry, guide);
  const meta = getMetaPills(entry);
  const suffix = [
    lines.join(" | "),
    meta.length ? meta.join(" | ") : null,
    entry.type === "timing" ? `${entry.total}ms` : null,
  ].filter(Boolean).join(" | ");

  return `[${entry.time}] ${title}${suffix ? ` — ${suffix}` : ""}`;
}

export function DevActivityMonitorPanel({ className }) {
  const { entries } = useDevActivityMonitor();
  const scrollRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const [copied, setCopied] = useState(false);

  const orderedEntries = useMemo(
    () => entries.slice().sort((a, b) => (a.recordedAt ?? 0) - (b.recordedAt ?? 0)),
    [entries],
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (scrollElement && shouldStickToBottomRef.current) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [orderedEntries.length]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const copyLog = useCallback(() => {
    const header = `SJ Activity Log — ${new Date().toISOString()}\n${"─".repeat(60)}`;
    const lines = orderedEntries.map(formatCopyLine);

    navigator.clipboard.writeText(`${header}\n${lines.join("\n")}`);
    setCopied(true);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [orderedEntries]);

  const handleScroll = useCallback((event) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 48;
  }, []);

  return (
    <div className={cn("flex max-h-[70vh] flex-col rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity Monitor
        </span>
        <div className="flex items-center gap-2">
          {orderedEntries.length > 0 && (
            <button
              type="button"
              onClick={copyLog}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">{orderedEntries.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto text-xs"
      >
        {orderedEntries.length === 0 && (
          <div className="px-3 py-8 text-center text-muted-foreground/50">
            <p>UI actions, app API calls, and Google Sheets writes will appear here.</p>
            <p className="mt-2 text-muted-foreground/30">
              Use the log page in dev and watch the full request-to-revalidation story unfold.
            </p>
          </div>
        )}

        {orderedEntries.map((entry) => {
          const guide = getGuide(entry);
          const tone = getEntryTone(entry);
          const title = getEntryTitle(entry, guide);
          const lines = getEntryLines(entry, guide);
          const metaPills = getMetaPills(entry);

          return (
            <div
              key={entry.id}
              className={cn("border-b border-border/20 px-3 py-2", tone.cardClass)}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-muted-foreground/50">
                  {entry.time}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        tone.badgeClass,
                      )}
                    >
                      {tone.badge}
                    </span>
                    <span className={cn("font-semibold", tone.titleClass)}>{title}</span>
                    {entry.type === "timing" && (
                      <span
                        className="ml-auto shrink-0 font-mono font-bold tabular-nums"
                        style={{ color: entry.color }}
                      >
                        {entry.total}ms
                      </span>
                    )}
                  </div>

                  {lines.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {lines.map((line) => (
                        <p key={line} className="break-all text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {metaPills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {metaPills.map((pill) => (
                        <span
                          key={pill}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                          {pill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
