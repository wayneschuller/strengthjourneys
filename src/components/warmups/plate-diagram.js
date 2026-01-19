"use client";

import { cn } from "@/lib/utils";

/**
 * Visual representation of plates on one side of a barbell
 * @param {Object} props
 * @param {Array} props.platesPerSide - Array of {weight, color, count} objects
 * @param {number} props.barWeight - Weight of the barbell
 * @param {boolean} props.isMetric - Whether using kg (true) or lb (false)
 * @param {string} props.className - Additional CSS classes
 */
export function PlateDiagram({ platesPerSide = [], barWeight, isMetric, className }) {
  const unit = isMetric ? "kg" : "lb";

  if (platesPerSide.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <div className="text-center">
          <div className="mb-2 h-2 w-24 rounded bg-gray-400"></div>
          <div className="text-sm text-muted-foreground">
            Bar only ({barWeight}
            {unit})
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-4", className)}>
      {/* Base barbell (same as bar-only state) with plates overlaid on the right */}
      <div className="relative flex items-center justify-end px-2 py-1">
        {/* Horizontal bar - centered vertically */}
        <div className="h-2 w-24 rounded bg-gray-400" />

        {/* Plates stacked over the right-hand side of the bar, vertically centered */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Plates stacked from heaviest (inside) to lightest (outside) */}
          {platesPerSide
            .flatMap((plate) =>
              Array.from({ length: plate.count }, (_, i) => ({
                ...plate,
                index: i,
              })),
            )
            .map((plate, idx) => (
              <div
                key={`${plate.weight}-${idx}`}
                className="h-10 w-4 rounded border-2 border-gray-800 dark:border-gray-200"
                style={{
                  backgroundColor:
                    plate.color === "#FFFFFF" ? "#E5E7EB" : plate.color,
                  minWidth: "14px",
                }}
                title={`${plate.weight}${unit}`}
              />
            ))}
        </div>
      </div>

      {/* Plate labels - right-aligned, showing one side only */}
      <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
        {platesPerSide.map((plate, idx) => (
          <span key={idx} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded border border-gray-300"
              style={{
                backgroundColor:
                  plate.color === "#FFFFFF" ? "#E5E7EB" : plate.color,
              }}
            />
            {plate.count}x {plate.weight}
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}
