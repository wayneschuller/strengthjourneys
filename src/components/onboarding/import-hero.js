/**
 * The opening of the import preview: the lifter's own history told back to
 * them in big numbers, straight after they hand over a file.
 *
 * This is the moment an import either turns into a Strength Journeys athlete
 * or leaves, so it leads with what they would brag about (years under the
 * bar, weight moved, strength ranking, 1000lb Club, meets) before anything
 * asks them to sign in. Every section is optional: a three-week Hevy export
 * with no squat still gets a tidy page, just a shorter one.
 *
 * All numbers come from the data provider's summaries, through
 * lib/import/import-story.js. Nothing here rescans the parsed rows.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useReadLocalStorage } from "usehooks-ts";
import {
  AlertTriangle,
  CalendarDays,
  CalendarHeart,
  Disc,
  Dumbbell,
  Flame,
} from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { computeStrengthResults } from "@/lib/strength-circles/universe-percentiles";
import { findBestE1RM, getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { toKg, toLb, unitTypeFor } from "@/lib/weight-units";
import { buildImportStory, pluralize } from "@/lib/import/import-story";
import {
  guessAthleteBio,
  roundGuessedBodyWeight,
} from "@/lib/import/guess-athlete-bio";
import { formatLifetimeTonnage } from "@/lib/home-dashboard/inspiration-card-metrics";
import { MEET_LIFTS, formatMeetTotal } from "@/lib/meet-detection";
import { getWeakestLiftHint } from "@/lib/thousand-club";
import { getReadableDateString } from "@/lib/date-utils";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import {
  MEET_GOLD,
  MeetMedalGlyph,
  getMeetLogHref,
} from "@/components/meet-medal";
import { ThousandDonut } from "@/components/thousand-club-donut";
import { UnitChooser } from "@/components/unit-type-chooser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// More meets than this and the panel names the newest and counts the rest.
const MAX_MEETS_LISTED = 6;

/**
 * @param {Object} props
 * @param {string} [props.fileName] - The imported file's name, shown clamped.
 * @param {string} [props.formatName] - The app the export came from.
 * @param {Object} [props.diagnostics] - What the parser left out, if anything.
 */
export function ImportHero({ fileName, formatName, diagnostics }) {
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();
  const e1rmFormula = useStoredE1rmFormula();
  const {
    liftTypes,
    sessionTonnageLookup,
    meetDays,
    streakLeaderboard,
    topLiftsByTypeAndReps,
  } = useUserLiftingData();

  const story = useMemo(
    () =>
      buildImportStory({
        liftTypes,
        sessionTonnageLookup,
        meetDays,
        streakLeaderboard,
        topLiftsByTypeAndReps,
        isMetric,
      }),
    [
      liftTypes,
      sessionTonnageLookup,
      meetDays,
      streakLeaderboard,
      topLiftsByTypeAndReps,
      isMetric,
    ],
  );

  const strength = useMemo(() => {
    if (!topLiftsByTypeAndReps) return null;

    const bodyWeightKg = toKg(bodyWeight, unitTypeFor(isMetric));
    const liftKgs = {};

    for (const [key, liftType] of Object.entries({
      squat: "Back Squat",
      bench: "Bench Press",
      deadlift: "Deadlift",
    })) {
      const best = findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula);
      liftKgs[key] =
        best.bestE1RMWeight > 0
          ? toKg(best.bestE1RMWeight, best.unitType)
          : null;
    }

    if (!liftKgs.squat && !liftKgs.bench && !liftKgs.deadlift) return null;

    const results = computeStrengthResults({ age, sex, bodyWeightKg }, liftKgs);

    // Average the Gen Pop percentile across all available SBD lifts
    const pcts = [];
    const liftLabels = [];
    for (const [key, label] of [
      ["squat", "squat"],
      ["bench", "bench"],
      ["deadlift", "deadlift"],
    ]) {
      const pct = results.lifts[key]?.percentiles?.["General Population"];
      if (pct != null) {
        pcts.push(pct);
        liftLabels.push(label);
      }
    }

    if (!pcts.length) return null;

    return {
      pct: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      liftLabels,
    };
  }, [topLiftsByTypeAndReps, age, sex, bodyWeight, isMetric, e1rmFormula]);

  const thousandClub = useMemo(() => {
    if (!topLiftsByTypeAndReps) return null;

    const liftTotals = {};
    for (const [liftType, key] of [
      ["Back Squat", "squat"],
      ["Bench Press", "bench"],
      ["Deadlift", "deadlift"],
    ]) {
      const best = findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula);
      if (!best?.bestE1RMWeight || !best.unitType) return null;
      liftTotals[key] = Math.round(toLb(best.bestE1RMWeight, best.unitType));
    }

    const total = liftTotals.squat + liftTotals.bench + liftTotals.deadlift;
    return {
      total,
      inClub: total >= 1000,
      delta: Math.abs(total - 1000),
      lifts: liftTotals,
      biggestOpportunity: getWeakestLiftHint(
        liftTotals.squat,
        liftTotals.bench,
        liftTotals.deadlift,
      ),
    };
  }, [topLiftsByTypeAndReps, e1rmFormula]);

  if (!story) return null;

  const displayName = clampFileName(fileName);
  const source = formatName || "your file";
  const highlights = buildHighlights(story);

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold sm:text-2xl">
        Your {source} data is ready to explore
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Here is the story inside{" "}
        {displayName ? (
          <span className="text-foreground font-medium">{displayName}</span>
        ) : (
          "your file"
        )}
        .
      </p>
      <ImportDiagnosticsNotice diagnostics={diagnostics} />

      {/* Before the numbers, not after: the ranking below is worked out from
          these, and an athlete who has never set them would otherwise be
          ranked as the default 30 year old, 200lb man. */}
      <AboutYouSentence
        topLiftsByTypeAndReps={topLiftsByTypeAndReps}
        sessionCount={story.sessionCount}
        e1rmFormula={e1rmFormula}
      />

      {/* The four numbers a lifter would say out loud */}
      <Reveal index={0} className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          value={story.journey.value}
          label={
            story.journey.detail
              ? `${story.journey.detail} under the bar`
              : "under the bar"
          }
          detail={`${getReadableDateString(story.firstDate)} to ${getReadableDateString(story.lastDate)}`}
        />
        <StatTile
          value={(
            diagnostics?.workoutCount || story.sessionCount
          ).toLocaleString()}
          label={diagnostics?.workoutCount ? "workouts" : "training days"}
          detail={`across ${pluralize(story.exerciseCount, "exercise")}`}
        />
        <StatTile
          value={story.totalSets.toLocaleString()}
          label="sets logged"
          detail={
            story.totalReps > 0 ? pluralize(story.totalReps, "rep") : null
          }
        />
        {story.tonnage && (
          <StatTile
            value={`${formatLifetimeTonnage(Math.round(story.tonnage.total))} ${story.tonnage.unit}`}
            label="moved"
            detail={
              story.tonnage.equivalent
                ? `About ${pluralize(story.tonnage.equivalent.count, story.tonnage.equivalent.name)} ${story.tonnage.equivalent.emoji}`
                : null
            }
          />
        )}
      </Reveal>

      {(strength || thousandClub) && (
        <Reveal
          index={1}
          className={`mt-2 grid gap-2 ${strength && thousandClub ? "md:grid-cols-2" : ""}`}
        >
          {strength && (
            <FeaturePanel
              visual={<SinglePercentileRing percentile={strength.pct} />}
            >
              <p className="text-lg leading-snug font-bold">
                Stronger than {strength.pct}% of the general population
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {getMotivationalPhrase(strength.pct)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                From your best {joinWithAnd(strength.liftLabels)}.{" "}
                <Link
                  href="/how-strong-am-i"
                  className="hover:text-foreground underline underline-offset-2"
                >
                  See the full ranking
                </Link>
              </p>
            </FeaturePanel>
          )}

          {thousandClub && (
            <FeaturePanel
              visual={
                <ThousandDonut
                  total={thousandClub.total}
                  prefersReducedMotion={true}
                  compact={true}
                  href="/1000lb-club-calculator"
                  className="my-0 h-[144px] w-full max-w-[144px] xl:h-[144px] xl:max-w-[144px]"
                />
              }
            >
              <p className="text-lg leading-snug font-bold">
                {thousandClub.inClub
                  ? "You’re in the 1000lb Club"
                  : `Your 1000lb Club total is ${thousandClub.total.toLocaleString()} lb`}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {thousandClub.inClub
                  ? `A ${thousandClub.total.toLocaleString()} lb total, ${thousandClub.delta} lb past 1000.`
                  : `You’re ${thousandClub.delta} lb away from the 1000lb Club.`}
              </p>
              {thousandClub.biggestOpportunity && !thousandClub.inClub && (
                <p className="text-muted-foreground mt-1 text-sm">
                  <span className="text-foreground font-semibold">
                    Biggest opportunity:
                  </span>{" "}
                  Add ~{thousandClub.biggestOpportunity.gapLbs} lb (
                  {Math.round(
                    toKg(thousandClub.biggestOpportunity.gapLbs, "lb"),
                  )}{" "}
                  kg) to your{" "}
                  {thousandClub.biggestOpportunity.lift.toLowerCase()}.
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                Squat {thousandClub.lifts.squat} · Bench{" "}
                {thousandClub.lifts.bench} · Deadlift{" "}
                {thousandClub.lifts.deadlift}
              </p>
            </FeaturePanel>
          )}
        </Reveal>
      )}

      {story.meets && (
        <Reveal index={2} className="mt-2">
          <MeetsPanel meets={story.meets} isMetric={isMetric} />
        </Reveal>
      )}

      {highlights.length > 0 && (
        <Reveal index={3} className="mt-2 flex flex-wrap gap-2">
          {highlights.map((highlight) => (
            <HighlightTile key={highlight.title} {...highlight} />
          ))}
        </Reveal>
      )}
    </div>
  );
}

// The smaller finds under the headline numbers. Each one is skipped when the
// history is too short to say it honestly.
function buildHighlights(story) {
  const highlights = [];

  if (story.longestStreak) {
    highlights.push({
      icon: Flame,
      title: `${story.longestStreak.weeks}-week streak`,
      detail: `Your longest run of three or more sessions a week, starting ${getReadableDateString(story.longestStreak.startWeek)}.`,
    });
  }

  const [topPlates, ...otherPlates] = story.plateMilestones;
  if (topPlates) {
    highlights.push({
      icon: Disc,
      title: `${topPlates.plates}-plate ${topPlates.name}`,
      detail:
        otherPlates.length > 0
          ? `Plus a ${joinWithAnd(otherPlates.map((m) => `${m.plates}-plate ${m.name}`))}.`
          : `${topPlates.set.weight}${topPlates.set.unitType} on the bar, ${getReadableDateString(topPlates.set.date)}.`,
      href: "/plate-milestones",
    });
  }

  if (story.mostTrainedLift) {
    const { liftType, totalSets, totalReps } = story.mostTrainedLift;
    highlights.push({
      icon: Dumbbell,
      title: `${liftType} is your lift`,
      detail: `${pluralize(totalSets, "set")} and ${pluralize(totalReps, "rep")}, more than any other.`,
      href: getLiftDetailUrl(liftType),
    });
  }

  if (story.biggestYear) {
    highlights.push({
      icon: CalendarDays,
      title: `${story.biggestYear.year} was your biggest year`,
      detail: `${pluralize(story.biggestYear.sessions, "training day")}.`,
    });
  }

  if (story.favouriteDay) {
    highlights.push({
      icon: CalendarHeart,
      title: `${story.favouriteDay.name} is your day`,
      detail: `You have trained on ${pluralize(story.favouriteDay.sessions, story.favouriteDay.name)}.`,
    });
  }

  return highlights;
}

// The athlete's details as a sentence they can correct: "I am a 34 year old
// man and I weigh 185 lb". It opens with our guess from their lifts (see
// lib/import/guess-athlete-bio.js) in the unit their file uses (see
// useAthleteBioData), so most athletes have one number to fix, not a form to
// fill in. The guess is only shown, never saved: touching any part of the
// sentence, or agreeing with it, records the whole of it as theirs.
function AboutYouSentence({
  topLiftsByTypeAndReps,
  sessionCount,
  e1rmFormula,
}) {
  const {
    age,
    setAge,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    isMetric,
    toggleIsMetric,
    applyBioGuess,
    bioDataIsDefault,
    bioDataIsInitialized,
  } = useAthleteBio();

  const guess = useMemo(
    () => guessAthleteBio({ topLiftsByTypeAndReps, sessionCount, e1rmFormula }),
    [topLiftsByTypeAndReps, sessionCount, e1rmFormula],
  );

  // Once per file and unit, and only for an athlete who has never told us:
  // a unit change redoes it so the guess is a round number in that unit.
  const appliedGuessRef = useRef(null);
  useEffect(() => {
    if (!bioDataIsInitialized || !bioDataIsDefault) return;
    if (!guess.bodyWeightKg) return;
    const applied = appliedGuessRef.current;
    if (applied?.guess === guess && applied.isMetric === isMetric) return;
    appliedGuessRef.current = { guess, isMetric };
    applyBioGuess({
      sex: guess.sex,
      bodyWeight: roundGuessedBodyWeight(guess.bodyWeightKg, isMetric),
    });
  }, [guess, isMetric, bioDataIsDefault, bioDataIsInitialized, applyBioGuess]);

  // Any edit confirms the rest of the sentence too, or a guessed bodyweight
  // beside a corrected age would be gone on the next visit.
  const save = (changes = {}) => {
    setAge(changes.age ?? age);
    setSex(changes.sex ?? sex);
    setBodyWeight(changes.bodyWeight ?? bodyWeight);
  };
  const readNumber = (event) => {
    const value = parseInt(event.target.value || "0", 10);
    return Number.isNaN(value) ? null : value;
  };

  const inputClassName = "h-9 px-2 text-center text-lg font-semibold";

  return (
    <div className="mt-5 rounded-lg border p-4">
      <p className="text-sm font-semibold">Tell us about yourself, athlete</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-lg font-medium">
        <span>I am a</span>
        <Input
          type="number"
          min={13}
          max={100}
          value={age}
          aria-label="Age"
          onChange={(event) => {
            const value = readNumber(event);
            if (value !== null) save({ age: value });
          }}
          className={`${inputClassName} w-16`}
        />
        <span>year old</span>
        <span className="inline-flex rounded-md border p-0.5">
          {[
            ["male", "man"],
            ["female", "woman"],
          ].map(([value, word]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sex === value}
              onClick={() => save({ sex: value })}
              className={`rounded px-2.5 py-0.5 text-lg font-semibold transition-colors ${
                sex === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {word}
            </button>
          ))}
        </span>
        <span>and I weigh</span>
        <Input
          type="number"
          min={1}
          value={bodyWeight}
          aria-label="Bodyweight"
          onChange={(event) => {
            const value = readNumber(event);
            if (value !== null) save({ bodyWeight: value });
          }}
          className={`${inputClassName} w-20`}
        />
        <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
      </div>
      {/* The unit button looks like part of the bodyweight, but it is the
          app-wide unit switch, so say so right under it. */}
      <p className="mt-2 text-sm">
        The <span className="font-semibold">{isMetric ? "kg" : "lb"}</span>{" "}
        button is also where you choose your units. Tap it to see every lift,
        total and chart here in {isMetric ? "lb" : "kg"}.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <p className="text-muted-foreground text-xs">
          {bioDataIsDefault
            ? guess.bodyWeightKg
              ? "Our first guess, worked out from your lifts. Make it yours and the ranking below follows."
              : "Make it yours and your strength ranking follows."
            : "This sets your strength ranking below. It stays in your browser."}
        </p>
        {bioDataIsDefault && (
          <Button variant="outline" size="sm" onClick={() => save()}>
            That&apos;s me
          </Button>
        )}
      </div>
    </div>
  );
}

function StatTile({ value, label, detail }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-4">
      <p className="text-2xl leading-none font-bold tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-1.5 text-sm font-medium">{label}</p>
      {detail && (
        <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
      )}
    </div>
  );
}

// A chart on the left and its meaning on the right, stacked on a phone.
function FeaturePanel({ visual, children }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border p-4 sm:flex-row sm:gap-4">
      <div className="w-36 shrink-0">{visual}</div>
      <div className="min-w-0 text-center sm:text-left">{children}</div>
    </div>
  );
}

function HighlightTile({ icon: Icon, title, detail, href }) {
  const body = (
    <>
      <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-5">
          {detail}
        </p>
      </div>
    </>
  );
  const className =
    "bg-muted/40 flex flex-1 basis-64 items-start gap-3 rounded-lg px-3 py-3 text-left";
  return href ? (
    <Link href={href} className={`${className} hover:bg-muted/70`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// Meets in the same gold the log and the charts mark them with, each one a
// link to that day in the log.
function MeetsPanel({ meets, isMetric }) {
  const listed = meets.list.slice(0, MAX_MEETS_LISTED);
  const unlisted = meets.count - listed.length;
  const bestTotal = meets.best
    ? formatMeetTotal(meets.best.topSets, isMetric)
    : null;

  return (
    <div
      className="rounded-lg border p-4 text-left"
      style={{
        borderColor: `color-mix(in srgb, ${MEET_GOLD} 55%, transparent)`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${MEET_GOLD} 14%, var(--card)) 0%, var(--card) 60%)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: MEET_GOLD, background: "var(--background)" }}
        >
          <MeetMedalGlyph size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-snug font-bold">
            {meets.count === 1
              ? "You have stepped onto the platform"
              : `${meets.count} meets on the platform`}
          </p>
          <p className="text-muted-foreground text-sm">
            {bestTotal
              ? `Your best meet total is ${bestTotal}${meets.best.name ? `, at ${meets.best.name}` : ""}.`
              : "We found your meet days and marked them in gold."}
          </p>
        </div>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {listed.map((meet) => (
          <li key={meet.date}>
            <Link
              href={getMeetLogHref(meet)}
              className="bg-background/60 hover:bg-background flex items-center justify-between gap-3 rounded-md px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {meet.name ?? "Meet day"}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {getReadableDateString(meet.date)}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {describeMeetResult(meet, isMetric)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {unlisted > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          And {pluralize(unlisted, "earlier meet")}, all marked in your log.
        </p>
      )}
    </div>
  );
}

// A meet's total when it has one, otherwise the lifts it did have: a bench
// only meet has no total but still has a bench.
function describeMeetResult(meet, isMetric) {
  const total = formatMeetTotal(meet.topSets, isMetric);
  if (total) return `${total} total`;
  return MEET_LIFTS.filter(({ liftType }) => meet.topSets[liftType])
    .map(({ liftType, name }) => {
      const { value, unit } = getDisplayWeight(
        meet.topSets[liftType],
        isMetric,
      );
      return `${name} ${value}${unit}`;
    })
    .join(" · ");
}

// Sections arrive one after another, top to bottom, so the page reads as a
// story being told. Skipped entirely for anyone who asks for less motion.
function Reveal({ index, className, children }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 + index * 0.12 }}
    >
      {children}
    </motion.div>
  );
}

function SinglePercentileRing({ percentile }) {
  const RADIUS = 70;
  const STROKE = 12;
  const SIZE = (RADIUS + STROKE) * 2;
  const CENTER = SIZE / 2;
  const circumference = 2 * Math.PI * RADIUS;
  const offset = circumference * (1 - (percentile ?? 0) / 100);

  return (
    <Link href="/how-strong-am-i" className="relative block">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full">
        {/* Background track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          style={{ stroke: "var(--muted-foreground)", opacity: 0.12 }}
          strokeWidth={STROKE}
        />
        {/* Filled arc */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          style={{ stroke: "var(--chart-1)" }}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90, ${CENTER}, ${CENTER})`}
        />
      </svg>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-muted-foreground text-[10px] leading-snug">
          Stronger than
        </span>
        <span className="text-3xl leading-none font-bold tabular-nums">
          {percentile}%
        </span>
        <span
          className="mt-0.5 text-[10px] leading-snug font-semibold"
          style={{ color: "var(--chart-1)" }}
        >
          of Gen. Pop.
        </span>
      </div>
    </Link>
  );
}

function getMotivationalPhrase(percentile) {
  if (percentile >= 95) return "You're in rare company. Elite strength.";
  if (percentile >= 85) return "Seriously strong. Most people never get here.";
  if (percentile >= 70) return "Stronger than most. Your hard work shows.";
  if (percentile >= 50) return "Above average. You're building real strength.";
  if (percentile >= 30) return "A solid foundation. Keep pushing.";
  return "Every journey starts somewhere. You're on your way.";
}

const IMPORT_SKIP_REASON_LABELS = {
  invalidDate: "invalid dates",
  missingExercise: "missing exercise names",
  missingReps: "missing or invalid reps",
  missingWeight: "missing loads",
  invalidWeight: "invalid loads",
  unsupportedDurationOrDistance: "duration or distance-only sets",
};

function ImportDiagnosticsNotice({ diagnostics }) {
  if (!diagnostics?.skippedRows) return null;

  const reasonSummary = Object.entries(diagnostics.skippedByReason || {})
    .filter(([, count]) => count > 0)
    .map(
      ([reason, count]) =>
        `${count.toLocaleString()} ${IMPORT_SKIP_REASON_LABELS[reason] || "unsupported rows"}`,
    )
    .join(", ");

  return (
    <div className="mt-4 flex w-full items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-left dark:border-amber-500/30 dark:bg-amber-500/5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="text-sm">
        <p className="font-medium">
          Imported {diagnostics.parsedRows.toLocaleString()} of{" "}
          {diagnostics.sourceRows.toLocaleString()} set rows
        </p>
        <p className="text-muted-foreground mt-1 leading-5">
          {diagnostics.skippedRows.toLocaleString()} could not become weighted,
          rep-based Strength Journeys entries
          {reasonSummary ? `: ${reasonSummary}.` : "."}
        </p>
      </div>
    </div>
  );
}

// The lifter's chosen e1RM formula, so this preview agrees with the calculator
// and every page it links to.
function useStoredE1rmFormula() {
  return (
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki"
  );
}

// "squat", "squat and bench", "squat, bench and deadlift".
function joinWithAnd(items) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function clampFileName(rawName) {
  if (!rawName) return null;
  const fileNameOnly = rawName.split(/[\\/]/).pop() || rawName;
  const extensionMatch = fileNameOnly.match(/(\.[^.]{1,4})$/);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";
  const withoutExtension = extension
    ? fileNameOnly.slice(0, -extension.length)
    : fileNameOnly;
  const normalized = withoutExtension.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const MAX = 34;
  const reserved = extension ? extension.length + 3 : 3;
  const visible = Math.max(8, MAX - reserved);
  const base =
    normalized.length > visible
      ? `${normalized.slice(0, visible).trimEnd()}...`
      : normalized;
  return `${base}${extension}`;
}
