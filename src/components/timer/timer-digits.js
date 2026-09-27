/**
 * Renders a clock string with every character in its own fixed-width slot.
 *
 * `tabular-nums` only does anything when the font actually ships the `tnum`
 * OpenType feature, and several of our theme fonts (the starry-night serif in
 * particular) do not. Their digits are each a different width, so a plain
 * centred string shuffles sideways every time a digit changes.
 *
 * Sizing each slot in `ch` units solves it in any font: 1ch is the width of "0"
 * in whatever face is currently applied, so the layout stays put while the
 * theme keeps its own typography.
 */

import { cn } from "@/lib/utils";

export function TimerDigits({ value }) {
  return (
    // The slots are inline-block, so without this the clock happily breaks
    // across two lines in a narrow container such as the nav bar.
    <span className="inline-block whitespace-nowrap">
      {String(value)
        .split("")
        .map((character, index) => (
          <span
            key={`${index}-${character}`}
            className={cn(
              "inline-block text-center",
              character === ":" ? "w-[0.5ch]" : "w-[1ch]",
            )}
          >
            {character}
          </span>
        ))}
    </span>
  );
}
