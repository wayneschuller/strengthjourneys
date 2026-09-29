/**
 * "Your next lift": the big four ordered by what the athlete is due to train,
 * each with last time's top set and one linear-progression step up. A new
 * athlete sees "Your next workout" instead, the Starting Strength novice
 * workout that comes next, fitted to what they've logged so far.
 *
 * Deliberately not a gallery. The lift explorer and the add-lift picker are
 * grids of drawings to browse; this is a short list of instructions to act on
 * right now, so it leads with the lift name and the number to hit, and the
 * artwork stays small. `featured` gives the most due lift the full width with
 * a start button. `compact` is a two-up list for tighter cards.
 *
 * The plan comes from useNextLiftPlan. Pass `onStart` to start the lift in
 * place, or `getHref` to link to it from elsewhere.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useReadLocalStorage } from "usehooks-ts";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiftArtwork } from "@/components/lift-artwork";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  formatNextUpSet,
  getNextLiftPlan,
} from "@/components/log/big-four-next-up-utils";

/**
 * The next-lift plan for a date, with the athlete's own context gathered in:
 * units, bar, and the bodyweight standards behind first-time targets.
 * `dashboardStage` (from getDashboardStage) decides novice or pattern.
 */
export function useNextLiftPlan({ referenceDate, dashboardStage }) {
  const { parsedData } = useUserLiftingData();
  const { isMetric, sex, standards } = useAthleteBio();
  // The warmup calculator's bar choice, as the lift block reads it.
  const storedBarType =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, {
      initializeWithValue: false,
    }) ?? null;
  const barWeight = getDefaultBarbellWeight({ isMetric, sex, storedBarType });

  return useMemo(
    () =>
      getNextLiftPlan({
        parsedData,
        referenceDate,
        isMetric,
        dashboardStage,
        standards,
        barWeight,
      }),
    [parsedData, referenceDate, isMetric, dashboardStage, standards, barWeight],
  );
}

export function BigFourNextUp({
  plan,
  variant = "featured",
  onStart,
  getHref,
  disabled = false,
  // Lifts to leave out of the compact list, e.g. ones trained this week.
  // Ignored for a novice plan, whose workout already says what's next.
  excludeLiftTypes = [],
}) {
  const { getColor } = useLiftColors();
  const isNovice = plan?.mode === "novice";
  const lifts = isNovice
    ? plan.lifts
    : (plan?.lifts ?? []).filter(
        ({ liftType }) => !excludeLiftTypes.includes(liftType),
      );
  if (!lifts.length) return null;

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lifts.map((lift, index) => (
          <NextUpAction
            key={lift.liftType}
            lift={lift}
            onStart={onStart}
            getHref={getHref}
            disabled={disabled}
            aria-label={getActionLabel(lift)}
            className="group border-border bg-card hover:bg-muted/40 relative flex items-center gap-3 overflow-hidden rounded-xl border py-3 pr-3 pl-4 text-left transition-colors hover:border-[color:color-mix(in_srgb,var(--lift-color)_55%,transparent)] disabled:pointer-events-none disabled:opacity-50"
            style={{ "--lift-color": getColor(lift.liftType) }}
          >
            <LiftColorEdge />
            <LiftArtwork
              liftType={lift.liftType}
              size="sm"
              animate={false}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-tight font-medium">
                {lift.liftType}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                {index === 0 && lift.isDue && !isNovice ? "Up next. " : ""}
                {getTargetLine(lift)}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            />
          </NextUpAction>
        ))}
      </div>
    );
  }

  if (isNovice) {
    return (
      <NoviceWorkout
        plan={plan}
        onStart={onStart}
        getHref={getHref}
        disabled={disabled}
      />
    );
  }

  const [next, ...rest] = lifts;
  const nextColor = getColor(next.liftType);

  return (
    <section
      aria-labelledby="big-four-next-up-heading"
      className="w-full space-y-3"
    >
      <div className="space-y-0.5">
        <h2 id="big-four-next-up-heading" className="text-base font-semibold">
          Your next lift
        </h2>
        <p className="text-muted-foreground text-sm">
          Ordered by your training pattern over the last two months.
        </p>
      </div>

      <div
        className="bg-card relative overflow-hidden rounded-2xl border shadow-sm"
        style={{ "--lift-color": nextColor }}
      >
        <LiftColorEdge wide />
        <div className="flex flex-col gap-4 p-4 pl-6 sm:flex-row sm:items-center sm:gap-6 sm:p-5 sm:pl-7">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <LiftArtwork
              liftType={next.liftType}
              size="md"
              animate={false}
              className="h-20 shrink-0 md:h-24"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-xl leading-tight font-semibold sm:text-2xl">
                {next.isDue ? `${next.liftType} day?` : next.liftType}
              </p>
              <p className="text-muted-foreground text-sm">
                {getRhythmLine(next)}
              </p>
              <TopSetLines lift={next} />
            </div>
          </div>
          <StartButton
            liftType={next.liftType}
            label={`Start ${next.liftType}`}
            onStart={onStart}
            getHref={getHref}
            disabled={disabled}
            className="sm:self-center"
          />
        </div>
      </div>

      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rest.map((lift) => (
            <NextUpAction
              key={lift.liftType}
              lift={lift}
              onStart={onStart}
              getHref={getHref}
              disabled={disabled}
              aria-label={getActionLabel(lift)}
              className="group bg-card hover:bg-muted/40 relative flex items-center gap-3 overflow-hidden rounded-xl border py-3 pr-3 pl-4 text-left shadow-sm transition-colors hover:border-[color:color-mix(in_srgb,var(--lift-color)_55%,transparent)] disabled:pointer-events-none disabled:opacity-50"
              style={{ "--lift-color": getColor(lift.liftType) }}
            >
              <LiftColorEdge />
              <LiftArtwork
                liftType={lift.liftType}
                size="sm"
                animate={false}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium">
                  {lift.liftType}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                  {getTargetLine(lift)}
                </span>
                {lift.lastDate && (
                  <span className="text-muted-foreground/80 block text-xs leading-snug">
                    {lift.companionOf
                      ? `Usually after ${lift.companionOf}`
                      : getLastTrainedLabel(lift.daysSince)}
                  </span>
                )}
              </span>
            </NextUpAction>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Supporting pieces ─────────────────────────────────────────────────────

/**
 * A new athlete's next Starting Strength workout: its three lifts in order,
 * each startable, with the weight to aim for.
 */
function NoviceWorkout({ plan, onStart, getHref, disabled }) {
  const { getColor } = useLiftColors();
  const [first] = plan.lifts;
  const swapped = plan.workout === "A" ? "Strict Press" : "Bench Press";
  const swappedFor = plan.workout === "A" ? "Bench Press" : "Strict Press";

  return (
    <section
      aria-labelledby="big-four-next-up-heading"
      className="w-full space-y-3"
    >
      <div className="space-y-0.5">
        <h2 id="big-four-next-up-heading" className="text-base font-semibold">
          Your next workout
        </h2>
        <p className="text-muted-foreground text-sm">
          From the Starting Strength novice program: two short workouts,
          alternated three days a week, adding a little weight every session.
        </p>
      </div>

      <div
        className="bg-card relative overflow-hidden rounded-2xl border shadow-sm"
        style={{ "--lift-color": getColor(first.liftType) }}
      >
        <LiftColorEdge wide />
        <div className="space-y-4 p-4 pl-6 sm:p-5 sm:pl-7">
          <div className="space-y-1">
            <p className="text-xl leading-tight font-semibold sm:text-2xl">
              Workout {plan.workout}?
            </p>
            <p className="text-muted-foreground text-sm">
              {plan.trainedYesterday
                ? "You trained yesterday. The program rests a day between workouts, so this one might suit tomorrow."
                : `${plan.lifts.map(({ liftType }) => liftType).join(", ")}, in that order.`}
            </p>
          </div>

          <ol className="divide-border/60 divide-y rounded-xl border">
            {plan.lifts.map((lift) => (
              <li key={lift.liftType}>
                <NextUpAction
                  lift={lift}
                  onStart={onStart}
                  getHref={getHref}
                  disabled={disabled}
                  aria-label={getActionLabel(lift)}
                  className="group hover:bg-muted/40 relative flex w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
                  style={{ "--lift-color": getColor(lift.liftType) }}
                >
                  <LiftColorEdge />
                  <LiftArtwork
                    liftType={lift.liftType}
                    size="sm"
                    animate={false}
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                    <span className="block text-sm font-medium sm:w-32 sm:shrink-0">
                      {lift.liftType}
                    </span>
                    <span className="block text-sm font-semibold tabular-nums">
                      {getTargetLine(lift)}
                    </span>
                    <span className="text-muted-foreground block text-xs tabular-nums">
                      {getNoviceContextLine(lift)}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
                  />
                </NextUpAction>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              Next time: Workout {plan.nextWorkout}, with {swapped} in place of{" "}
              {swappedFor}.
            </p>
            <StartButton
              liftType={first.liftType}
              label={`Start with ${first.liftType}`}
              onStart={onStart}
              getHref={getHref}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StartButton({
  liftType,
  label,
  onStart,
  getHref,
  disabled,
  className = "",
}) {
  return (
    <Button
      asChild={!onStart}
      size="lg"
      disabled={disabled}
      onClick={onStart ? () => onStart(liftType) : undefined}
      className={`h-12 shrink-0 rounded-xl px-6 ${className}`}
    >
      {onStart ? (
        <>
          {label}
          <ArrowRight aria-hidden="true" />
        </>
      ) : (
        <Link href={getHref(liftType)}>
          {label}
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </Button>
  );
}

// A button when the lift starts in place, a link when it starts on /log.
function NextUpAction({
  lift,
  onStart,
  getHref,
  disabled,
  children,
  ...props
}) {
  if (onStart) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart(lift.liftType)}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={getHref(lift.liftType)} {...props}>
      {children}
    </Link>
  );
}

// The lift's own colour down the left edge, the same colour its lift block
// carries once started.
function LiftColorEdge({ wide = false }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 left-0 ${wide ? "w-1.5" : "w-1"}`}
      style={{ backgroundColor: "var(--lift-color)" }}
    />
  );
}

function TopSetLines({ lift }) {
  const last = formatNextUpSet(lift.lastTopSet, lift.unit);
  const next = formatNextUpSet(lift.nextTopSet, lift.unit);

  if (next) {
    return (
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-1">
        <span className="text-base font-semibold tabular-nums">
          Go for {next}?
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">
          Last time {last}
        </span>
      </p>
    );
  }
  if (last) {
    return (
      <p className="pt-1 text-sm tabular-nums">
        Last time {last}. Warm up and find today&apos;s working weight.
      </p>
    );
  }
  return (
    <p className="pt-1 text-sm">
      Your first session. We&apos;ll suggest the warmups.
    </p>
  );
}

function getTargetLine(lift) {
  const next = formatNextUpSet(lift.nextTopSet, lift.unit);
  if (next) return `Go for ${next}?`;
  if (lift.firstTimeTarget) {
    const { sets, reps, weight } = lift.firstTimeTarget;
    return weight
      ? `Work up to ${formatNextUpSet(lift.firstTimeTarget, lift.unit)}?`
      : `${sets > 1 ? `${sets}×` : ""}${reps} from the empty bar?`;
  }
  if (lift.workSets && !lift.lastTopSet) {
    const sets = lift.workSets > 1 ? `${lift.workSets}×` : "";
    return `${sets}5 at a weight that moves well?`;
  }
  const last = formatNextUpSet(lift.lastTopSet, lift.unit);
  if (last) return `Last time ${last}`;
  return "Your first session";
}

// Under a novice target: where the number came from.
function getNoviceContextLine(lift) {
  if (lift.firstTimeTarget)
    return "First time. Warmups start from the empty bar.";
  const last = formatNextUpSet(lift.lastTopSet, lift.unit);
  if (!last) return getLastTrainedLabel(lift.daysSince);
  return lift.nextTopSet?.weight === lift.lastTopSet.weight
    ? `Last time ${last}. Repeat it after the break.`
    : `Last time ${last}`;
}

function getRhythmLine(lift) {
  if (!lift.lastDate) return "Ready when you are.";
  const when = getLastTrainedLabel(lift.daysSince);
  if (lift.usualWeekday) {
    return `${when}. You usually train it on ${lift.usualWeekday}s.`;
  }
  if (lift.companionOf) return `${when}. Usually after ${lift.companionOf}.`;
  if (!lift.cadenceDays) return `${when}. Welcome back to it.`;
  return `${when}. You train it ${getCadenceLabel(lift.cadenceDays)}.`;
}

function getCadenceLabel(days) {
  const rounded = Math.max(1, Math.round(days));
  if (rounded >= 6 && rounded <= 8) return "about once a week";
  if (rounded >= 13 && rounded <= 15) return "about every two weeks";
  if (rounded === 1) return "most days";
  return `about every ${rounded} days`;
}

function getLastTrainedLabel(days) {
  if (days <= 1) return "Trained yesterday";
  if (days < 14) return `Trained ${days} days ago`;
  if (days < 60) return `Trained ${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `Trained ${Math.round(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Trained a year ago" : `Trained ${years} years ago`;
}

function getActionLabel(lift) {
  return `Start ${lift.liftType}. ${getTargetLine(lift)}`;
}
