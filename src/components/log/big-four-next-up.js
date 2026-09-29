/**
 * "Your next lift": the big four ordered by what the athlete is due to train,
 * each with last time's top set and one linear-progression step up. A new
 * athlete sees "Your next lifts" instead, the Starting Strength novice
 * workout that comes next, fitted to what they've logged so far.
 *
 * Deliberately not a gallery. The lift explorer and the add-lift picker are
 * grids of drawings to browse; this is a short list of instructions to act on
 * right now, so it leads with the lift name and the number to hit. `featured`
 * is four equal cards with the most due one quietly marked, since the choice
 * is always the athlete's. `compact` is a two-up list for tighter cards.
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

  return (
    <section
      aria-labelledby="big-four-next-up-heading"
      className="w-full space-y-3"
    >
      <div className="space-y-0.5">
        <h2 id="big-four-next-up-heading" className="text-base font-semibold">
          Pick your lift
        </h2>
        <p className="text-muted-foreground text-sm">
          Suggested from your training pattern over the last two months.
        </p>
      </div>

      {/* Four equal cards, so the choice stays the athlete's. The suggestion
          earns a ring in its lift colour and a small label, nothing louder. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lifts.map((lift, index) => {
          const isSuggested = index === 0 && lift.isDue;
          return (
            <NextUpAction
              key={lift.liftType}
              lift={lift}
              onStart={onStart}
              getHref={getHref}
              disabled={disabled}
              aria-label={`${isSuggested ? "Suggested. " : ""}${getActionLabel(lift)}`}
              className={`group bg-card hover:bg-muted/40 relative flex items-center gap-4 overflow-hidden rounded-xl border py-3 pr-4 pl-5 text-left shadow-sm transition-colors hover:border-[color:color-mix(in_srgb,var(--lift-color)_55%,transparent)] disabled:pointer-events-none disabled:opacity-50 ${
                isSuggested
                  ? "border-[color:color-mix(in_srgb,var(--lift-color)_45%,transparent)] ring-1 ring-[color:color-mix(in_srgb,var(--lift-color)_30%,transparent)]"
                  : ""
              }`}
              style={{ "--lift-color": getColor(lift.liftType) }}
            >
              <LiftColorEdge />
              <LiftArtwork
                liftType={lift.liftType}
                size="md"
                animate={false}
                className="h-14 shrink-0 md:h-16"
              />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-base leading-tight font-semibold">
                    {lift.liftType}
                  </span>
                  {isSuggested && (
                    <span className="text-muted-foreground rounded-full border px-2 py-px text-[11px] leading-4 font-medium">
                      Suggested
                    </span>
                  )}
                </span>
                <span className="block text-sm font-medium tabular-nums">
                  {getTargetLine(lift)}
                </span>
                <span className="text-muted-foreground block text-xs leading-snug tabular-nums">
                  {getContextLine(lift)}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
              />
            </NextUpAction>
          );
        })}
      </div>
    </section>
  );
}

// ─── Supporting pieces ─────────────────────────────────────────────────────

/**
 * A new athlete's next Starting Strength workout: its three lifts in order,
 * each startable, with the weight to aim for. The copy never names the
 * program or its A/B workouts. The athlete just sees good lifts in a sensible
 * order, and anyone who knows the program will recognise it.
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
          Your next lifts
        </h2>
        <p className="text-muted-foreground text-sm">
          Squat, a press, then a deadlift, each a little heavier than last time.
        </p>
      </div>

      <div
        className="bg-card relative overflow-hidden rounded-2xl border shadow-sm"
        style={{ "--lift-color": getColor(first.liftType) }}
      >
        <LiftColorEdge wide />
        <div className="space-y-4 p-4 pl-6 sm:p-5 sm:pl-7">
          <div className="space-y-1">
            <p className="text-lg leading-tight font-semibold">
              Today&apos;s session?
            </p>
            <p className="text-muted-foreground text-sm">
              {plan.trainedYesterday
                ? "You trained yesterday. Strength builds on the rest day, so these might suit tomorrow."
                : "Three lifts, in this order."}
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
              Next time, {swapped} takes the place of {swappedFor}.
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
      variant="outline"
      disabled={disabled}
      onClick={onStart ? () => onStart(liftType) : undefined}
      className={`shrink-0 rounded-xl ${className}`}
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

// Under a pattern target: last time's set, then why it's in this order.
function getContextLine(lift) {
  const last = formatNextUpSet(lift.lastTopSet, lift.unit);
  const why = lift.usualWeekday
    ? `usually on ${lift.usualWeekday}s`
    : lift.companionOf
      ? `usually after ${lift.companionOf}`
      : lift.lastDate
        ? getLastTrainedLabel(lift.daysSince).toLowerCase()
        : null;
  if (last && why) return `Last time ${last}, ${why}`;
  if (last) return `Last time ${last}`;
  return why ? why[0].toUpperCase() + why.slice(1) : "Ready when you are";
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
