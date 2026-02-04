"use client";

import { cn } from "@/lib/utils";

/**
 * Visual representation of plates on one side of a barbell
 * @param {Object} props
 * @param {Array} props.platesPerSide - Array of {weight, color, count} objects
 * @param {number} props.barWeight - Weight of the barbell
 * @param {boolean} props.isMetric - Whether using kg (true) or lb (false)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.hideLabels - Whether to hide the plate labels
 */
export function PlateDiagram({ platesPerSide = [], barWeight, isMetric, className, hideLabels = false }) {
  const unit = isMetric ? "kg" : "lb";

  if (platesPerSide.length === 0) {
    return (
      <div className={cn("flex flex-col items-end gap-8 mt-2", className)}>
        {/* Base barbell - same structure as plates version for alignment */}
        <div className="relative flex items-center justify-end px-2 py-1">
          {/* Horizontal bar - same width as plates version */}
          <div className="h-2 w-48 rounded bg-gray-400" />
        </div>

        {/* Reserve space for labels to match plates version */}
        {!hideLabels && (
          <div className="flex h-8 flex-wrap justify-end gap-1 text-xs text-muted-foreground">
            <span>Bar only ({barWeight}{unit})</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-8 mt-2", className)}>
      {/* Base barbell (same as bar-only state) with plates overlaid on the right */}
      <div className="relative flex items-center justify-end px-2 py-1">
        {/* Horizontal bar - wider to show sleeve beyond plates */}
        <div className="h-2 w-48 rounded bg-gray-400" />

        {/* Plates stacked over the right-hand side of the bar, vertically centered, with sleeve visible beyond */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Plates stacked from heaviest (inside) to lightest (outside) */}
          {platesPerSide
            .flatMap((plate) =>
              Array.from({ length: plate.count }, (_, i) => ({
                ...plate,
                index: i,
              })),
            )
            .map((plate, idx) => {
              // Fractional plates (2.5kg/2.5lb, 1.25kg) should be smaller
              const isFractional = plate.weight === 2.5 || plate.weight === 1.25;
              const heightClass = isFractional ? "h-9" : "h-16"; 
              const widthClass = isFractional ? "w-2" : "w-4";
              
              return (
                <div
                  key={`${plate.weight}-${idx}`}
                  className={cn(
                    heightClass,
                    widthClass,
                    "rounded border-2 border-border",
                  )}
                  style={{
                    backgroundColor:
                      plate.color === "#FFFFFF" ? "#E5E7EB" : plate.color,
                    minWidth: isFractional ? "8px" : "14px",
                  }}
                  title={`${plate.weight}${unit}`}
                />
              );
            })}
        </div>
      </div>

      {/* Plate labels - right-aligned, showing one side only */}
      {!hideLabels && (
        <div className="flex h-8 flex-wrap justify-end gap-1 text-xs text-muted-foreground">
          {platesPerSide.map((plate, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded border border-border"
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
      )}
    </div>
  );
}
