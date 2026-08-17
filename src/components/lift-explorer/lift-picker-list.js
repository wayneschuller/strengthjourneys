/**
 * Clickable lift list for the Lift Explorer sidebar.
 *
 * Two design constraints worth keeping:
 *
 * 1. Rows select in place and are deliberately NOT links. They used to wrap the
 *    lift name in a link to the lift's guide page, which meant the row and the
 *    text under the cursor went to two different places a pixel apart.
 * 2. The tinted bar behind each row is that lift's set count as a share of the
 *    most-trained lift, so the ranking is legible at a glance without spending
 *    horizontal space on numbers — the sidebar is narrow.
 */
import { cn } from "@/lib/utils";

/**
 * List of selectable lifts with a volume bar, optional rank, and last-trained age.
 *
 * @param {Object} props
 * @param {Array} props.stats - Lift rows from TopLiftsCard (liftType, color, barPercent, rank, age).
 * @param {string|null} props.selectedLiftType
 * @param {function} [props.onSelectLift] - Called with a liftType string on click.
 * @param {boolean} [props.showRank=false] - Show the top-3 rank gutter (only meaningful when sorted by volume).
 */
export function LiftPickerList({
  stats,
  selectedLiftType,
  onSelectLift,
  showRank = false,
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {stats.map((item) => {
        const isSelected = item.liftType === selectedLiftType;

        return (
          <li key={item.liftType}>
            <button
              type="button"
              onClick={() => onSelectLift?.(item.liftType)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "group hover:bg-muted/50 focus-visible:bg-muted/60 relative flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left transition-colors outline-none",
                isSelected && "bg-muted font-medium",
              )}
            >
              {/* Volume bar, drawn in the lift's own colour underneath the row content */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-sm opacity-20 dark:opacity-30"
                style={{ width: `${item.barPercent}%`, background: item.color }}
              />
              {showRank && (
                <span className="text-muted-foreground relative w-4 shrink-0 text-[10px] tabular-nums">
                  {item.rank <= 3 ? `#${item.rank}` : ""}
                </span>
              )}
              <span
                aria-hidden="true"
                className="relative size-2.5 shrink-0 rounded-[2px]"
                style={{ background: item.color }}
              />
              <span className="relative min-w-0 flex-1 truncate text-sm group-hover:underline">
                {item.liftType}
              </span>
              {item.age && (
                <span
                  className="text-muted-foreground relative shrink-0 text-[10px] tabular-nums"
                  title={`Last trained ${item.lastDate}`}
                >
                  {item.age}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
