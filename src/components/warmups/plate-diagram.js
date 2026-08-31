
/**
 * Renders the loading sequence for a warm-up set. The diagram intentionally
 * keeps one-sided loading simple, while the animation supplies enough depth
 * and motion to make each plate change feel like a real barbell setup.
 */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const BAR_STYLE = {
  background:
    "linear-gradient(180deg, #f8fafc 0%, #94a3b8 18%, #334155 48%, #cbd5e1 76%, #475569 100%)",
  boxShadow: "0 2px 5px rgb(15 23 42 / 0.3), inset 0 1px rgb(255 255 255 / 0.7)",
};

const SLEEVE_STYLE = {
  background:
    "linear-gradient(90deg, #334155 0%, #e2e8f0 14%, #64748b 30%, #1e293b 52%, #94a3b8 76%, #334155 100%)",
  boxShadow: "0 3px 7px rgb(15 23 42 / 0.35), inset 0 1px rgb(255 255 255 / 0.35)",
};

/**
 * Visual representation of plates on one side of a barbell
 * @param {Object} props
 * @param {Array} props.platesPerSide - Array of {weight, color, count} objects
 * @param {number} props.barWeight - Weight of the barbell
 * @param {boolean} props.isMetric - Whether using kg (true) or lb (false)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.hideLabels - Whether to hide the plate labels
 * @param {number} [props.animationDelay] - Base delay (seconds) before plates animate in (for stagger between sets)
 * @param {string} [props.animationKey] - Key that changes when sliders change, retriggers plate animation
 * @param {boolean} [props.useScrollTrigger] - If true, animate when card scrolls into view (mobile); if false, animate immediately (desktop)
 */
export function PlateDiagram({ platesPerSide = [], barWeight, isMetric, className, hideLabels = false, animationDelay = 0, animationKey, useScrollTrigger = false, slideFromLeft = false }) {
  const unit = isMetric ? "kg" : "lb";

  const renderBar = (hasPlates = false) => (
    <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-end">
      <motion.div
        className="relative h-3 w-48 overflow-hidden rounded-full"
        style={BAR_STYLE}
        initial={{ opacity: 0.7 }}
        animate={{ opacity: [0.7, 1, 0.82] }}
        transition={{ duration: 0.8, delay: animationDelay, ease: "easeOut" }}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 w-10 bg-white/60 blur-sm"
          initial={{ x: -48, opacity: 0 }}
          animate={{ x: 210, opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.9, delay: animationDelay + 0.18, ease: "easeInOut" }}
        />
      </motion.div>
      {hasPlates && (
        <motion.div
          aria-hidden="true"
          className="absolute right-0 h-8 w-2 rounded-sm border border-slate-900/40"
          style={SLEEVE_STYLE}
          initial={{ scaleY: 0.7, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: animationDelay + 0.1 }}
        />
      )}
    </div>
  );

  if (platesPerSide.length === 0) {
    return (
      <div className={cn("flex flex-col items-end gap-8 mt-2", className)}>
        {/* Base barbell - same structure as plates version for alignment */}
        <div className="relative flex min-h-[72px] w-56 items-center justify-end px-2 py-1">
          {renderBar()}
        </div>

        {/* Reserve space for labels to match plates version */}
        {!hideLabels && (
          <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
            <span>Bar only ({barWeight}{unit})</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-8 mt-2", className)}>
      {/* Base barbell (same as bar-only state) with plates overlaid on the right */}
      <div className="relative flex min-h-[72px] w-56 items-center justify-end px-2 py-1">
        {/* The sleeve remains visible beyond the plates so the loading direction is clear. */}
        {renderBar(true)}

        {/* Plates stacked over the right-hand side of the bar, vertically centered, with sleeve visible beyond */}
        <div key={animationKey ?? "static"} className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
              
              const transition = {
                duration: 0.42,
                delay: animationDelay + idx * 0.06,
                ease: [0.22, 1, 0.36, 1],
              };
              const plateColor = plate.color === "#FFFFFF" ? "#E5E7EB" : plate.color;
              return (
                <motion.div
                  key={`${plate.weight}-${idx}`}
                  initial={{
                    x: slideFromLeft ? -30 : 30,
                    y: -5,
                    rotate: slideFromLeft ? -5 : 5,
                    scale: 0.82,
                    opacity: 0,
                  }}
                  {...(useScrollTrigger
                    ? {
                        whileInView: { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
                        viewport: { once: true, margin: "-20px" },
                      }
                    : { animate: { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 } })}
                  transition={transition}
                  className={cn(
                    heightClass,
                    widthClass,
                    "group relative overflow-hidden rounded border-2 border-slate-950/25",
                  )}
                  style={{
                    background: `linear-gradient(105deg, rgb(255 255 255 / 0.48) 0%, ${plateColor} 24%, ${plateColor} 72%, rgb(15 23 42 / 0.28) 100%)`,
                    minWidth: isFractional ? "8px" : "14px",
                    boxShadow: "2px 3px 5px rgb(15 23 42 / 0.3), inset 1px 0 rgb(255 255 255 / 0.55), inset -2px 0 rgb(15 23 42 / 0.2)",
                  }}
                  title={`${plate.weight}${unit}`}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 -left-3 w-2/3 -skew-x-12 bg-white/35 blur-[2px]"
                  />
                </motion.div>
              );
            })}
          <motion.div
            aria-hidden="true"
            className="h-9 w-2 rounded-sm border border-slate-950/40"
            style={SLEEVE_STYLE}
            initial={{ x: slideFromLeft ? -24 : 24, opacity: 0, scaleY: 0.8 }}
            animate={{ x: 0, opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.3, delay: animationDelay + platesPerSide.length * 0.07 }}
          />
        </div>
      </div>

      {/* Plate labels - right-aligned, showing one side only */}
      {!hideLabels && (
        <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
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
