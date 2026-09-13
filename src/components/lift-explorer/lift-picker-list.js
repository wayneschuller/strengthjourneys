/**
 * Clickable lift list for the Lift Explorer sidebar.
 *
 * Three design constraints worth keeping:
 *
 * 1. Rows select in place and are deliberately NOT links. They used to wrap the
 *    lift name in a link to the lift's guide page, which meant the row and the
 *    text under the cursor went to two different places a pixel apart.
 * 2. The tinted bar behind each row is that lift's set count as a share of the
 *    most-trained lift, so the ranking is legible at a glance without spending
 *    horizontal space on numbers — the sidebar is narrow.
 * 3. Drawn lifts show their artwork where the colour swatch would be. Undrawn
 *    lifts keep the swatch, centred in the same 5:3 box, so names stay aligned
 *    whichever mix a lifter's history happens to have.
 */
import Image from "next/image";
import { motion } from "motion/react";

import { getLiftArtwork } from "@/components/lift-artwork";
import { getLongReadableDateString } from "@/lib/date-utils";
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
                "group hover:bg-muted/50 focus-visible:bg-muted/60 relative flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors outline-none",
                isSelected && "font-medium",
              )}
            >
              {/* The selection is one shared element that springs from row to
                  row, so the sidebar visibly points at the lift on stage. */}
              {isSelected && (
                <motion.span
                  layoutId="lift-picker-selected"
                  aria-hidden="true"
                  className="bg-muted absolute inset-0 overflow-hidden rounded-md shadow-sm ring-1"
                  style={{
                    "--tw-ring-color": `color-mix(in srgb, ${item.color} 45%, transparent)`,
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                >
                  <span
                    className="absolute inset-y-1 left-0 w-1 rounded-full"
                    style={{ background: item.color }}
                  />
                </motion.span>
              )}
              {/* Volume bar, drawn in the lift's own colour underneath the row content */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-md opacity-20 dark:opacity-30"
                style={{ width: `${item.barPercent}%`, background: item.color }}
              />
              {showRank && (
                <span className="text-muted-foreground relative w-4 shrink-0 text-[10px] tabular-nums">
                  {item.rank <= 3 ? `#${item.rank}` : ""}
                </span>
              )}
              <LiftThumb
                liftType={item.liftType}
                color={item.color}
                isSelected={isSelected}
              />
              <span className="relative min-w-0 flex-1 truncate text-sm group-hover:underline">
                {item.liftType}
              </span>
              {item.age && (
                <span
                  className="text-muted-foreground relative shrink-0 text-[10px] tabular-nums"
                  title={`Last trained ${getLongReadableDateString(item.lastDate) ?? item.lastDate}`}
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

/**
 * A lift's artwork at thumbnail size, or its colour swatch when undrawn. Both
 * sit in the same 5:3 box so a list mixing the two stays aligned.
 *
 * @param {Object} props
 * @param {string} props.liftType
 * @param {string} props.color - The lift's colour, used for the swatch fallback.
 * @param {boolean} [props.isSelected] - Selected thumbs pop slightly larger.
 * @param {string} [props.className] - Box size override, defaults to a list-row size.
 */
export function LiftThumb({ liftType, color, isSelected = false, className }) {
  const src = getLiftArtwork(liftType);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex h-6 w-10 shrink-0 items-center justify-center",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={1000}
          height={600}
          // Lift artwork is always unoptimized; see lift-artwork.js.
          unoptimized
          className={cn(
            "h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-125",
            isSelected && "scale-125",
          )}
        />
      ) : (
        <span
          className="size-2.5 rounded-[2px]"
          style={{ background: color }}
        />
      )}
    </span>
  );
}
