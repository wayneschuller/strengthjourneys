
/**
 * Renders the loading sequence for a warm-up set. The diagram intentionally
 * keeps one-sided loading simple, while the animation supplies enough depth
 * and motion to make each plate change feel like a real barbell setup.
 *
 * Motion here is meant to be informative rather than decorative: when the
 * caller supplies the previous set's loading, only the plates you actually walk
 * over and add animate in. Plates already on the bar are simply there.
 */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { FULL_PLATE_DIAMETER, getPlateDimensions } from "@/lib/warmups";

const BAR_STYLE = {
  background:
    "linear-gradient(180deg, #f8fafc 0%, #94a3b8 18%, #334155 48%, #cbd5e1 76%, #475569 100%)",
  boxShadow: "0 2px 5px rgb(15 23 42 / 0.3), inset 0 1px rgb(255 255 255 / 0.7)",
};

// Diagram geometry, in px, matching the Tailwind classes on the containers.
const DIAGRAM_WIDTH = 224; // w-56
const SLEEVE_ANCHOR = 128; // left-32: where the innermost plate meets the shoulder
const SLEEVE_LENGTH = DIAGRAM_WIDTH - SLEEVE_ANCHOR;
const FULL_PLATE_HEIGHT = 80; // a 450mm disc at full scale
const MIN_PLATE_WIDTH = 5; // a true-to-scale 1.25kg would be too thin to read
const PLATE_GAP = 4;
const TIGHT_PLATE_GAP = 2; // crowded bars close the collars up
const CROWDED_PLATE_COUNT = 5;

/** A pure white plate disappears against a light card, so nudge it to silver. */
function displayColor(color) {
  return color === "#FFFFFF" ? "#E5E7EB" : color;
}

/**
 * Plate footprint drawn at one scale from the real dimensions, so the sleeve
 * reads like a loaded bar: the four coded plates share a diameter and separate
 * themselves by thickness, while the change plates step down in both.
 */
function plateGeometry(weight, isMetric) {
  const { diameter, thickness } = getPlateDimensions(weight, isMetric);
  const scale = FULL_PLATE_HEIGHT / FULL_PLATE_DIAMETER;
  const height = Math.round(diameter * scale);
  const width = Math.max(MIN_PLATE_WIDTH, Math.round(thickness * scale));
  return {
    height,
    width,
    // A 2px border would swallow a change plate whole.
    borderWidth: width >= 8 ? 2 : 1,
    radius: Math.max(2, Math.round(height / 20)),
  };
}

/**
 * Flatten the per-side breakdown into individual discs, heaviest first, and
 * mark which of them are new relative to the previous set. Within a weight the
 * carried discs sit inboard, so the added ones are the trailing instances.
 *
 * @param {Array} platesPerSide - {weight, color, count} objects for this set
 * @param {Array} [previousPlatesPerSide] - Same shape for the preceding set
 * @param {boolean} isMetric - Whether weights are kg
 * @returns {Array} Individual plates with geometry and an `isNew` flag
 */
function buildLoadedPlates(platesPerSide, previousPlatesPerSide, isMetric) {
  const hasPrevious = Array.isArray(previousPlatesPerSide);
  const carriedByWeight = new Map();
  if (hasPrevious) {
    for (const plate of previousPlatesPerSide) {
      carriedByWeight.set(
        plate.weight,
        (carriedByWeight.get(plate.weight) ?? 0) + plate.count,
      );
    }
  }

  // Sort defensively: a bar loaded small-plate-inboard would be physically wrong.
  return [...platesPerSide]
    .sort((a, b) => b.weight - a.weight)
    .flatMap((plate) => {
      const carried = carriedByWeight.get(plate.weight) ?? 0;
      return Array.from({ length: plate.count }, (_, i) => ({
        ...plate,
        ...plateGeometry(plate.weight, isMetric),
        isNew: !hasPrevious || i >= carried,
      }));
    });
}

/**
 * Visual representation of plates on one side of a barbell
 * @param {Object} props
 * @param {Array} props.platesPerSide - Array of {weight, color, count} objects
 * @param {Array} [props.previousPlatesPerSide] - Previous set's loading; when given, only the added plates animate in
 * @param {number} props.barWeight - Weight of the barbell
 * @param {boolean} props.isMetric - Whether using kg (true) or lb (false)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.hideLabels - Whether to hide the plate labels
 * @param {number} [props.animationDelay] - Base delay (seconds) before plates animate in (for stagger between sets)
 * @param {string} [props.animationKey] - Key that changes when sliders change, retriggers plate animation
 * @param {boolean} [props.useScrollTrigger] - If true, animate when card scrolls into view (mobile); if false, animate immediately (desktop)
 */
export function PlateDiagram({
  platesPerSide = [],
  previousPlatesPerSide,
  barWeight,
  isMetric,
  className,
  hideLabels = false,
  animationDelay = 0,
  animationKey,
  useScrollTrigger = false,
}) {
  const unit = isMetric ? "kg" : "lb";

  const renderBar = () => (
    <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-end">
      <motion.div
        className="relative h-2 w-48 overflow-hidden rounded-full"
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

  const loadedPlates = buildLoadedPlates(
    platesPerSide,
    previousPlatesPerSide,
    isMetric,
  );

  // A heavy top set can ask for more discs than the sleeve has room for. Close
  // the gaps first, then zoom the whole stack out so it always stays on the
  // card instead of spilling over the border.
  const gap =
    loadedPlates.length > CROWDED_PLATE_COUNT ? TIGHT_PLATE_GAP : PLATE_GAP;
  const stackWidth =
    loadedPlates.reduce((total, plate) => total + plate.width, 0) +
    gap * (loadedPlates.length - 1);
  const fitScale = Math.min(1, SLEEVE_LENGTH / stackWidth);

  let newPlateIndex = 0;

  return (
    <div className={cn("flex flex-col items-end gap-8 mt-2", className)}>
      {/* Base barbell (same as bar-only state) with plates overlaid on the right */}
      <div className="relative flex min-h-[72px] w-56 items-center justify-end px-2 py-1">
        {/* The shaft remains visible behind the plates so the loading direction is clear. */}
        {renderBar()}

        {/* Plates stacked over the right-hand side of the bar, vertically centered, with sleeve visible beyond */}
        {/* The innermost plate stays against the same shoulder; added plates
            extend outward to the right, as they do when loading a real bar. */}
        <div
          key={animationKey ?? "static"}
          className="absolute left-32 top-1/2 -translate-y-1/2"
        >
          <div
            className="flex items-center"
            style={{
              gap: `${gap}px`,
              transform: `scale(${fitScale})`,
              transformOrigin: "left center",
            }}
          >
            {loadedPlates.map((plate, idx) => {
              const plateColor = displayColor(plate.color);
              // Only the plates you have to add carry the loading motion; the
              // rest are already on the bar and just need to be present.
              const delay = plate.isNew
                ? animationDelay + newPlateIndex++ * 0.08
                : animationDelay;
              const rest = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
              const initial = plate.isNew
                ? { x: 26, y: -6, rotate: 4, scale: 0.86, opacity: 0 }
                : { opacity: 0 };
              const transition = plate.isNew
                ? { duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.18, delay, ease: "easeOut" };

              return (
                <motion.div
                  key={`${plate.weight}-${idx}`}
                  initial={initial}
                  {...(useScrollTrigger
                    ? {
                        whileInView: rest,
                        viewport: { once: true, margin: "-20px" },
                      }
                    : { animate: rest })}
                  transition={transition}
                  className="group relative shrink-0 overflow-hidden border-slate-950/25"
                  style={{
                    height: `${plate.height}px`,
                    width: `${plate.width}px`,
                    borderRadius: `${plate.radius}px`,
                    borderWidth: `${plate.borderWidth}px`,
                    borderStyle: "solid",
                    background: `linear-gradient(105deg, rgb(255 255 255 / 0.48) 0%, ${plateColor} 24%, ${plateColor} 72%, rgb(15 23 42 / 0.28) 100%)`,
                    boxShadow:
                      "2px 3px 5px rgb(15 23 42 / 0.3), inset 1px 0 rgb(255 255 255 / 0.55), inset -2px 0 rgb(15 23 42 / 0.2)",
                  }}
                  title={`${plate.weight}${unit}`}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 -left-3 w-2/3 -skew-x-12 bg-white/35 blur-[2px]"
                  />
                  {/* A brief flash as the plate lands, so the eye catches which
                      discs changed between one set and the next. */}
                  {plate.isNew && previousPlatesPerSide && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 bg-white"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.55, 0] }}
                      transition={{ duration: 0.5, delay, ease: "easeOut" }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plate labels - right-aligned, showing one side only */}
      {!hideLabels && (
        <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
          {platesPerSide.map((plate, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded border border-border"
                style={{ backgroundColor: displayColor(plate.color) }}
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
