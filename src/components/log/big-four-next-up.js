/**
 * "Your next lift": the big four ordered by what the athlete is due to train,
 * each with last time's top set and one linear-progression step up.
 *
 * Deliberately not a gallery. The lift explorer and the add-lift picker are
 * grids of drawings to browse; this is a short list of instructions to act on
 * right now, so it leads with the lift name and the number to hit, and the
 * artwork stays small. `featured` gives the most due lift the full width with
 * a start button. `compact` is a two-up list for tighter cards.
 *
 * Ranking and numbers come from getBigFourNextUp. Pass `onStart` to start the
 * lift in place, or `getHref` to link to it from elsewhere.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiftArtwork } from "@/components/lift-artwork";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { formatNextUpSet } from "@/components/log/big-four-next-up-utils";

export function BigFourNextUp({
  lifts,
  variant = "featured",
  onStart,
  getHref,
  disabled = false,
}) {
  const { getColor } = useLiftColors();
  if (!lifts?.length) return null;

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
                {index === 0 && lift.isDue ? "Up next. " : ""}
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
                {next.isDue ? `${next.liftType} day` : next.liftType}
              </p>
              <p className="text-muted-foreground text-sm">
                {getRhythmLine(next)}
              </p>
              <TopSetLines lift={next} />
            </div>
          </div>
          <Button
            asChild={!onStart}
            size="lg"
            disabled={disabled}
            onClick={onStart ? () => onStart(next.liftType) : undefined}
            className="h-12 shrink-0 rounded-xl px-6 sm:self-center"
          >
            {onStart ? (
              <>
                Start {next.liftType}
                <ArrowRight aria-hidden="true" />
              </>
            ) : (
              <Link href={getHref(next.liftType)}>
                Start {next.liftType}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </Button>
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
  const last = formatNextUpSet(lift.lastTopSet, lift.unit);
  if (last) return `Last time ${last}`;
  return "Your first session";
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
