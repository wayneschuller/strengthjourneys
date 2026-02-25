import { Skeleton } from "@/components/ui/skeleton";

export function HomeInspirationCardsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div
      key={`home-inspiration-card-skeleton-${index}`}
      className="flex flex-col gap-1 py-1.5"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  ));
}
