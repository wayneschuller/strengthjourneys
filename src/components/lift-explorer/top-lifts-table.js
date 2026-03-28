/**
 * Shared top-lifts table for lift explorer surfaces.
 * Keep the selection interaction lightweight so changing lifts feels instant.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

const BIG_FOUR_URLS = {
  "Back Squat": "/progress-guide/squat",
  "Bench Press": "/progress-guide/bench-press",
  Deadlift: "/progress-guide/deadlift",
  "Strict Press": "/progress-guide/strict-press",
};

/**
 * Tabular list of top lifts with optional aggregate stats.
 *
 * @param {Object} props
 * @param {Array} props.stats
 * @param {string|null} props.selectedLiftType
 * @param {function} [props.onSelectLift]
 * @param {boolean} [props.showStats=false]
 */
export function TopLiftsTable({
  stats,
  selectedLiftType,
  onSelectLift,
  showStats = false,
}) {
  return (
    <div>
      <table className="w-full">
        <tbody>
          {stats.map((item, index) => (
            <tr
              key={index}
              onClick={() => onSelectLift?.(item.liftType)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectLift?.(item.liftType);
                }
              }}
              tabIndex={0}
              className={cn(
                "hover:bg-muted/50 focus-visible:bg-muted/60 cursor-pointer transition-colors outline-none",
                selectedLiftType === item.liftType && "bg-muted font-medium",
              )}
              aria-label={`Show ${item.liftType} reps over time`}
            >
              <td className="py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  {BIG_FOUR_URLS[item.liftType] ? (
                    <Link
                      href={BIG_FOUR_URLS[item.liftType]}
                      className="truncate text-sm underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.liftType}
                    </Link>
                  ) : (
                    <span className="truncate text-sm">{item.liftType}</span>
                  )}
                </div>
              </td>
              {showStats && (
                <td className="py-1 text-right text-sm whitespace-nowrap">
                  {item.reps.toLocaleString()} reps
                </td>
              )}
              {showStats && (
                <td className="hidden py-1 text-right text-sm whitespace-nowrap sm:table-cell">
                  {item.sets} sets
                  <span className="hidden md:inline"> ({item.percentage}%)</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
