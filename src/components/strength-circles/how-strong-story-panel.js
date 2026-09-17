/**
 * First-person story panel for How Strong Am I.
 * The sentences are the readout and the sliders are the input: drag anything and
 * the prose plus the rings move together. Deliberately no typed number fields —
 * every other tool here is slider-and-toggle because that is what works on a
 * phone. Bench leads; squat and deadlift follow. Lives on the same surface as
 * the rings — no nested card — so the two columns read as one instrument.
 * Weights arrive already converted to the displayed unit, so this file only
 * ever formats and echoes back display values.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Copy, RotateCcw, Sparkles, Upload } from "lucide-react";

import { LiftArtwork } from "@/components/lift-artwork";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { getUniverseOfLabel } from "@/components/strength-circles/strength-circles-chart";
import { UnitChooser } from "@/components/unit-type-chooser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
  useAthleteBio,
} from "@/hooks/use-athlete-biodata";
import { getStrengthLevelsPath } from "@/lib/lifts/lift-registry";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { cn } from "@/lib/utils";

const STORY_LIFTS = [
  {
    key: "bench",
    label: "Bench Press",
    linkText: "bench press",
    href: "/calculator/bench-press-1rm-calculator",
  },
  {
    key: "squat",
    label: "Back Squat",
    linkText: "squat",
    href: "/calculator/squat-1rm-calculator",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    linkText: "deadlift",
    href: "/calculator/deadlift-1rm-calculator",
  },
];

const STORY_LINK_CLASSES =
  "font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline";

export function HowStrongStoryPanel({
  liftWeights,
  onLiftChange,
  onReset,
  onResetTo90d,
  onUnitChange,
  usingUserData,
  queryHydrated = false,
  hasArrivalLiftQuery = false,
  prWeights,
  recent90d,
  results,
  activeUniverse,
  chartPercentiles,
  onCopyResult,
  firstName,
  showImportTeaser,
  historySlot,
}) {
  const {
    age,
    setAge,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    isMetric,
    bioDataIsDefault,
    bioDataIsInitialized,
  } = useAthleteBio();
  const prefersReducedMotion = useReducedMotion();

  // Calling a stranger's example numbers "Beginner" on arrival is a verdict on
  // someone we know nothing about, so without a log to read from each lift waits
  // until its own slider has been set before it earns a rating.
  const [movedLifts, setMovedLifts] = useState({});
  const [touchedBio, setTouchedBio] = useState({ age: false, bodyWeight: false });
  const [allowBioHint, setAllowBioHint] = useState(false);
  const bioHintDecidedRef = useRef(false);

  // Decide once bio has hydrated from localStorage. A saved profile means they
  // already know those sliders exist; changing age later must not also silence
  // bodyweight.
  useEffect(() => {
    if (bioHintDecidedRef.current || !bioDataIsInitialized) return;
    bioHintDecidedRef.current = true;
    setAllowBioHint(bioDataIsDefault);
  }, [bioDataIsDefault, bioDataIsInitialized]);

  // No log, no arrival URL, no saved bio: invite play. Wait until the URL has
  // been read so a shared link cannot flash a pulse then snatch it away.
  // Bio thumbs stay still when this browser already has a profile, or when the
  // URL already supplied lift numbers — both count as engagement.
  const invitePlay =
    queryHydrated &&
    !usingUserData &&
    !hasArrivalLiftQuery &&
    !prefersReducedMotion;
  const hintAge = invitePlay && allowBioHint && !touchedBio.age;
  const hintBodyWeight = invitePlay && allowBioHint && !touchedBio.bodyWeight;
  const hintBench = invitePlay && !movedLifts.bench;

  const unit = isMetric ? "kg" : "lb";
  const min = isMetric ? 20 : 44;
  const max = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;

  const hasMovedFromPR =
    usingUserData &&
    prWeights &&
    STORY_LIFTS.some(
      ({ key }) =>
        prWeights[key] != null && liftWeights[key] !== prWeights[key],
    );

  const hasMovedFrom90d =
    usingUserData &&
    recent90d &&
    STORY_LIFTS.some(
      ({ key }) =>
        recent90d[key] != null && liftWeights[key] !== recent90d[key],
    );

  const total =
    liftWeights.squat + liftWeights.bench + liftWeights.deadlift;
  // Same number the rings show: mean of the three lifts, not the SBD-total
  // percentile, so this card cannot disagree with the centre label.
  const displayPercentile = chartPercentiles?.[activeUniverse];
  // 1000lb club is a pounds milestone even when the page is showing kg.
  const thousandClubLabel = getThousandClubLabel(
    Math.round(isMetric ? total * 2.2046 : total),
  );
  const showStoryHeader =
    hasMovedFromPR || hasMovedFrom90d || usingUserData;

  return (
    <div className="flex flex-col gap-4 sm:gap-7">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          !showStoryHeader && "hidden sm:flex",
        )}
      >
          <h2 className="text-lg font-semibold">My strength story</h2>
          <div className="flex flex-wrap items-center gap-2">
            {hasMovedFromPR && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onReset}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to PRs
              </Button>
            )}
            {hasMovedFrom90d && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onResetTo90d}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to 90-day bests
              </Button>
            )}
            {usingUserData && !hasMovedFromPR && !hasMovedFrom90d && (
              <Badge variant="outline" className="gap-1 font-normal">
                <Sparkles className="h-3 w-3" />
                From your log
              </Badge>
            )}
          </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
          <p className="text-lg leading-snug sm:text-xl sm:leading-relaxed">
            I am a <StoryValue>{age}</StoryValue> year-old{" "}
            <StoryValue>{sex}</StoryValue> weighing{" "}
            <StoryValue className="whitespace-nowrap">
              {bodyWeight}
              {unit}
            </StoryValue>
            .
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3 sm:contents">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Label
                  htmlFor="story-age-slider"
                  className="w-12 shrink-0 text-xs font-normal text-muted-foreground"
                >
                  Age
                </Label>
                <Slider
                  id="story-age-slider"
                  className={cn("min-w-0 flex-1", hintAge && "slider-thumb-hint")}
                  min={13}
                  max={100}
                  step={1}
                  value={[age]}
                  tooltip={age}
                  onValueChange={([value]) => {
                    setTouchedBio((previous) =>
                      previous.age ? previous : { ...previous, age: true },
                    );
                    setAge(value);
                  }}
                  aria-label="Age"
                />
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  M
                </span>
                <Switch
                  aria-label="Sex"
                  checked={sex === "female"}
                  onCheckedChange={(checked) =>
                    setSex(checked ? "female" : "male")
                  }
                  className="data-[state=checked]:bg-pink-500 data-[state=unchecked]:bg-blue-500"
                />
                <span className="text-sm font-semibold text-muted-foreground">
                  F
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Label
                htmlFor="story-bodyweight-slider"
                className="w-12 shrink-0 text-xs font-normal text-muted-foreground"
              >
                Weight
              </Label>
              <Slider
                id="story-bodyweight-slider"
                className={cn(
                  "min-w-0 flex-1",
                  hintBodyWeight &&
                    "slider-thumb-hint slider-thumb-hint-delay-1",
                )}
                min={isMetric ? 40 : 90}
                max={isMetric ? 180 : 400}
                step={1}
                value={[bodyWeight]}
                tooltip={`${bodyWeight} ${unit}`}
                onValueChange={([value]) => {
                  setTouchedBio((previous) =>
                    previous.bodyWeight
                      ? previous
                      : { ...previous, bodyWeight: true },
                  );
                  setBodyWeight(value);
                }}
                aria-label="Bodyweight"
              />
              <UnitChooser isMetric={isMetric} onSwitchChange={onUnitChange} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          {STORY_LIFTS.map(({ key, label, linkText, href }, index) => {
              const prWeight = prWeights?.[key];
              const r90Weight = recent90d?.[key];
              const prPercent =
                prWeight != null
                  ? ((prWeight - min) / (max - min)) * 100
                  : null;
              const r90Percent =
                r90Weight != null
                  ? ((r90Weight - min) / (max - min)) * 100
                  : null;
              const showPrMarker =
                usingUserData &&
                prPercent != null &&
                prPercent >= 0 &&
                prPercent <= 100;
              const showR90Marker =
                usingUserData &&
                r90Percent != null &&
                r90Percent >= 0 &&
                r90Percent <= 100 &&
                r90Weight !== prWeight;

              const liftResult = results?.lifts?.[key];
              const showRating = usingUserData || movedLifts[key];
              const rating =
                showRating && liftResult?.standard
                  ? getStrengthRatingForE1RM(
                      toKg(liftWeights[key], isMetric),
                      liftResult.standard,
                    )
                  : null;
              const strengthLevelsPath = getStrengthLevelsPath(label);

              const commitLift = (value) => {
                setMovedLifts((previous) =>
                  previous[key] ? previous : { ...previous, [key]: true },
                );
                onLiftChange(key, normalizeLiftWeight(value, isMetric));
              };

              return (
                <motion.div
                  key={key}
                  className="group flex items-center gap-3 sm:gap-4"
                  initial={
                    prefersReducedMotion ? undefined : { opacity: 0, x: -16 }
                  }
                  animate={
                    prefersReducedMotion ? undefined : { opacity: 1, x: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                    delay: 0.08 + index * 0.08,
                  }}
                >
                  <Link
                    prefetch={false}
                    href={href}
                    tabIndex={-1}
                    aria-hidden
                    className="flex w-24 shrink-0 justify-center sm:w-28"
                  >
                    <LiftArtwork
                      liftType={label}
                      size="md"
                      animate={false}
                      className="transition-transform duration-200 group-hover:scale-105"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-relaxed sm:text-lg">
                      My{" "}
                      <Link
                        prefetch={false}
                        href={href}
                        className={STORY_LINK_CLASSES}
                      >
                        {linkText}
                      </Link>{" "}
                      is{" "}
                      <StoryValue className="whitespace-nowrap">
                        {liftWeights[key]}
                        {unit}
                      </StoryValue>
                      .
                    </p>

                    <div className="relative mt-2 pb-5">
                      <Slider
                        value={[liftWeights[key]]}
                        tooltip={`${liftWeights[key]} ${unit}`}
                        className={
                          key === "bench" && hintBench
                            ? "slider-thumb-hint slider-thumb-hint-delay-2"
                            : undefined
                        }
                        onValueChange={([value]) => {
                          // Snap to a PR or 90-day marker when within one step
                          if (
                            prWeight != null &&
                            Math.abs(value - prWeight) <= step
                          ) {
                            commitLift(prWeight);
                          } else if (
                            r90Weight != null &&
                            Math.abs(value - r90Weight) <= step
                          ) {
                            commitLift(r90Weight);
                          } else {
                            commitLift(value);
                          }
                        }}
                        min={min}
                        max={max}
                        step={step}
                        aria-label={`${label} one rep max slider`}
                      />
                      {showPrMarker && (
                        <SliderMarker percent={prPercent} label="PR" />
                      )}
                      {showR90Marker && (
                        <SliderMarker
                          percent={r90Percent}
                          label="90d"
                          tone="amber"
                        />
                      )}
                    </div>

                    {rating && (
                      <RatingBadge
                        rating={rating}
                        href={strengthLevelsPath}
                        liftLabel={label}
                      />
                    )}
                  </div>
                </motion.div>
              );
          })}
        </div>

        {results?.hasAllThree && results.total && (
          <>
            <div className="rounded-xl border px-4 py-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Squat + bench + deadlift
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {Math.round(total)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      {unit}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    Stronger than
                  </p>
                  <p className="text-3xl font-extrabold tabular-nums leading-none">
                    {displayPercentile ?? "—"}
                    {displayPercentile != null && (
                      <span className="text-xl font-bold">%</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getUniverseOfLabel(activeUniverse)}
                  </p>
                </div>
              </div>
              {thousandClubLabel && (
                <p className="mt-2 text-sm">
                  <Link
                    prefetch={false}
                    href="/1000lb-club-calculator"
                    className={STORY_LINK_CLASSES}
                  >
                    {thousandClubLabel}
                  </Link>
                </p>
              )}
              {onCopyResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCopyResult}
                  className="mt-3 w-full gap-2 lg:hidden"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy result
                </Button>
              )}
            </div>

            <PercentileConclusion
              percentile={displayPercentile}
              universe={activeUniverse}
              allPercentiles={chartPercentiles}
              firstName={firstName}
            />
          </>
        )}

        {historySlot}

        {showImportTeaser && !historySlot && (
          <div className="rounded-xl border p-4">
            <p className="text-base font-semibold">Make this real</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              These numbers are a guess until your training log fills them.
              Import a Hevy, Strong, or spreadsheet export to auto-fill your
              real PRs and watch how your percentile has moved.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild size="sm" className="gap-2">
                <Link href="/import" prefetch={false}>
                  <Upload className="h-3.5 w-3.5" />
                  Import a file
                </Link>
              </Button>
              <GoogleSignInButton
                cta="how_strong_am_i"
                iconSize={16}
                size="sm"
                variant="outline"
              >
                Sign in with Google
              </GoogleSignInButton>
            </div>
          </div>
        )}
    </div>
  );
}

/** Strength level for one lift, linking to that lift's own standards page. */
function RatingBadge({ rating, href, liftLabel }) {
  const badge = (
    <Badge variant={getRatingBadgeVariant(rating)} className="text-xs">
      {STRENGTH_LEVEL_EMOJI[rating]} {rating}
    </Badge>
  );

  if (!href) return badge;

  return (
    <Link
      prefetch={false}
      href={href}
      title={`See all ${liftLabel} strength levels`}
      className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {badge}
    </Link>
  );
}

/** A value inside the prose. Bold and nothing else — the control below it is the affordance. */
function StoryValue({ children, className }) {
  return (
    <strong className={cn("font-bold tabular-nums", className)}>
      {children}
    </strong>
  );
}

function SliderMarker({ percent, label, tone = "primary" }) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 flex flex-col items-center"
      style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
    >
      <div
        className={cn(
          "h-3 w-px",
          tone === "amber" ? "bg-amber-500/40" : "bg-primary/40",
        )}
      />
      <span
        className={cn(
          "text-[9px] font-medium leading-none",
          tone === "amber" ? "text-amber-600/60" : "text-primary/60",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function PercentileConclusion({ percentile, universe, allPercentiles, firstName }) {
  if (percentile == null) return null;

  const name = firstName || "You";
  const namePos = firstName ? `${firstName}'s` : "Your";
  const u = universe.toLowerCase();

  let headline;
  let detail;

  if (percentile >= 95) {
    headline = `Elite territory${firstName ? `, ${firstName}` : ""}.`;
    detail = `Stronger than ${percentile}% of ${u}. Very few people reach this level \u2014 years of serious, consistent training got ${name.toLowerCase() === "you" ? "you" : firstName} here.`;
  } else if (percentile >= 85) {
    headline = "Seriously strong.";
    detail = `${name}'${name.endsWith("s") ? "" : "s"} stronger than ${percentile}% of ${u}. Well past the point where people notice \u2014 this is dedicated-lifter strength.`;
  } else if (percentile >= 70) {
    headline = "Above average, clearly trained.";
    detail = `Stronger than ${percentile}% of ${u}. ${namePos} training is paying off \u2014 most people who lift don\u2019t reach this range.`;
  } else if (percentile >= 50) {
    headline = "Solid foundation.";
    detail = `Stronger than ${percentile}% of ${u}. Right in the middle of the pack, with real room to grow. Consistency will move this number.`;
  } else if (percentile >= 30) {
    headline = "Building momentum.";
    detail = `Stronger than ${percentile}% of ${u}. Everyone starts somewhere, and the biggest jumps happen in this range. Keep showing up.`;
  } else {
    headline = "Early days \u2014 big gains ahead.";
    detail = `Stronger than ${percentile}% of ${u}. The good news? Beginners progress faster than anyone. A few months of consistent work will change this dramatically.`;
  }

  const extras = [];
  if (allPercentiles) {
    if (
      universe !== "General Population" &&
      allPercentiles["General Population"] != null
    ) {
      extras.push(
        `${ordinal(allPercentiles["General Population"])} percentile in the general population`,
      );
    }
    if (
      universe !== "Barbell Lifters" &&
      allPercentiles["Barbell Lifters"] != null
    ) {
      extras.push(
        `${ordinal(allPercentiles["Barbell Lifters"])} among barbell lifters`,
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-base font-semibold">{headline}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {detail}
        {extras.length > 0 && ` ${extras.join(", ")}.`}
      </p>
    </div>
  );
}

function normalizeLiftWeight(weight, isMetric) {
  const min = isMetric ? 20 : 44;
  const max = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;
  const rounded = Math.round(weight / step) * step;
  return Math.min(Math.max(rounded, min), max);
}

function toKg(weight, isMetric) {
  return isMetric ? weight : weight / 2.2046;
}

function getThousandClubLabel(totalLb) {
  if (totalLb >= 1000) return "In the 1000lb club";
  if (totalLb >= 900) return "You are approaching the 1000lb club!";
  return null;
}

function ordinal(n) {
  if (n == null) return "—";
  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}
