import { Check, CloudOff, Loader2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LogSessionSkeleton() {
  return (
    <div className="mt-6">
      <div className="border-border/50 bg-card/70 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border/40 space-y-3 border-b px-5 py-5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="space-y-5 px-5 py-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-9 w-14" />
                <Skeleton className="h-4 w-3" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-6" />
              </div>
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            </div>
          ))}
          <div className="border-border/40 border-t pt-5">
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

const SYNC_STATE_LABELS = {
  saving: "Saving to your sheet",
  saved: "Saved to your sheet",
  waiting: "Waiting on the connection. Your changes are held here.",
  error: "A change did not reach your sheet",
};

// `waiting` is the one state that can last: changes are queued but the sheet
// is not answering, so the lifter should know to keep the tab open.
export function SyncIndicator({ state }) {
  if (state === "idle") return <div className="w-8" />;
  return (
    <div
      className="flex w-8 items-center justify-center"
      role="status"
      title={SYNC_STATE_LABELS[state]}
      aria-label={SYNC_STATE_LABELS[state]}
    >
      {state === "saving" && (
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      )}
      {state === "saved" && <Check className="h-4 w-4 text-green-500" />}
      {state === "waiting" && (
        <CloudOff className="text-muted-foreground h-4 w-4 animate-pulse" />
      )}
      {state === "error" && <X className="text-destructive h-4 w-4" />}
    </div>
  );
}
