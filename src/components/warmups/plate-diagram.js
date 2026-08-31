
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

const PLATE_STOP_STYLE = {
  background:
    "linear-gradient(90deg, #475569 0%, #f8fafc 28%, #cbd5e1 54%, #64748b 78%, #1e293b 100%)",
  boxShadow: "1px 2px 4px rgb(15 23 42 / 0.35), inset 1px 0 rgb(255 255 255 / 0.8)",
};

const KNURL_SECTION_STYLE = {
  background:
    "repeating-linear-gradient(135deg, #1e293b 0 2px, #64748b 2px 3px, #0f172a 3px 5px)",
  boxShadow: "inset 0 1px rgb(255 255 255 / 0.25), 0 2px 3px rgb(15 23 42 / 0.3)",
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
  const innermostPlate = platesPerSide[0];
  const innermostPlateIsFractional =
    innermostPlate?.weight === 2.5 || innermostPlate?.weight === 1.25;
  // The stop sits behind the plate, so it should never visually outsize the
  // plate it supports; fractional plates need a proportionally smaller stop.
  const plateStopHeightClass = innermostPlateIsFractional ? "h-7" : "h-12";

  const renderBar = () => (
    <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-end">
      <motion.div
        className="relative h-3 w-48 overflow-hidden rounded-full"
        style={{
          ...BAR_STYLE,
          // Fade the unloaded end so this reads as the loaded half of a barbell.
          maskImage: "linear-gradient(90deg, transparent 0%, black 18%, black 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 18%, black 100%)",
        }}
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
        {/* A compact knurl band gives the shaft a tactile power-bar cue without
            turning the symbolic diagram into a photo-realistic illustration. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/4 right-1/4 opacity-35"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0 2px, rgb(15 23 42 / 0.55) 2px 3px, transparent 3px 5px)",
          }}
        />
        {/* Subtle powerlifting reference marks, kept generic rather than branded. */}
        <span aria-hidden="true" className="absolute inset-y-[-1px] left-[43%] w-px bg-slate-950/45" />
        <span aria-hidden="true" className="absolute inset-y-[-1px] left-[47%] w-px bg-slate-950/45" />
      </motion.div>
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
        {/* The shaft remains visible behind the plates so the loading direction is clear. */}
        {renderBar()}

        {/* Plates stacked over the right-hand side of the bar, vertically centered, with sleeve visible beyond */}
        <div key={animationKey ?? "static"} className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* This is a compact sleeve assembly rather than a second plate:
              chrome stop nearest the plates, a thick dark shoulder, then a
              short knurled section returning into the shaft. */}
          <motion.div
            aria-hidden="true"
            className="flex items-center gap-0"
            initial={{ x: slideFromLeft ? -20 : 20, opacity: 0, scaleY: 0.85 }}
            animate={{ x: 0, opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.3, delay: animationDelay + 0.08 }}
          >
            <span
              className="h-4 w-5 rounded-l-sm"
              style={KNURL_SECTION_STYLE}
            />
            <span className="h-7 w-2.5 rounded-sm border border-black/80 bg-gradient-to-b from-slate-700 via-slate-950 to-black shadow-[1px_2px_3px_rgb(15_23_42_/_0.35)]" />
            <span
              className={cn(plateStopHeightClass, "w-1.5 rounded-r-full border border-slate-950/35")}
              style={PLATE_STOP_STYLE}
            />
          </motion.div>
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
          {/* A short sleeve tail beyond the plates preserves the visual
              direction of the bar without adding a separate collar graphic. */}
          <motion.span
            aria-hidden="true"
            className="h-2 w-5 rounded-r-full border-y border-r border-slate-950/50"
            style={BAR_STYLE}
            initial={{ x: slideFromLeft ? -18 : 18, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.25, delay: animationDelay + platesPerSide.length * 0.07 + 0.08 }}
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
