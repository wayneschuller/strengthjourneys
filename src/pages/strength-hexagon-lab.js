// pages/strength-hexagon-lab.js
//
// The strength profile: an athlete's squat, bench, deadlift, press and
// pull-ups drawn as one glowing shape, scored with the same engine as How
// Strong Am I against athletes of their age, sex and bodyweight. A signed-in
// athlete's bests fill in from their log; anyone else starts from typical
// numbers and slides them to their own. The shape takes its colours from the
// active theme. Noindex while it is an experiment on its own branch.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NextSeo } from "next-seo";
import { Download, Hexagon } from "lucide-react";
import { useReadLocalStorage } from "usehooks-ts";

import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import {
  COMPARISON_GROUPS,
  HEXAGON_AXES,
  archetypeFor,
  headlineFor,
  ordinal,
} from "@/components/strength-hexagon/hexagon-model";
import { computeHexagonScores } from "@/components/strength-hexagon/hexagon-scores";
import { renderStoryCardBlob } from "@/components/strength-hexagon/hexagon-story-card";
import { StrengthHexagonEditorial } from "@/components/strength-hexagon/strength-hexagon-editorial";
import { StrengthHexagonWebGL } from "@/components/strength-hexagon/strength-hexagon-webgl";
import { useHexagonThemeColors } from "@/components/strength-hexagon/use-hexagon-theme-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  STRENGTH_LEVEL_EMOJI,
  useAthleteBio,
} from "@/hooks/use-athlete-biodata";
import { isOwnData, useUserLiftingData } from "@/hooks/use-userlift-data";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { findBestE1RM } from "@/lib/processing-utils";
import { downloadBlob } from "@/lib/recap-share-image";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { cn } from "@/lib/utils";
import { convertWeight, toKg, unitTypeFor } from "@/lib/weight-units";

// Slider ranges in each unit, and the numbers an athlete without a log
// starts from (typical for a few years of steady training).
const BARBELL_INPUTS = {
  squat: { max: { lb: 700, kg: 320 }, defaultLb: 225 },
  bench: { max: { lb: 500, kg: 230 }, defaultLb: 155 },
  deadlift: { max: { lb: 800, kg: 360 }, defaultLb: 275 },
  press: { max: { lb: 330, kg: 150 }, defaultLb: 105 },
};
const PULLUP_MAX_REPS = 30;
const DEFAULT_PULLUP_REPS = 6;
const PULLUP_LIFT_TYPES = ["Pull-up", "Chin-up"];

export default function StrengthHexagonLabPage() {
  return (
    <PageContainer>
      <NextSeo title="Strength Profile | Strength Journeys" noindex nofollow />
      <PageHeader>
        <PageHeaderHeading icon={Hexagon}>Strength Profile</PageHeaderHeading>
        <PageHeaderDescription>
          Your squat, bench, deadlift, press and pull-ups as one shape, compared
          with athletes your age, sex and bodyweight.
        </PageHeaderDescription>
      </PageHeader>
      <StrengthProfile />
    </PageContainer>
  );
}

function StrengthProfile() {
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();
  const { topLiftsByTypeAndReps, parsedData, dataSource } =
    useUserLiftingData();
  const storedFormula = useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
    initializeWithValue: false,
  });
  const e1rmFormula = storedFormula ?? "Brzycki";
  const colors = useHexagonThemeColors();

  const [liftKgs, setLiftKgs] = useState(() =>
    Object.fromEntries(
      Object.entries(BARBELL_INPUTS).map(([key, input]) => [
        key,
        toKg(input.defaultLb, "lb"),
      ]),
    ),
  );
  const [pullupReps, setPullupReps] = useState(DEFAULT_PULLUP_REPS);
  const [universe, setUniverse] = useState("General Population");
  const [webglUnsupported, setWebglUnsupported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const visualRef = useRef(null);
  const handleUnsupported = useCallback(() => setWebglUnsupported(true), []);

  // The athlete's own bests: barbell e1RMs in kg and their biggest set of
  // pull-ups or chin-ups. Read straight from the log so a set of more than ten
  // reps still counts.
  const logBests = useMemo(() => {
    if (!isOwnData(dataSource) || !topLiftsByTypeAndReps) return null;
    const bests = {};
    for (const axis of HEXAGON_AXES) {
      if (axis.key === "pullups") continue;
      const found = findBestE1RM(axis.lift, topLiftsByTypeAndReps, e1rmFormula);
      bests[axis.key] = found.bestE1RMWeight
        ? toKg(found.bestE1RMWeight, found.unitType)
        : null;
    }
    let reps = 0;
    for (const entry of parsedData ?? []) {
      if (PULLUP_LIFT_TYPES.includes(entry.liftType) && entry.reps > reps) {
        reps = entry.reps;
      }
    }
    bests.pullups = reps || null;
    return bests;
  }, [dataSource, topLiftsByTypeAndReps, parsedData, e1rmFormula]);

  // Fill the inputs from the log once, when it first arrives.
  const hasFilledFromLogRef = useRef(false);
  useEffect(() => {
    if (!logBests || hasFilledFromLogRef.current) return;
    hasFilledFromLogRef.current = true;
    setLiftKgs((previous) => ({
      squat: logBests.squat ?? previous.squat,
      bench: logBests.bench ?? previous.bench,
      deadlift: logBests.deadlift ?? previous.deadlift,
      press: logBests.press ?? previous.press,
    }));
    if (logBests.pullups) setPullupReps(logBests.pullups);
  }, [logBests]);

  const bodyWeightKg = toKg(bodyWeight, unitTypeFor(isMetric));
  const scores = useMemo(
    () =>
      computeHexagonScores({
        age,
        sex,
        bodyWeightKg,
        liftKgs,
        pullupReps,
        universe,
      }),
    [age, sex, bodyWeightKg, liftKgs, pullupReps, universe],
  );
  const values = useMemo(
    () => scores.map((score) => score.percentile),
    [scores],
  );
  const title = archetypeFor(values);
  const headline = headlineFor(values, universe, { sex, age });

  const handleSaveImage = async () => {
    setExporting(true);
    try {
      const capture = await visualRef.current?.capture();
      if (!capture) return;
      const blob = await renderStoryCardBlob({
        capture,
        theme: {
          bg: colors.css.bg,
          text: colors.css.ink,
          muted: colors.css.muted,
          glow: colors.isDark ? colors.css.core : null,
        },
        title,
        headline,
      });
      downloadBlob(blob, "strength-profile.png");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="flex flex-col items-center text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h2>
        <p className="text-muted-foreground mt-2 text-lg sm:text-xl">
          {headline}
        </p>

        <div className="-my-2 w-full max-w-[760px] sm:-my-6">
          {webglUnsupported ? (
            <StrengthHexagonEditorial
              ref={visualRef}
              values={values}
              colors={colors}
            />
          ) : (
            <StrengthHexagonWebGL
              ref={visualRef}
              values={values}
              colors={colors}
              onUnsupported={handleUnsupported}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">Compared with</span>
          {COMPARISON_GROUPS.map((group) => (
            <Button
              key={group.universe}
              size="sm"
              variant={group.universe === universe ? "default" : "outline"}
              onClick={() => setUniverse(group.universe)}
            >
              {group.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={handleSaveImage}
          disabled={exporting}
        >
          <Download className="mr-2 h-4 w-4" />
          Save as image
        </Button>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AthleteBioInlineSettings />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HEXAGON_AXES.map((axis, index) =>
            axis.key === "pullups" ? (
              <LiftCard
                key={axis.key}
                axis={axis}
                score={scores[index]}
                display={pullupReps ? `${pullupReps} reps` : "Not tested"}
                fromLog={
                  logBests?.pullups != null && logBests.pullups === pullupReps
                }
                sliderValue={pullupReps}
                sliderMax={PULLUP_MAX_REPS}
                sliderStep={1}
                onSliderChange={setPullupReps}
                note="Best strict set. Placeholder standards for now."
              />
            ) : (
              <BarbellLiftCard
                key={axis.key}
                axis={axis}
                score={scores[index]}
                kg={liftKgs[axis.key]}
                logKg={logBests?.[axis.key]}
                isMetric={isMetric}
                onChangeKg={(kg) =>
                  setLiftKgs((previous) => ({ ...previous, [axis.key]: kg }))
                }
              />
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function BarbellLiftCard({ axis, score, kg, logKg, isMetric, onChangeKg }) {
  const unit = unitTypeFor(isMetric);
  const step = isMetric ? 2.5 : 5;
  const toDisplay = (value) =>
    Math.round(convertWeight(value, "kg", unit) / step) * step;
  const displayValue = toDisplay(kg);
  return (
    <LiftCard
      axis={axis}
      score={score}
      display={displayValue ? `${displayValue} ${unit}` : "Not tested"}
      fromLog={logKg != null && toDisplay(logKg) === displayValue}
      sliderValue={displayValue}
      sliderMax={BARBELL_INPUTS[axis.key].max[unit]}
      sliderStep={step}
      onSliderChange={(value) => onChangeKg(toKg(value, unit))}
      note="One-rep max, or your best estimate."
    />
  );
}

function LiftCard({
  axis,
  score,
  display,
  fromLog,
  sliderValue,
  sliderMax,
  sliderStep,
  onSliderChange,
  note,
}) {
  const tested = score.percentile != null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{axis.lift}</p>
            <p className="text-muted-foreground text-xs">
              {fromLog ? "Your best from your log" : note}
            </p>
          </div>
          {tested && (
            <Badge
              variant={getRatingBadgeVariant(score.rating)}
              className="shrink-0 text-xs"
            >
              {STRENGTH_LEVEL_EMOJI[score.rating]} {score.rating}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              !tested && "text-muted-foreground text-lg font-medium",
            )}
          >
            {display}
          </span>
          {tested && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {ordinal(Math.round(score.percentile))} percentile
            </span>
          )}
        </div>
        <Slider
          aria-label={`${axis.lift} amount`}
          min={0}
          max={sliderMax}
          step={sliderStep}
          value={[Math.min(sliderValue, sliderMax)]}
          onValueChange={([next]) => onSliderChange(next)}
        />
      </CardContent>
    </Card>
  );
}
