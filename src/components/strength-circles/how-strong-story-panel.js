/**
 * First-person story panel for How Strong Am I.
 * Bio and lifts read as editable sentences so visitors customize a narrative
 * instead of filling a settings form. Bench leads; squat and deadlift follow.
 * Sliders under each lift keep the rings playful.
 */

import Link from "next/link";
import { Upload, Sparkles, RotateCcw } from "lucide-react";

import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
  useAthleteBio,
} from "@/hooks/use-athlete-biodata";
import { getLiftArtwork } from "@/components/lift-artwork";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { cn } from "@/lib/utils";

const STORY_LIFTS = [
  {
    key: "bench",
    label: "Bench Press",
    before: "My",
    linkText: "bench press",
    after: "is",
    svg: getLiftArtwork("Bench Press"),
    href: "/calculator/bench-press-1rm-calculator",
  },
  {
    key: "squat",
    label: "Back Squat",
    before: "My",
    linkText: "squat",
    after: "is",
    svg: getLiftArtwork("Back Squat"),
    href: "/calculator/squat-1rm-calculator",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    before: "My",
    linkText: "deadlift",
    after: "is",
    svg: getLiftArtwork("Deadlift"),
    href: "/calculator/deadlift-1rm-calculator",
  },
];

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

function ordinal(n) {
  if (n == null) return "—";
  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

function StoryNumberBlank({
  value,
  onChange,
  ariaLabel,
  min,
  max,
  step = 1,
  widthCh = 4,
  className,
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") return;
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) return;
        onChange(parsed);
      }}
      className={cn(
        "mx-0.5 inline-block appearance-none border-0 border-b-2 border-primary/50 bg-transparent px-0.5 py-0 text-center font-bold tabular-nums text-foreground [appearance:textfield] focus:border-primary focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
      style={{ width: `${widthCh}ch` }}
    />
  );
}

function SexBlank({ sex, onChange }) {
  return (
    <select
      value={sex}
      aria-label="Sex"
      onChange={(event) => onChange(event.target.value)}
      className="mx-0.5 cursor-pointer appearance-none border-0 border-b-2 border-primary/50 bg-transparent px-0.5 py-0 font-bold text-foreground focus:border-primary focus:outline-none focus:ring-0"
    >
      <option value="male">male</option>
      <option value="female">female</option>
    </select>
  );
}

export function HowStrongStoryPanel({
  liftWeights,
  onLiftChange,
  onReset,
  onResetTo90d,
  onUnitChange,
  usingUserData,
  prWeights,
  recent90d,
  results,
  activeUniverse,
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
  } = useAthleteBio();

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

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your story
            </p>
            {bioDataIsDefault && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Example athlete — change this to make the rank yours.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasMovedFromPR && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
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
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onResetTo90d}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to 90-day bests
              </Button>
            )}
            {usingUserData && !hasMovedFromPR && !hasMovedFrom90d && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <Sparkles className="h-3 w-3" />
                From your log
              </Badge>
            )}
          </div>
        </div>

        {/* Bio sentence */}
        <p className="text-lg leading-relaxed text-foreground sm:text-xl">
          I am a
          <StoryNumberBlank
            value={age}
            onChange={(value) => setAge(Math.round(value))}
            ariaLabel="Age"
            min={13}
            max={90}
            step={1}
            widthCh={3}
            className="text-lg sm:text-xl"
          />
          year-old
          <SexBlank sex={sex} onChange={setSex} />
          athlete weighing
          <StoryNumberBlank
            value={bodyWeight}
            onChange={(value) => setBodyWeight(Math.round(value))}
            ariaLabel="Bodyweight"
            min={isMetric ? 30 : 66}
            max={isMetric ? 250 : 550}
            step={1}
            widthCh={4}
            className="text-lg sm:text-xl"
          />
          <span className="ml-1 inline-flex items-baseline gap-1 align-baseline">
            <button
              type="button"
              onClick={() => onUnitChange(!isMetric)}
              className="border-0 border-b-2 border-primary/50 bg-transparent px-0.5 font-bold tabular-nums text-foreground hover:border-primary"
              aria-label={`Switch units (currently ${unit})`}
            >
              {unit}
            </button>
          </span>
          .
        </p>

        {/* Lift sentences — bench first */}
        <div className="flex flex-col gap-5">
          {STORY_LIFTS.map(({ key, label, before, linkText, after, svg, href }) => {
            const prWeight = prWeights?.[key];
            const r90Weight = recent90d?.[key];
            const prPercent =
              prWeight != null ? ((prWeight - min) / (max - min)) * 100 : null;
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
            const rating = liftResult?.standard
              ? getStrengthRatingForE1RM(
                  toKg(liftWeights[key], isMetric),
                  liftResult.standard,
                )
              : null;

            const commitLift = (value) => {
              onLiftChange(key, normalizeLiftWeight(value, isMetric));
            };

            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-1.5 text-base leading-snug sm:text-lg">
                    <img
                      src={svg}
                      alt=""
                      className="h-8 w-8 object-contain dark:invert"
                      aria-hidden
                    />
                    <span>
                      {before}{" "}
                      <Link
                        prefetch={false}
                        href={href}
                        className="underline decoration-dotted underline-offset-2 hover:text-blue-600"
                      >
                        {linkText}
                      </Link>{" "}
                      {after}{" "}
                      <StoryNumberBlank
                        value={liftWeights[key]}
                        onChange={commitLift}
                        ariaLabel={`${label} 1RM`}
                        min={min}
                        max={max}
                        step={step}
                        widthCh={isMetric ? 5 : 4}
                        className="text-base sm:text-lg"
                      />
                      <span className="ml-0.5 font-bold tabular-nums">
                        {unit}
                      </span>
                      .
                    </span>
                  </p>
                  {rating && (
                    <Badge
                      variant={getRatingBadgeVariant(rating)}
                      className="text-xs"
                    >
                      {STRENGTH_LEVEL_EMOJI[rating]} {rating}
                    </Badge>
                  )}
                </div>
                <div className="relative pb-5">
                  <Slider
                    value={[liftWeights[key]]}
                    onValueChange={([value]) => {
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
                    aria-label={`${label} 1RM slider`}
                  />
                  {showPrMarker && (
                    <div
                      className="pointer-events-none absolute bottom-0 flex flex-col items-center"
                      style={{
                        left: `${prPercent}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="h-3 w-px bg-primary/40" />
                      <span className="text-[9px] font-medium leading-none text-primary/60">
                        PR
                      </span>
                    </div>
                  )}
                  {showR90Marker && (
                    <div
                      className="pointer-events-none absolute bottom-0 flex flex-col items-center"
                      style={{
                        left: `${r90Percent}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="h-3 w-px bg-amber-500/40" />
                      <span className="text-[9px] font-medium leading-none text-amber-600/60">
                        90d
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {results?.hasAllThree && results.total && (
          <>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Squat + bench + deadlift
              </span>
              <span className="font-bold tabular-nums">
                {ordinal(results.total.percentiles?.[activeUniverse])}
              </span>
            </div>
            <PercentileConclusion
              percentile={results.total.percentiles?.[activeUniverse]}
              universe={activeUniverse}
              allPercentiles={results.total.percentiles}
              firstName={firstName}
            />
          </>
        )}

        {historySlot}

        {showImportTeaser && !historySlot && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-1 text-sm font-medium">Make this real</p>
            <p className="mb-3 text-sm text-muted-foreground">
              These numbers are a guess until your log fills them. Import a
              Hevy, Strong, or spreadsheet export to auto-fill PRs and see how
              your percentile moved.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild size="sm" className="gap-2">
                <Link href="/import" prefetch={false}>
                  <Upload className="h-3.5 w-3.5" />
                  Import a file
                </Link>
              </Button>
              <GoogleSignInButton
                className="flex items-center gap-2"
                cta="how_strong_am_i"
                iconSize={16}
                size="sm"
                variant="outline"
              >
                Sign In With Google
              </GoogleSignInButton>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-sm font-semibold">{headline}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {detail}
        {extras.length > 0 && ` ${extras.join(", ")}.`}
      </p>
    </div>
  );
}
