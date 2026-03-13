import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useReadLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { useDevActivityMonitor } from "@/hooks/use-dev-activity-monitor";

const API_DESCRIPTIONS = {
  addSet: {
    action: "Add set to existing lift block",
    api: "POST /api/sheet/insert-row",
    sheets: "sheets.spreadsheets.batchUpdate (insertDimension + updateCells)",
  },
  addLift: {
    action: "Add new lift type to session",
    api: "POST /api/sheet/insert-row",
    sheets: "sheets.spreadsheets.batchUpdate (insertDimension + updateCells + optional border)",
  },
  deleteSet: {
    action: "Delete a set row",
    api: "POST /api/sheet/delete-row",
    sheets: "sheets.values.get (verification read) → optional values.update (promote anchor) → batchUpdate (deleteDimension)",
  },
  updateSet: {
    action: "Edit reps, weight, or notes",
    api: "POST /api/sheet/edit-cell or /api/sheet/edit-row",
    sheets: "sheets.values.get (verification read) → values.update",
  },
};

export function DevActivityMonitorPanel({ className }) {
  const { entries } = useDevActivityMonitor();
  const storedDevTrace = useReadLocalStorage(LOCAL_STORAGE_KEYS.DEV_LOG_SYNC_TRACE, {
    initializeWithValue: false,
  });
  const devTrace = useMemo(
    () => (Array.isArray(storedDevTrace) ? storedDevTrace : []),
    [storedDevTrace],
  );
  const scrollRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [entries.length]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const copyLog = useCallback(() => {
    const header = `SJ Activity Log — ${new Date().toISOString()}\n${"─".repeat(60)}`;
    const lines = entries.map((entry) => {
      if (entry.type === "warning") return `[${entry.time}] ⚠ ${entry.label}: ${entry.detail}`;
      if (entry.type === "action") return `[${entry.time}] → ${entry.label}: ${entry.detail}`;
      if (
        entry.type === "swr" ||
        entry.type === "swr-ok" ||
        entry.type === "swr-error"
      ) {
        return `[${entry.time}] ◆ ${entry.label}: ${entry.detail}`;
      }

      return `[${entry.time}] ✓ ${entry.label}: ${entry.total}ms${entry.detail ? ` | ${entry.detail}` : ""}`;
    });

    const traceHeader = `\n\nSJ Dev Sync Trace\n${"─".repeat(60)}`;
    const traceLines = Array.isArray(devTrace)
      ? devTrace.map((entry) => JSON.stringify(entry))
      : [];

    navigator.clipboard.writeText(`${header}\n${lines.join("\n")}${traceLines.length ? `${traceHeader}\n${traceLines.join("\n")}` : ""}`);
    setCopied(true);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [entries, devTrace]);

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity Monitor
        </span>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={copyLog}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">{entries.length}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto text-xs">
        {entries.length === 0 && (
          <div className="px-3 py-8 text-center text-muted-foreground/50">
            <p>SWR data flow and Sheet API calls will appear here.</p>
            <p className="mt-2 text-muted-foreground/30">
              Tracks revalidation, data parsing, and every read/write to Google Sheets.
            </p>
          </div>
        )}

        {entries.map((entry, index) => {
          const description = API_DESCRIPTIONS[entry.label];

          if (
            entry.type === "swr" ||
            entry.type === "swr-ok" ||
            entry.type === "swr-error"
          ) {
            const colorClass =
              entry.type === "swr-error"
                ? "text-destructive"
                : entry.type === "swr-ok"
                  ? "text-green-600 dark:text-green-400"
                  : "text-purple-500 dark:text-purple-400";

            return (
              <div key={`${entry.time}-${index}`} className="border-b border-border/20 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-muted-foreground/50">{entry.time}</span>
                  <span className={`font-medium ${colorClass}`}>{entry.label}</span>
                </div>
                {entry.detail && (
                  <p className="mt-0.5 font-mono text-muted-foreground">{entry.detail}</p>
                )}
              </div>
            );
          }

          if (entry.type === "warning") {
            return (
              <div key={`${entry.time}-${index}`} className="border-b border-border/20 bg-destructive/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-destructive">{entry.label}</span>
                </div>
                <p className="mt-1 break-all text-destructive/80">{entry.detail}</p>
              </div>
            );
          }

          if (entry.type === "action") {
            return (
              <div key={`${entry.time}-${index}`} className="border-b border-border/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-500 dark:text-blue-400">
                    {description?.action ?? entry.label}
                  </span>
                </div>
                <p className="mt-0.5 break-all text-muted-foreground">{entry.detail}</p>
                {description && (
                  <div className="mt-1 space-y-0.5 rounded bg-muted/50 px-2 py-1 text-muted-foreground">
                    <p><span className="text-foreground/70">SJ API:</span> {description.api}</p>
                    <p><span className="text-foreground/70">Sheets:</span> {description.sheets}</p>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={`${entry.time}-${index}`} className="border-b border-border/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-muted-foreground/50">{entry.time}</span>
                <span className="font-semibold text-foreground">
                  {description?.action ?? entry.label}
                </span>
                <span
                  className="ml-auto shrink-0 font-mono font-bold tabular-nums"
                  style={{ color: entry.color }}
                >
                  {entry.total}ms
                </span>
              </div>
              {entry.detail && (
                <p className="mt-0.5 font-mono text-muted-foreground">{entry.detail}</p>
              )}
            </div>
          );
        })}

        {Array.isArray(devTrace) && devTrace.length > 0 && (
          <div className="border-t border-border/30 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dev Sync Trace
            </p>
            <div className="mt-2 space-y-2">
              {devTrace.slice().reverse().map((entry, index) => (
                <div
                  key={`${entry.at ?? "trace"}-${index}`}
                  className="rounded border border-border/30 bg-background/80 px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {entry.at ? new Date(entry.at).toLocaleTimeString() : "?"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {entry.op}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {entry.phase}
                    </span>
                    {typeof entry.ok === "boolean" && (
                      <span
                        className={cn(
                          "ml-auto text-[10px] font-semibold uppercase tracking-wide",
                          entry.ok ? "text-green-600 dark:text-green-400" : "text-destructive",
                        )}
                      >
                        {entry.ok ? "ok" : "failed"}
                      </span>
                    )}
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(entry, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
