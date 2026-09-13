/**
 * The stage at the top of the Lift Explorer detail panel: the lift's drawing,
 * its name, and three headline counts, lit in the lift's own colour.
 *
 * It is built to be remounted on every lift switch (the panel keys it by lift),
 * so every entrance here is a mount animation rather than a reaction to prop
 * changes. `direction` says which way through the lift list the lifter moved,
 * so the new lift sweeps in from the side it came from.
 *
 * Artwork is optional. An undrawn lift still gets the colour, the giant name
 * and the counts, just no figure, so drawing a new diagram is the only step
 * needed to light up the right-hand side for that lift.
 */

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { getLiftArtwork } from "@/components/lift-artwork";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { parseYmdLocal } from "@/lib/date-utils";

const SPRING = { type: "spring", stiffness: 220, damping: 24, mass: 0.9 };

/**
 * @param {Object} props
 * @param {string} props.liftType - The lift on stage.
 * @param {number} [props.direction=1] - 1 when moving down the lift list, -1 when moving up.
 */
export function LiftStage({ liftType, direction = 1 }) {
  const { liftTypes } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const color = getColor(liftType);
  const artSrc = getLiftArtwork(liftType);

  const rankIndex = liftTypes?.findIndex((l) => l.liftType === liftType) ?? -1;
  const entry = rankIndex >= 0 ? liftTypes[rankIndex] : null;
  const sinceLabel = formatMonthYear(entry?.oldestDate);

  // Same rule as the old header link: only point out when there is an
  // editorial guide to go to, not back at this explorer.
  const guideUrl = getLiftDetailUrl(liftType);
  const hasGuidePage = guideUrl && !guideUrl.startsWith("/lift-explorer");

  const words = liftType.split(" ");
  const dir = direction >= 0 ? 1 : -1;

  return (
    <div
      className="bg-card relative isolate overflow-hidden rounded-xl border shadow-sm"
      style={{ "--stage": color }}
    >
      {/* Colour wash: a strong pool behind the lifter, fading to the card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(120% 140% at 85% 60%, color-mix(in srgb, var(--stage) 30%, transparent) 0%, color-mix(in srgb, var(--stage) 8%, transparent) 45%, transparent 75%)`,
        }}
      />
      {/* Faint diagonal hatching in the lift colour, like chalk on a platform. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] dark:opacity-[0.14]"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, var(--stage) 0 1px, transparent 1px 14px)`,
          maskImage: "linear-gradient(to left, black 10%, transparent 70%)",
        }}
      />

      {/* Light sweep: one diagonal band of colour that crosses the stage on arrival. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-20%] -z-10 w-1/3 -skew-x-12"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--stage) 35%, transparent), transparent)`,
        }}
        initial={{ left: dir > 0 ? "-40%" : "110%" }}
        animate={{ left: dir > 0 ? "110%" : "-40%" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      />

      {/* Giant watermark name, sliding the opposite way to the lifter for parallax. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-0.18em] left-3 -z-10 text-[clamp(3.5rem,11vw,9rem)] leading-none font-black tracking-tighter whitespace-nowrap uppercase select-none"
        style={{
          color: "transparent",
          WebkitTextStroke: "1.5px color-mix(in srgb, var(--stage) 45%, transparent)",
        }}
        initial={{ x: -120 * dir, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...SPRING, stiffness: 120, damping: 26 }}
      >
        {liftType}
      </motion.span>

      {/* Accent rail along the top edge, drawn outward from the side we came from. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{
          backgroundColor: "var(--stage)",
          transformOrigin: dir > 0 ? "left" : "right",
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />

      <div
        className={`relative flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center ${
          artSrc ? "md:min-h-64" : "md:min-h-44"
        }`}
      >
        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-4">
          <motion.div
            className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase"
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, delay: 0.05 }}
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: "var(--stage)" }}
            />
            {rankIndex >= 0 && liftTypes.length > 1
              ? `Lift ${rankIndex + 1} of ${liftTypes.length}`
              : "Your lift"}
          </motion.div>

          {/* Each word rises out of its own mask, so the name assembles itself. */}
          <h2 className="text-4xl leading-[0.95] font-bold tracking-tight sm:text-5xl">
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="inline-block overflow-hidden pr-[0.25em] pb-[0.08em] align-bottom"
              >
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ ...SPRING, delay: 0.08 + i * 0.06 }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h2>

          {entry && (
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <StageStat
                label="Sets"
                value={entry.totalSets}
                delay={0.18}
                dir={dir}
              />
              <StageStat
                label="Reps"
                value={entry.totalReps}
                delay={0.24}
                dir={dir}
              />
              {sinceLabel && (
                <StageStat
                  label="Training since"
                  text={sinceLabel}
                  delay={0.3}
                  dir={dir}
                />
              )}
            </div>
          )}

          {hasGuidePage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <Link
                href={guideUrl}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                Full {liftType} guide
                <ArrowUpRight className="size-4" />
              </Link>
            </motion.div>
          )}
        </div>

        {artSrc && (
          <div className="relative flex shrink-0 items-end justify-center md:w-[46%] md:justify-end">
            {/* Floor shadow grounds the figures on the stage. */}
            <motion.span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-[50%] blur-md md:left-auto md:right-[5%] md:translate-x-0"
              style={{
                background: `color-mix(in srgb, var(--stage) 40%, black 20%)`,
                opacity: 0.35,
              }}
              initial={{ scaleX: 0.2, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.35 }}
              transition={{ ...SPRING, delay: 0.1 }}
            />
            <motion.div
              className="relative"
              initial={{
                x: 140 * dir,
                opacity: 0,
                scale: 0.82,
                rotate: 4 * dir,
                filter: "blur(10px)",
              }}
              animate={{
                x: 0,
                opacity: 1,
                scale: 1,
                rotate: 0,
                filter: "blur(0px)",
                transitionEnd: { filter: "none" },
              }}
              transition={{ ...SPRING, stiffness: 180, damping: 20, delay: 0.06 }}
            >
              <Image
                src={artSrc}
                alt={`${liftType} diagram`}
                width={1000}
                height={600}
                // Lift artwork is always served straight from public/; see
                // the rendering note at the top of lift-artwork.js.
                unoptimized
                loading="eager"
                className="h-44 w-auto max-w-full object-contain sm:h-52 md:h-56 lg:h-60"
              />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One headline count. Numbers roll up from zero on arrival; text just rises.
 */
function StageStat({ label, value, text, delay, dir }) {
  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 12, x: 12 * dir }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ ...SPRING, delay }}
    >
      <span className="text-2xl leading-none font-semibold tabular-nums">
        {text ?? <RollingNumber value={value} delay={delay} />}
      </span>
      <span className="text-muted-foreground mt-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {label}
      </span>
    </motion.div>
  );
}

/**
 * Counts up to `value` through a motion value, so the roll never re-renders
 * React. Lifters who ask for reduced motion get the final number immediately.
 */
function RollingNumber({ value, delay = 0 }) {
  const prefersReducedMotion = useReducedMotion();
  const count = useMotionValue(prefersReducedMotion ? value : 0);
  const display = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (prefersReducedMotion) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, {
      duration: 0.9,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [count, value, delay, prefersReducedMotion]);

  return <motion.span>{display}</motion.span>;
}

/** "Jul 2019" from a YYYY-MM-DD string, or null. */
function formatMonthYear(ymd) {
  const date = ymd ? parseYmdLocal(ymd) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
