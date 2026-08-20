import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder rows for the inspiration strip. Bar heights and gaps mirror InspirationCard's
 * three lines - icon + label (text-xs), title (text-sm/text-base), footer (text-[11px]) - so
 * the strip keeps its height when the real cards slide in.
 */
export function HomeInspirationCardsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div
      key={`home-inspiration-card-skeleton-${index}`}
      className="flex min-h-[5.125rem] flex-col gap-0.5 py-1.5"
    >
      <div className="flex h-4 items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-36 sm:h-[1.375rem]" />
      <Skeleton className="h-3.5 w-28" />
    </div>
  ));
}
