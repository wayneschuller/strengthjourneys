import { motion } from "motion/react";
import { useMemo, useRef } from "react";
import {
  format,
  parseISO,
  differenceInCalendarYears,
  differenceInCalendarMonths,
  differenceInCalendarDays,
} from "date-fns";

import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Trophy,
  Activity,
  Flame,
  Anvil,
  Video,
} from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog, getDisplayWeight, logTiming } from "@/lib/processing-utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ACCENTS = {
  primary: "text-primary",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  violet: "text-violet-500",
  orange: "text-orange-500",
};

const BIG_FOUR_LIFTS = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];
const STRENGTH_RATING_SCORE = {
  "Physically Active": 1,
  Beginner: 2,
  Intermediate: 3,
  Advanced: 4,
  Elite: 5,
};

const CLASSIC_LIFT_NOTE_KEYWORDS = {
  meet: [
    "competition",
    "comp",
    "meet",
    "powerlifting meet",
    "powerlifting",
    "platform",
    "weigh in",
    "weigh-in",
    "opener",
    "second attempt",
    "third attempt",
    "1st attempt",
    "2nd attempt",
    "3rd attempt",
    "white lights",
    "judges",
    "usapl",
    "uspa",
    "apl",
    "attempt",
  ],
  positive: [
    "amazing",
    "awesome",
    "great",
    "felt great",
    "happy",
    "stoked",
    "pumped",
    "wow",
    "best",
    "huge",
    "nailed",
    "smoked",
    "easy",
    "flew",
    "crushed",
    "money",
    "dialed",
    "solid",
    "strong",
    "excellent",
  ],
  battle: [
    "hurt",
    "pain",
    "tweaked",
    "missed",
    "failed",
    "awful",
    "bad",
    "sloppy",
    "ugly",
  ],
};

const CLASSIC_LIFT_NOTE_FAST_HINTS = [
  "meet",
  "comp",
  "platform",
  "attempt",
  "opener",
  "usapl",
  "uspa",
  "amazing",
  "awesome",
  "great",
  "happy",
  "stoked",
  "pumped",
  "wow",
  "nailed",
  "smoked",
  "easy",
  "flew",
  "crushed",
  "money",
  "solid",
  "hurt",
  "pain",
  "tweak",
  "missed",
  "failed",
  "ugly",
  "sloppy",
];

const STREAK_ENCOURAGMENTS = [
  "Go have a beer.",
  "You've earned couch time.",
  "You're on track.",
  "Winner winner chicken dinner.",
  "Crushing it. Keep going.",
  "Consistency looks good on you.",
  "This is how PR streaks start.",
  "Text a friend and brag a little.",
  "You showed up. That matters most.",
  "Momentum is on your side.",
  "Future you is very grateful.",
  "Your streak graph would be proud.",
  "Log it, then relax. You did work.",
  "Tiny habits, big results.",
  "You vs. last week: you're winning.",
  "Banked another week. Nice.",
  "Coach brain: approved.",
  "Solid work. Sleep like an athlete.",
  "You did the hard part today.",
  "Bookmark this feeling.",
];

const JOURNEY_COMPLIMENT_POOLS = {
  underOneYear: [
    "building strong foundations",
    "showing up and stacking wins",
    "learning the craft",
    "early momentum",
    "new-lifter discipline",
    "solid progress",
    "turning effort into habit",
    "earning your stripes",
    "form-first progress",
    "quiet consistency",
    "strength basics done right",
    "the start of something strong",
    "putting in honest work",
    "rookie gains with purpose",
    "a strong start",
    "figuring out which end of the bar to lift",
    "growing yourself up",
    "novice gains",
  ],
  oneToTwoYears: [
    "consistency",
    "real progress",
    "strength growth",
    "earned momentum",
    "committed lifting",
    "barbell discipline",
    "serious habit-building",
    "steady improvement",
    "showing what consistency does",
    "strength that keeps compounding",
    "earned confidence",
    "putting together a strong run",
    "progress you can feel",
    "committed effort",
    "solid lifting momentum",
    "no longer a gym NPC",
    "moving plates and getting no dates",
    "trying to look swole",
  ],
  threeToFiveYears: [
    "serious lifting",
    "relentless improvement",
    "iron-earned progress",
    "resilience under the bar",
    "next-level consistency",
    "strength-building momentum",
    "earned experience",
    "barbell fluency",
    "hard-won progress",
    "disciplined training",
    "strength built the right way",
    "putting years behind the work",
    "seasoned consistency",
    "proof of the process",
    "serious commitment",
    "strong opinions and stronger excuses",
    "looking jacked in at least one hoodie",
    "eating protein",
  ],
  fiveToTenYears: [
    "dedication",
    "forged strength",
    "earned respect",
    "veteran consistency",
    "discipline that lasts",
    "long-game progress",
    "iron-forged discipline",
    "battle-tested consistency",
    "years of hard-earned strength",
    "built through heavy days",
    "veteran grit",
    "pressure-tested progress",
    "barbell war stories",
    "a reputation under the bar",
    "strength carved from effort",
    "menacing warm-up weights",
    "the right to complain about commercial gym playlists",
    "scaring newbies without even trying",
  ],
  tenPlusYears: [
    "strength mastery",
    "legendary consistency",
    "a lifting legacy",
    "iron-veteran discipline",
    "generational grit",
    "elite dedication",
    "decades of earned power",
    "battle-hardened strength",
    "a legacy under the bar",
    "ironclad discipline",
    "old-school grit and force",
    "mastery forged in heavy reps",
    "proof that time and effort win",
    "the long reign of consistency",
    "strength built over eras",
    "being personally offended by half reps",
    "old-man strength and zero patience",
    "enough barbell lore to bore a whole party",
  ],
};

/**
 * Compact stat row with icon, label, value, and optional subtext.
 */
function StatCard({
  accent,
  icon: Icon,
  description,
  title,
  footer,
  action,
  animationDelay,
}) {
  const iconColor = ACCENTS[accent] ?? ACCENTS.primary;
  return (
    <motion.div
      className="flex flex-col gap-0.5 py-1.5"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 22,
        delay: animationDelay / 1000,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-muted-foreground text-xs">{description}</span>
        {action && <span className="ml-1">{action}</span>}
      </div>
      <div className="text-sm leading-snug font-semibold tabular-nums sm:text-base">
        {title}
      </div>
      {footer && (
        <motion.div
          className="text-muted-foreground line-clamp-1 text-[11px] leading-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            delay: animationDelay / 1000 + 0.1,
          }}
        >
          {footer}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Shows a row of stat cards with key metrics: journey length, classic lift memory,
 * session momentum (90-day comparison), lifetime tonnage, and weekly consistency streak.
 * Uses useUserLiftingData and useAthleteBioData internally.
 *
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - When true, the actual stat cards are rendered.
 *   When false, a skeleton placeholder is shown (e.g. while row-count animation is running
 *   on the home dashboard).
 */
export function SectionTopCards({ isProgressDone = false }) {
  const { parsedData, liftTypes, topLiftsByTypeAndReps, sessionTonnageLookup } =
    useUserLiftingData();

  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  // Check if we have the necessary bio data and standards to calculate a strength rating
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;
  const classicLiftMemory = useMemo(
    () =>
      pickClassicLiftMemory({
        parsedData,
        liftTypes,
        topLiftsByTypeAndReps,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      }),
    [
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      hasBioData,
      age,
      bodyWeight,
      sex,
      isMetric,
    ],
  );

  // Calculate lifetime tonnage (all-time total weight moved) in preferred units.
  const lifetimeTonnage = useMemo(
    () =>
      calculateLifetimeTonnageFromLookup(
        sessionTonnageLookup,
        isMetric ? "kg" : "lb",
      ),
    [sessionTonnageLookup, isMetric],
  );

  // Calculate session momentum
  const { recentSessions, previousSessions, percentageChange } = useMemo(
    () =>
      allSessionDates.length
        ? calculateSessionMomentumFromDates(allSessionDates)
        : { recentSessions: 0, previousSessions: 0, percentageChange: 0 },
    [allSessionDates],
  );

  const { currentStreak, bestStreak, sessionsThisWeek } = useMemo(
    () =>
      allSessionDates.length
        ? calculateStreakFromDates(allSessionDates)
        : { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 },
    [allSessionDates],
  );
  const sessionsNeededThisWeek = Math.max(0, 3 - (sessionsThisWeek ?? 0));

  const totalStats = useMemo(() => calculateTotalStats(liftTypes), [liftTypes]);

  const streakEncouragementRef = useRef(null);
  if (streakEncouragementRef.current === null) {
    streakEncouragementRef.current =
      STREAK_ENCOURAGMENTS[
        Math.floor(Math.random() * STREAK_ENCOURAGMENTS.length)
      ];
  }
  const encouragementMessage = streakEncouragementRef.current;

  return (
    <div className="col-span-full grid grid-cols-2 gap-5 xl:grid-cols-3 2xl:grid-cols-5">
      {!isProgressDone && <SectionTopCardsSkeleton />}
      {isProgressDone && (
        <>
          <StatCard
            accent="primary"
            icon={Calendar}
            description="Journey Length"
            title={
              parsedData && parsedData.length > 0
                ? formatJourneyLength(parsedData[0].date)
                : "Starting your journey"
            }
            footer={
              <span>
                {totalStats.totalReps.toLocaleString()} reps ·{" "}
                {totalStats.totalSets.toLocaleString()} sets
              </span>
            }
            animationDelay={0}
          />

          <StatCard
            accent="amber"
            icon={Trophy}
            description="Classic Lift"
            title={
              classicLiftMemory
                ? `${classicLiftMemory.lift.liftType} ${classicLiftMemory.lift.reps}@${getDisplayWeight(classicLiftMemory.lift, isMetric ?? false).value}${getDisplayWeight(classicLiftMemory.lift, isMetric ?? false).unit}`
                : "No classic lifts yet"
            }
            footer={
              classicLiftMemory ? (
                <span>
                  {classicLiftMemory.reasonLabel} ·{" "}
                  {format(new Date(classicLiftMemory.lift.date), "d MMM yyyy")}
                  {classicLiftMemory.strengthRating
                    ? ` · ${STRENGTH_LEVEL_EMOJI[classicLiftMemory.strengthRating] ?? ""} ${classicLiftMemory.strengthRating}`
                    : ""}
                </span>
              ) : null
            }
            action={
              (classicLiftMemory?.lift?.URL || classicLiftMemory?.lift?.url) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  aria-label="Open lift video"
                  title="Open lift video"
                  onClick={() =>
                    window.open(
                      classicLiftMemory.lift.URL || classicLiftMemory.lift.url,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <Video className="h-3.5 w-3.5" />
                </Button>
              ) : null
            }
            animationDelay={200}
          />

          <StatCard
            accent="emerald"
            icon={Activity}
            description="Session Momentum"
            title={`${recentSessions} sessions in 90 days`}
            action={
              percentageChange !== 0 ? (
                <span
                  className={`flex items-center text-[11px] font-normal ${
                    percentageChange > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {percentageChange > 0 ? (
                    <TrendingUp className="mr-0.5 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-0.5 h-3 w-3" />
                  )}
                  {Math.abs(percentageChange)}%
                </span>
              ) : null
            }
            footer={(() => {
              const avgPerWeek = (recentSessions * 7) / 90;
              const avgFormatted =
                avgPerWeek % 1 === 0
                  ? Math.round(avgPerWeek)
                  : avgPerWeek.toFixed(1);
              return (
                <span>
                  Avg {avgFormatted}/wk · {previousSessions} prev 90 days
                </span>
              );
            })()}
            animationDelay={400}
          />

          <StatCard
            accent="violet"
            icon={Anvil}
            description="Lifetime Tonnage"
            title={
              lifetimeTonnage.primaryTotal > 0
                ? `${formatLifetimeTonnage(
                    lifetimeTonnage.primaryTotal,
                  )} ${lifetimeTonnage.primaryUnit} moved`
                : "No lifting logged yet"
            }
            footer={
              lifetimeTonnage.primaryTotal > 0 ? (
                <span>
                  {lifetimeTonnage.sessionCount.toLocaleString()} sessions · avg{" "}
                  {formatLifetimeTonnage(lifetimeTonnage.averagePerSession)}{" "}
                  {lifetimeTonnage.primaryUnit}/session
                </span>
              ) : null
            }
            animationDelay={600}
          />

          <StatCard
            accent="orange"
            icon={Flame}
            description="Weekly consistency"
            title={`${currentStreak} week${currentStreak === 1 ? "" : "s"} in a row`}
            footer={
              <span>
                {`Best: ${bestStreak}wk`}
                {sessionsNeededThisWeek > 0
                  ? ` · ${sessionsNeededThisWeek} more this week`
                  : sessionsThisWeek >= 3
                    ? ` · ${sessionsThisWeek} this week. ${encouragementMessage}`
                    : ""}
              </span>
            }
            animationDelay={800}
          />
        </>
      )}
    </div>
  );
}

// Placeholder skeleton rendered in place of SectionTopCards while row-count animation is running.
function SectionTopCardsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div
      key={`section-top-card-skeleton-${index}`}
      className="flex flex-col gap-1 py-1.5"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  ));
}

function formatJourneyLength(startDate) {
  const today = new Date();
  const start = parseISO(startDate);

  const years = differenceInCalendarYears(today, start);
  const months = differenceInCalendarMonths(today, start) % 12;
  const days = differenceInCalendarDays(today, start) % 30;

  if (years > 0) {
    const pluralizedYears = `${years} year${years > 1 ? "s" : ""}`;
    const compliment = getJourneyComplimentFromPool({
      years,
      startDate,
      today,
    });
    return `${pluralizedYears} of ${compliment}`;
  }

  if (months > 0) {
    const compliment = getJourneyComplimentFromPool({
      years: 0,
      startDate,
      today,
    });
    return `${months} month${months > 1 ? "s" : ""} of ${compliment}`;
  }

  const compliment = getJourneyComplimentFromPool({
    years: 0,
    startDate,
    today,
  });
  return `${days} day${days !== 1 ? "s" : ""} of ${compliment}`;
}

function getJourneyComplimentFromPool({ years, startDate, today }) {
  let poolKey = "underOneYear";
  let pool = JOURNEY_COMPLIMENT_POOLS.underOneYear;

  if (years >= 10) {
    poolKey = "tenPlusYears";
    pool = JOURNEY_COMPLIMENT_POOLS.tenPlusYears;
  } else if (years >= 5) {
    poolKey = "fiveToTenYears";
    pool = JOURNEY_COMPLIMENT_POOLS.fiveToTenYears;
  } else if (years >= 3) {
    poolKey = "threeToFiveYears";
    pool = JOURNEY_COMPLIMENT_POOLS.threeToFiveYears;
  } else if (years >= 1) {
    poolKey = "oneToTwoYears";
    pool = JOURNEY_COMPLIMENT_POOLS.oneToTwoYears;
  }

  // Preserve a random phrase for the current browser tab/session only.
  // A new tab gets a fresh sessionStorage scope and a new phrase generation.
  if (typeof window !== "undefined") {
    try {
      const storageKey = `journey-compliment:${startDate}:${poolKey}`;
      const storedIndex = window.sessionStorage.getItem(storageKey);

      if (storedIndex !== null) {
        const parsedIndex = Number.parseInt(storedIndex, 10);
        if (
          Number.isInteger(parsedIndex) &&
          parsedIndex >= 0 &&
          parsedIndex < pool.length
        ) {
          return pool[parsedIndex];
        }
      }

      const randomIndex = Math.floor(Math.random() * pool.length);
      window.sessionStorage.setItem(storageKey, String(randomIndex));
      return pool[randomIndex];
    } catch {
      // Fall through to deterministic fallback if sessionStorage is unavailable.
    }
  }

  const seed = `${startDate}-${poolKey}-${format(today, "yyyy-MM-dd")}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return pool[hash % pool.length];
}

function calculateTotalStats(liftTypes) {
  if (!liftTypes) return { totalSets: 0, totalReps: 0 };

  return liftTypes.reduce(
    (acc, lift) => ({
      totalSets: acc.totalSets + lift.totalSets,
      totalReps: acc.totalReps + lift.totalReps,
    }),
    { totalSets: 0, totalReps: 0 },
  );
}

/**
 * Calculates lifetime tonnage using precomputed session lookup
 * (sum of weight × reps across all non-goal lifts).
 * Returns totals per unit plus a primary unit/total for display.
 */
function calculateLifetimeTonnageFromLookup(
  sessionTonnageLookup,
  preferredUnit = "lb",
) {
  const allSessionDates = sessionTonnageLookup?.allSessionDates ?? [];
  const sessionTonnageByDate = sessionTonnageLookup?.sessionTonnageByDate ?? {};

  if (allSessionDates.length === 0) {
    return {
      totalByUnit: {},
      primaryUnit: preferredUnit || "lb",
      primaryTotal: 0,
      sessionCount: 0,
      averagePerSession: 0,
      hasTwelveMonthsOfData: false,
      lastYearPrimaryTotal: 0,
    };
  }

  const totalByUnit = {};
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const twelveMonthsAgoStr = subtractDaysFromStr(todayStr, 365);
  const lastYearByUnit = {};
  const earliestDateStr = allSessionDates[0] ?? null;
  const latestDateStr = allSessionDates[allSessionDates.length - 1] ?? null;

  for (let i = 0; i < allSessionDates.length; i++) {
    const date = allSessionDates[i];
    const tonnageByUnit = sessionTonnageByDate[date];
    if (!tonnageByUnit) continue;

    const unitKeys = Object.keys(tonnageByUnit);
    for (let j = 0; j < unitKeys.length; j++) {
      const unit = unitKeys[j];
      const tonnage = tonnageByUnit[unit] ?? 0;
      if (!tonnage) continue;
      totalByUnit[unit] = (totalByUnit[unit] ?? 0) + tonnage;
      if (date >= twelveMonthsAgoStr && date <= todayStr) {
        lastYearByUnit[unit] = (lastYearByUnit[unit] ?? 0) + tonnage;
      }
    }
  }

  const unitKeys = Object.keys(totalByUnit);
  const primaryUnit = preferredUnit || unitKeys[0] || "lb";

  // Combine all units into the preferred primary unit for display.
  let primaryTotal = 0;
  const KG_PER_LB = 1 / 2.2046;
  const LB_PER_KG = 2.2046;

  unitKeys.forEach((unit) => {
    const value = totalByUnit[unit] ?? 0;
    if (!value) return;

    if (unit === primaryUnit) {
      primaryTotal += value;
      return;
    }

    // Only two units are expected ("lb" and "kg"), but handle generically.
    if (unit === "kg" && primaryUnit === "lb") {
      primaryTotal += value * LB_PER_KG;
    } else if (unit === "lb" && primaryUnit === "kg") {
      primaryTotal += value * KG_PER_LB;
    } else {
      // Fallback: if we somehow have another unit, just add raw.
      primaryTotal += value;
    }
  });

  // Determine whether we have more than 12 months of data.
  let hasTwelveMonthsOfData = false;
  let lastYearPrimaryTotal = 0;
  if (earliestDateStr && latestDateStr) {
    const earliestDate = new Date(earliestDateStr + "T00:00:00Z");
    const latestDate = new Date(latestDateStr + "T00:00:00Z");
    const diffDays =
      (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
    hasTwelveMonthsOfData = diffDays >= 365;
  }

  if (hasTwelveMonthsOfData) {
    const lastYearKeys = Object.keys(lastYearByUnit);
    lastYearKeys.forEach((unit) => {
      const value = lastYearByUnit[unit] ?? 0;
      if (!value) return;

      if (unit === primaryUnit) {
        lastYearPrimaryTotal += value;
      } else if (unit === "kg" && primaryUnit === "lb") {
        lastYearPrimaryTotal += value * LB_PER_KG;
      } else if (unit === "lb" && primaryUnit === "kg") {
        lastYearPrimaryTotal += value * KG_PER_LB;
      } else {
        lastYearPrimaryTotal += value;
      }
    });
  }

  const averagePerSession =
    allSessionDates.length > 0
      ? Math.round(primaryTotal / allSessionDates.length)
      : 0;

  return {
    totalByUnit,
    primaryUnit,
    primaryTotal,
    sessionCount: allSessionDates.length,
    averagePerSession,
    hasTwelveMonthsOfData,
    lastYearPrimaryTotal,
  };
}

// Nicely formats large tonnage numbers (e.g. 1.2M, 250k, 42,500)
function formatLifetimeTonnage(value) {
  if (!value || value <= 0) return "0";

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return value.toLocaleString();
}

/**
 * Orchestrates the "Classic Lift" top-card selection.
 *
 * Flow:
 * 1) Build a broad candidate list (Big Four, frequent non-Big-Four PRs, note-driven story lifts)
 * 2) Compute a dynamic pool target size based on training age + candidate richness
 * 3) Curate a diversified pool (quotas by kind, era, note signals, etc.)
 * 4) Pick one candidate per browser tab session (sessionStorage-backed)
 */
function pickClassicLiftMemory({
  parsedData,
  liftTypes,
  topLiftsByTypeAndReps,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!topLiftsByTypeAndReps) return null;
  const firstParsedDate = parsedData?.[0]?.date ?? null;
  const lastParsedDate =
    parsedData && parsedData.length > 0
      ? parsedData[parsedData.length - 1]?.date ?? null
      : null;

  const trainingYears =
    firstParsedDate != null
      ? Math.max(0, differenceInCalendarYears(new Date(), parseISO(firstParsedDate)))
      : 0;

  const candidates = buildClassicLiftCandidates({
    topLiftsByTypeAndReps,
    liftTypes,
    parsedData,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });

  if (candidates.length === 0) {
    const fallbackPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);
    if (!fallbackPR) return null;
    return {
      lift: fallbackPR,
      reasonLabel: "Recent PR single",
      strengthRating: getLiftStrengthRating({
        lift: fallbackPR,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      }),
      score: 0,
    };
  }

  const targetPoolSize = getClassicLiftPoolTargetSize(
    trainingYears,
    candidates.length,
  );
  const selectionPool = buildClassicLiftSelectionPool(candidates, {
    trainingYears,
    targetPoolSize,
  });
  devLog(
    "Classic lift pool size:",
    selectionPool.length,
    "target:",
    targetPoolSize,
    "candidateCount:",
    candidates.length,
    "pool:",
    selectionPool.map((candidate) => ({
      liftType: candidate.lift?.liftType,
      reps: candidate.lift?.reps,
      weight: candidate.lift?.weight,
      unitType: candidate.lift?.unitType ?? "lb",
      date: candidate.lift?.date,
      reason: candidate.reasonLabel,
      candidateKind: candidate.candidateKind,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      strengthRating: candidate.strengthRating ?? null,
      noteTags: candidate.noteSignals?.tags ?? [],
      anniversaryDaysAway: candidate.anniversaryDaysAway ?? null,
      hasUrl: !!(candidate.lift?.URL || candidate.lift?.url),
    })),
  );

  return pickSessionStoredCandidate(selectionPool, {
    fingerprint: [
      firstParsedDate ?? "none",
      lastParsedDate ?? "none",
      parsedData?.length ?? 0,
      selectionPool.length,
    ].join("|"),
  });
}

/**
 * Builds the raw candidate list before pool curation.
 *
 * Candidate sources:
 * - Big Four top singles + standout rep PRs (core classic lane)
 * - Frequent non-Big-Four PRs (importance lane)
 * - Note-driven non-Big-Four story lifts (memory lane)
 *
 * We intentionally gather more than needed here; the later pool builder is responsible for
 * diversity and final pool size control.
 */
function buildClassicLiftCandidates({
  topLiftsByTypeAndReps,
  liftTypes,
  parsedData,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const candidates = [];
  const liftFrequencyMap = new Map(
    (liftTypes ?? []).map((lift) => [lift.liftType, lift.totalSets ?? 0]),
  );

  BIG_FOUR_LIFTS.forEach((liftType) => {
    const repRanges = topLiftsByTypeAndReps[liftType];
    if (!repRanges) return;

    // Longer training histories benefit from a deeper nostalgia bench; newer lifters stay tighter.
    const topSinglesDepth =
      trainingYears >= 10 ? 10 : trainingYears >= 5 ? 7 : trainingYears >= 3 ? 5 : 3;
    const standoutRepDepth =
      trainingYears >= 10 ? 4 : trainingYears >= 5 ? 3 : trainingYears >= 3 ? 2 : 1;

    const topSingles = takeTopUniqueWeightEntries(repRanges[0] ?? [], topSinglesDepth);
    topSingles.forEach((lift, index) => {
      const strengthRating = getLiftStrengthRating({
        lift,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift,
        candidateKind: "single",
        rankIndex: index,
        trainingYears,
        strengthRating,
        liftFrequency: liftFrequencyMap.get(liftType) ?? 0,
      });

      candidates.push({
        id: buildLiftCandidateId(lift, `single-${index + 1}`),
        lift,
        score: score.total,
        scoreBreakdown: score.breakdown,
        strengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "single",
        reasonLabel: `Top ${index + 1} single`,
      });
    });

    for (let repsIndex = 1; repsIndex < 10; repsIndex++) {
      const reps = repsIndex + 1;
      const topRepEntries = takeTopUniqueWeightEntries(
        repRanges[repsIndex] ?? [],
        standoutRepDepth,
      );
      if (topRepEntries.length === 0) continue;

      topRepEntries.forEach((topAtReps, repRankIndex) => {
        const estimatedE1RM = estimateE1RM(reps, topAtReps.weight, "Brzycki");
        const strengthRating = getLiftStrengthRating({
          lift: topAtReps,
          oneRepMaxOverride: estimatedE1RM,
          hasBioData,
          age,
          bodyWeight,
          sex,
          isMetric,
        });

        const ratingScore = STRENGTH_RATING_SCORE[strengthRating] ?? 0;
        const qualifiesStandoutRep =
          hasBioData
            ? ratingScore >= (trainingYears >= 3 ? 4 : 3)
            : reps <= 5;

        if (!qualifiesStandoutRep) return;

        const score = scoreClassicLiftCandidate({
          lift: topAtReps,
          candidateKind: "standoutRep",
          rankIndex: repRankIndex,
          trainingYears,
          strengthRating,
          liftFrequency: liftFrequencyMap.get(liftType) ?? 0,
        });

        candidates.push({
          id: buildLiftCandidateId(topAtReps, `rep-${reps}-${repRankIndex + 1}`),
          lift: topAtReps,
          score: score.total,
          scoreBreakdown: score.breakdown,
          strengthRating,
          noteSignals: score.noteSignals,
          anniversaryDaysAway: score.anniversaryDaysAway,
          candidateKind: "standoutRep",
          reasonLabel:
            repRankIndex === 0
              ? `Standout ${reps}RM`
              : `Standout ${reps}RM #${repRankIndex + 1}`,
        });
      });
    }
  });

  if (trainingYears < 3) {
    const recentPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);
    if (recentPR) {
      const strengthRating = getLiftStrengthRating({
        lift: recentPR,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      candidates.push({
        id: buildLiftCandidateId(recentPR, "recent-pr"),
        lift: recentPR,
        score:
          scoreClassicLiftCandidate({
            lift: recentPR,
            candidateKind: "single",
            rankIndex: 0,
            trainingYears,
            strengthRating,
            liftFrequency: liftFrequencyMap.get(recentPR.liftType) ?? 0,
          }).total + 8,
        strengthRating,
        candidateKind: "single",
        reasonLabel: "Recent PR single",
      });
    }
  }

  // Separate timing logs make it easier to tune expensive lanes independently.
  const storyLaneStart = performance.now();
  const frequentNonBigFourCandidates = buildFrequentNonBigFourClassicCandidates({
    topLiftsByTypeAndReps,
    liftTypes,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    logTiming(
      "Classic Lift Frequent Lane",
      performance.now() - storyLaneStart,
      `${frequentNonBigFourCandidates.length} candidates`,
    );
  }

  const storyLaneTimingStart = performance.now();
  const nonBigFourStoryCandidates = buildNonBigFourStoryCandidates({
    parsedData,
    liftTypes,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    logTiming(
      "Classic Lift Story Lane",
      performance.now() - storyLaneTimingStart,
      `${nonBigFourStoryCandidates.length} candidates`,
    );
  }

  return dedupeClassicLiftCandidates([
    ...candidates,
    ...frequentNonBigFourCandidates,
    ...nonBigFourStoryCandidates,
  ]);
}

/**
 * Computes an age-adjusted strength rating for a historical lift.
 *
 * Accepts an optional `oneRepMaxOverride` so non-single sets can be scored using estimated 1RM
 * while still using the lift's original date/liftType for standards lookup.
 */
function getLiftStrengthRating({
  lift,
  oneRepMaxOverride,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!hasBioData || !lift) return null;

  const standardForLift = getStandardForLiftDate(
    age,
    lift.date,
    bodyWeight,
    sex,
    lift.liftType,
    isMetric,
  );

  if (!standardForLift) return null;

  const unitForStandards = isMetric ? "kg" : "lb";
  const liftUnit = lift.unitType || "lb";
  let oneRepMax =
    typeof oneRepMaxOverride === "number" ? oneRepMaxOverride : lift.weight;

  if (!oneRepMax) return null;

  if (liftUnit !== unitForStandards) {
    if (liftUnit === "kg" && unitForStandards === "lb") {
      oneRepMax = Math.round(oneRepMax * 2.2046);
    } else if (liftUnit === "lb" && unitForStandards === "kg") {
      oneRepMax = Math.round(oneRepMax / 2.2046);
    }
  }

  return getStrengthRatingForE1RM(oneRepMax, standardForLift);
}

/**
 * Returns the top entries by weight while enforcing unique weight values.
 *
 * This avoids filling the candidate list with multiple same-weight duplicates (e.g. repeated
 * tie entries, warmups, or retakes at the same load).
 */
function takeTopUniqueWeightEntries(entries, maxCount) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const results = [];
  const seenWeights = new Set();

  for (let i = 0; i < entries.length && results.length < maxCount; i++) {
    const lift = entries[i];
    const weightKey = `${lift.weight}|${lift.unitType || "lb"}`;
    if (seenWeights.has(weightKey)) continue;
    seenWeights.add(weightKey);
    results.push(lift);
  }

  return results;
}

/**
 * Central scoring function used by all classic-lift candidate lanes.
 *
 * Output includes:
 * - `total`: final score for ranking
 * - `noteSignals`: parsed note tags for downstream quotas/debugging
 * - `anniversaryDaysAway`: used by pool quotas and debug logs
 * - `breakdown`: score components for tuning
 *
 * Keep all scoring weights centralized here so tuning stays coherent.
 */
function scoreClassicLiftCandidate({
  lift,
  candidateKind,
  rankIndex,
  trainingYears,
  strengthRating,
  liftFrequency,
}) {
  const ratingScore = STRENGTH_RATING_SCORE[strengthRating] ?? 0;
  const noteSignals = analyzeClassicLiftNotes(lift?.notes);
  const normalizedCandidateKind = candidateKind ?? "standoutRep";
  const adjustedBase =
    normalizedCandidateKind === "single"
      ? 100
      : normalizedCandidateKind === "frequentLiftPR"
        ? 88
      : normalizedCandidateKind === "storyLift"
        ? 74
        : 82;
  const rankBonus =
    normalizedCandidateKind === "single"
      ? Math.max(0, 5 - rankIndex) * 4
      : normalizedCandidateKind === "frequentLiftPR"
        ? Math.max(0, 4 - rankIndex) * 3
      : normalizedCandidateKind === "storyLift"
        ? Math.max(0, 3 - rankIndex) * 2
        : Math.max(0, 4 - rankIndex) * 2;
  const frequencyBonus = Math.min(
    8,
    Math.round(Math.log10((liftFrequency || 1) + 1) * 6),
  );

  const daysAgo = getDaysAgoFromDateStr(lift.date);
  // Veterans get nostalgia bias (older lifts rise); newer lifters get recency bias.
  const recencyOrNostalgiaBonus =
    trainingYears >= 3
      ? Math.min(18, Math.round(daysAgo / 180))
      : Math.max(0, 18 - Math.round(daysAgo / 30));

  const repSchemeBonus =
    normalizedCandidateKind === "standoutRep"
      ? Math.max(0, 8 - Math.abs((lift.reps ?? 1) - 5))
      : normalizedCandidateKind === "frequentLiftPR"
        ? Math.max(0, 7 - Math.abs((lift.reps ?? 1) - 4))
      : normalizedCandidateKind === "storyLift"
        ? Math.max(0, 6 - Math.abs((lift.reps ?? 3) - 5))
      : 0;
  const positiveNoteBonus = Math.min(12, noteSignals.positiveMatches.length * 4);
  const battleNoteBonus = Math.min(12, noteSignals.battleMatches.length * 4);
  const noteBonus =
    (noteSignals.hasMeetContext ? 24 : 0) + positiveNoteBonus + battleNoteBonus;
  const { boost: anniversaryBonus, daysAway: anniversaryDaysAway } =
    getAnniversaryBoost(lift.date);

  const total =
    adjustedBase +
    rankBonus +
    ratingScore * 4 +
    frequencyBonus +
    recencyOrNostalgiaBonus +
    repSchemeBonus +
    noteBonus +
    anniversaryBonus;

  return {
    total,
    noteSignals,
    anniversaryDaysAway,
    breakdown: {
      base,
      adjustedBase,
      rankBonus,
      strengthBonus: ratingScore * 4,
      frequencyBonus,
      nostalgiaBonus: recencyOrNostalgiaBonus,
      repSchemeBonus,
      noteBonus,
      anniversaryBonus,
    },
  };
}

/**
 * Dedupes candidates that point to the same lift/set entry, keeping the highest-scoring variant.
 *
 * The same lift can be discovered by multiple lanes (e.g. frequent-lift PR + story-lift notes).
 */
function dedupeClassicLiftCandidates(candidates) {
  const bestByLiftKey = new Map();

  (candidates ?? []).forEach((candidate) => {
    if (!candidate?.lift) return;
    const key = buildLiftCandidateId(candidate.lift, "core");
    const existing = bestByLiftKey.get(key);
    if (!existing || candidate.score > existing.score) {
      bestByLiftKey.set(key, candidate);
    }
  });

  return Array.from(bestByLiftKey.values());
}

/**
 * Stable identifier for a candidate (used for dedupe + session selection storage).
 *
 * `suffix` allows the same underlying lift to appear as different "candidate concepts"
 * during raw generation (single vs e1RM lane, etc.) before dedupe collapses them.
 */
function buildLiftCandidateId(lift, suffix) {
  return [
    lift?.liftType ?? "Unknown",
    lift?.date ?? "0000-00-00",
    lift?.reps ?? 0,
    lift?.weight ?? 0,
    lift?.unitType ?? "lb",
    suffix,
  ].join("|");
}

/**
 * Dynamic pool-size target derived from training age and candidate richness.
 *
 * This scales with `candidateCount` so long-history users with lots of viable memories get a
 * meaningfully larger rotation pool, while smaller datasets stay focused.
 */
function getClassicLiftPoolTargetSize(trainingYears, candidateCount = 0) {
  const count = Math.max(0, candidateCount || 0);

  if (trainingYears >= 10) {
    return clampNumber(Math.round(count * 0.6), 64, 96);
  }
  if (trainingYears >= 5) {
    return clampNumber(Math.round(count * 0.55), 36, 72);
  }
  if (trainingYears >= 3) {
    return clampNumber(Math.round(count * 0.5), 24, 48);
  }
  if (trainingYears >= 1) {
    return clampNumber(Math.round(count * 0.45), 14, 28);
  }
  return clampNumber(Math.round(count * 0.4), 8, 16);
}

/**
 * Curates the final session-random pool from the raw candidates.
 *
 * This is intentionally quota-driven (not simply top-N by score) to preserve variety:
 * - Big Four representation
 * - rep PRs
 * - frequent non-Big-Four PRs
 * - note-driven story lifts
 * - anniversary-ish dates
 * - era balance for longer histories
 */
function buildClassicLiftSelectionPool(candidates, { trainingYears, targetPoolSize }) {
  const sortedCandidates = [...(candidates ?? [])].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lift?.date !== b.lift?.date) {
      return (a.lift?.date ?? "") > (b.lift?.date ?? "") ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  const targetSize = Math.min(sortedCandidates.length, targetPoolSize);
  if (targetSize <= 0) return [];

  const selected = [];
  const selectedIds = new Set();
  const byLift = new Map();
  const byKind = new Map();

  const addCandidate = (candidate) => {
    if (!candidate || selectedIds.has(candidate.id) || selected.length >= targetSize) {
      return false;
    }
    selected.push(candidate);
    selectedIds.add(candidate.id);
    byLift.set(
      candidate.lift?.liftType ?? "Unknown",
      (byLift.get(candidate.lift?.liftType ?? "Unknown") ?? 0) + 1,
    );
    byKind.set(
      candidate.candidateKind ?? "unknown",
      (byKind.get(candidate.candidateKind ?? "unknown") ?? 0) + 1,
    );
    return true;
  };

  // Shared quota helper: pulls highest-ranked items matching a predicate until `limit`.
  const addByPredicate = (limit, predicate) => {
    if (limit <= 0) return;
    for (let i = 0; i < sortedCandidates.length && selected.length < targetSize; i++) {
      if (limit <= 0) break;
      const candidate = sortedCandidates[i];
      if (selectedIds.has(candidate.id)) continue;
      if (!predicate(candidate)) continue;
      if (addCandidate(candidate)) {
        limit--;
      }
    }
  };

  // Guarantee a baseline of Big Four representation before filling specialty lanes.
  const minPerBigFour = trainingYears >= 10 ? 3 : trainingYears >= 5 ? 2 : 1;
  BIG_FOUR_LIFTS.forEach((liftType) => {
    const availableForLift = sortedCandidates.filter(
      (candidate) => candidate.lift?.liftType === liftType,
    ).length;
    addByPredicate(Math.min(minPerBigFour, availableForLift), (candidate) => {
      return candidate.lift?.liftType === liftType;
    });
  });

  if (targetSize >= 12) {
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.2)), (candidate) => {
      return candidate.candidateKind === "standoutRep";
    });
  }

  if (targetSize >= 16) {
    addByPredicate(Math.min(8, Math.ceil(targetSize * 0.2)), (candidate) => {
      return candidate.candidateKind === "storyLift";
    });
  }

  if (targetSize >= 16) {
    addByPredicate(Math.min(10, Math.ceil(targetSize * 0.28)), (candidate) => {
      return candidate.candidateKind === "frequentLiftPR";
    });
  }

  if (trainingYears >= 3) {
    addByPredicate(Math.min(4, Math.ceil(targetSize * 0.12)), (candidate) => {
      return candidate.noteSignals?.hasMeetContext;
    });
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.18)), (candidate) => {
      return candidate.noteSignals?.positiveMatches?.length > 0;
    });
    addByPredicate(Math.min(4, Math.ceil(targetSize * 0.12)), (candidate) => {
      return (candidate.anniversaryDaysAway ?? 999) <= 14;
    });
  }

  if (trainingYears >= 5) {
    addByPredicate(Math.min(10, Math.ceil(targetSize * 0.3)), (candidate) => {
      return getDaysAgoFromDateStr(candidate.lift?.date) >= 365 * 5;
    });
    addByPredicate(Math.min(8, Math.ceil(targetSize * 0.22)), (candidate) => {
      const daysAgo = getDaysAgoFromDateStr(candidate.lift?.date);
      return daysAgo >= 365 * 2 && daysAgo < 365 * 5;
    });
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.18)), (candidate) => {
      return getDaysAgoFromDateStr(candidate.lift?.date) < 365 * 2;
    });
  }

  // Final fill pass enforces soft caps so one lift/kind cannot dominate the pool.
  const softPerLiftCap = Math.max(minPerBigFour, Math.ceil(targetSize * 0.4));
  addByPredicate(targetSize, (candidate) => {
    const liftType = candidate.lift?.liftType ?? "Unknown";
    const currentLiftCount = byLift.get(liftType) ?? 0;
    if (currentLiftCount >= softPerLiftCap) return false;

    const standoutCount = byKind.get("standoutRep") ?? 0;
    if (
      candidate.candidateKind === "standoutRep" &&
      targetSize >= 16 &&
      standoutCount >= Math.ceil(targetSize * 0.55)
    ) {
      return false;
    }

    const storyLiftCount = byKind.get("storyLift") ?? 0;
    if (
      candidate.candidateKind === "storyLift" &&
      targetSize >= 16 &&
      storyLiftCount >= Math.ceil(targetSize * 0.35)
    ) {
      return false;
    }

    const frequentLiftPrCount = byKind.get("frequentLiftPR") ?? 0;
    if (
      candidate.candidateKind === "frequentLiftPR" &&
      targetSize >= 16 &&
      frequentLiftPrCount >= Math.ceil(targetSize * 0.42)
    ) {
      return false;
    }

    return true;
  });

  addByPredicate(targetSize, () => true);

  return selected;
}

/** Small utility for pool target bounds. */
function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Builds a low-cost non-Big-Four performance lane using curated PR structures only.
 *
 * For the user's most-frequent non-Big-Four lifts, we surface:
 * - best true single (if it exists)
 * - best e1RM candidate across rep ranges 1–10
 *
 * This captures "identity lifts" without scanning all parsed rows.
 */
function buildFrequentNonBigFourClassicCandidates({
  topLiftsByTypeAndReps,
  liftTypes,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!topLiftsByTypeAndReps || !Array.isArray(liftTypes) || liftTypes.length === 0) {
    return [];
  }

  // Longer histories can support a wider "important lifts" universe.
  const topLiftCount = trainingYears >= 10 ? 15 : trainingYears >= 5 ? 12 : 10;
  const frequentNonBigFour = liftTypes
    .slice(0, topLiftCount + BIG_FOUR_LIFTS.length)
    .filter((liftMeta) => !BIG_FOUR_LIFTS.includes(liftMeta.liftType))
    .slice(0, topLiftCount);

  const candidates = [];

  for (let i = 0; i < frequentNonBigFour.length; i++) {
    const liftMeta = frequentNonBigFour[i];
    const liftType = liftMeta.liftType;
    const repRanges = topLiftsByTypeAndReps[liftType];
    if (!repRanges) continue;

    const liftTotals = {
      totalSets: liftMeta.totalSets ?? 0,
      totalReps: liftMeta.totalReps ?? 0,
    };
    const careBonus = getStoryLiftCareBonus(liftTotals);

    const bestSingle = takeTopUniqueWeightEntries(repRanges[0] ?? [], 1)[0] ?? null;
    if (bestSingle) {
      const strengthRating = getLiftStrengthRating({
        lift: bestSingle,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift: bestSingle,
        candidateKind: "frequentLiftPR",
        rankIndex: 0,
        trainingYears,
        strengthRating,
        liftFrequency: liftTotals.totalSets,
      });
      candidates.push({
        id: buildLiftCandidateId(bestSingle, `frequent-single-${i + 1}`),
        lift: bestSingle,
        score: score.total + careBonus,
        scoreBreakdown: {
          ...score.breakdown,
          careBonus,
        },
        strengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "frequentLiftPR",
        reasonLabel: "Frequent-lift best single",
      });
    }

    // Pick the single strongest e1RM expression across rep ranges for this lift.
    let bestE1RMCandidate = null;
    let bestE1RMWeight = 0;
    for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
      const topAtReps = repRanges[repsIndex]?.[0];
      if (!topAtReps) continue;
      const reps = repsIndex + 1;
      const estimated = estimateE1RM(reps, topAtReps.weight, "Brzycki");
      if (estimated > bestE1RMWeight) {
        bestE1RMWeight = estimated;
        bestE1RMCandidate = topAtReps;
      }
    }

    if (bestE1RMCandidate) {
      const e1rmStrengthRating = getLiftStrengthRating({
        lift: bestE1RMCandidate,
        oneRepMaxOverride:
          bestE1RMCandidate.reps > 1
            ? estimateE1RM(
                bestE1RMCandidate.reps,
                bestE1RMCandidate.weight,
                "Brzycki",
              )
            : bestE1RMCandidate.weight,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift: bestE1RMCandidate,
        candidateKind: "frequentLiftPR",
        rankIndex: bestE1RMCandidate.reps === 1 ? 1 : 0,
        trainingYears,
        strengthRating: e1rmStrengthRating,
        liftFrequency: liftTotals.totalSets,
      });
      candidates.push({
        id: buildLiftCandidateId(bestE1RMCandidate, `frequent-e1rm-${i + 1}`),
        lift: bestE1RMCandidate,
        score: score.total + careBonus + (bestE1RMCandidate.reps > 1 ? 3 : 0),
        scoreBreakdown: {
          ...score.breakdown,
          careBonus,
          e1rmIdentityBonus: bestE1RMCandidate.reps > 1 ? 3 : 0,
        },
        strengthRating: e1rmStrengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "frequentLiftPR",
        reasonLabel:
          bestE1RMCandidate.reps === 1
            ? "Frequent-lift best e1RM (single)"
            : `Frequent-lift best e1RM (${bestE1RMCandidate.reps} reps)`,
      });
    }
  }

  return candidates;
}

/**
 * Builds the note-driven non-Big-Four "story lift" lane from parsedData.
 *
 * Performance is intentionally protected via:
 * - aggressive early filters
 * - cheap substring gate before fuzzy parsing
 * - note-signal cache by note string
 * - per-lift and global caps
 */
function buildNonBigFourStoryCandidates({
  parsedData,
  liftTypes,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return [];

  const liftTotalsMap = new Map(
    (liftTypes ?? []).map((lift) => [
      lift.liftType,
      {
        totalSets: lift.totalSets ?? 0,
        totalReps: lift.totalReps ?? 0,
      },
    ]),
  );
  const noteSignalCache = new Map();
  const candidatesByLiftType = new Map();
  const seenLiftKeys = new Set();

  const globalCandidateCap =
    trainingYears >= 10 ? 24 : trainingYears >= 5 ? 18 : trainingYears >= 3 ? 12 : 8;
  const perLiftCap =
    trainingYears >= 10 ? 4 : trainingYears >= 5 ? 3 : trainingYears >= 3 ? 2 : 2;
  const maxReps = trainingYears >= 5 ? 15 : 12;

  for (let i = 0; i < parsedData.length; i++) {
    const lift = parsedData[i];
    if (!lift || lift.isGoal) continue;
    if (!lift.notes || typeof lift.notes !== "string") continue;
    if (!lift.liftType || BIG_FOUR_LIFTS.includes(lift.liftType)) continue;
    if (!lift.date || !lift.weight || !lift.reps) continue;
    if (lift.reps < 1 || lift.reps > maxReps) continue;

    // Cheap substring gate before regex/keyword parsing (fast reject path).
    const noteLower = lift.notes.toLowerCase();
    let hasFastHint = false;
    for (let j = 0; j < CLASSIC_LIFT_NOTE_FAST_HINTS.length; j++) {
      if (noteLower.includes(CLASSIC_LIFT_NOTE_FAST_HINTS[j])) {
        hasFastHint = true;
        break;
      }
    }
    if (!hasFastHint) continue;

    const dedupeKey = `${lift.liftType}|${lift.date}|${lift.reps}|${lift.weight}|${lift.unitType || "lb"}`;
    if (seenLiftKeys.has(dedupeKey)) continue;
    seenLiftKeys.add(dedupeKey);

    // Notes repeat a lot ("felt good", "meet day"), so cache parsed signals by raw note text.
    let noteSignals = noteSignalCache.get(lift.notes);
    if (!noteSignals) {
      noteSignals = analyzeClassicLiftNotes(lift.notes);
      noteSignalCache.set(lift.notes, noteSignals);
    }
    if (!noteSignals.tags?.length) continue;

    const hasStrongStorySignal =
      noteSignals.hasMeetContext ||
      noteSignals.positiveMatches.length > 0 ||
      noteSignals.battleMatches.length > 0;
    if (!hasStrongStorySignal) continue;

    let strengthRating = null;
    if (hasBioData && lift.reps <= 10) {
      const estimatedE1RM = estimateE1RM(lift.reps, lift.weight, "Brzycki");
      strengthRating = getLiftStrengthRating({
        lift,
        oneRepMaxOverride: estimatedE1RM,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
    }

    const liftTotals = liftTotalsMap.get(lift.liftType) ?? {
      totalSets: 0,
      totalReps: 0,
    };
    const score = scoreClassicLiftCandidate({
      lift,
      candidateKind: "storyLift",
      rankIndex: 0,
      trainingYears,
      strengthRating,
      liftFrequency: liftTotals.totalSets,
    });

    const careBonus = getStoryLiftCareBonus(liftTotals);
    const rarityBonus = Math.max(
      0,
      10 - Math.min(10, Math.round(Math.log10((liftTotals.totalSets ?? 1) + 1) * 6)),
    );
    const finalScore = score.total + rarityBonus + careBonus;

    const candidate = {
      id: buildLiftCandidateId(lift, `story-${i}`),
      lift,
      score: finalScore,
      scoreBreakdown: {
        ...score.breakdown,
        careBonus,
        rarityBonus,
      },
      strengthRating,
      noteSignals,
      anniversaryDaysAway: score.anniversaryDaysAway,
      candidateKind: "storyLift",
      reasonLabel: buildStoryLiftReasonLabel(lift, noteSignals),
    };

    const liftBucket = candidatesByLiftType.get(lift.liftType) ?? [];
    liftBucket.push(candidate);
    liftBucket.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.lift.date !== b.lift.date) return a.lift.date > b.lift.date ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    if (liftBucket.length > perLiftCap) {
      liftBucket.length = perLiftCap;
    }
    candidatesByLiftType.set(lift.liftType, liftBucket);
  }

  const flattened = Array.from(candidatesByLiftType.values()).flat();
  flattened.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lift.date !== b.lift.date) return a.lift.date > b.lift.date ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  if (flattened.length > globalCandidateCap) {
    flattened.length = globalCandidateCap;
  }

  return flattened;
}

/**
 * Human-readable footer label for story-lift candidates.
 *
 * Keep this compact: it appears in the top-card footer and should explain "why this made the pool".
 */
function buildStoryLiftReasonLabel(lift, noteSignals) {
  if (noteSignals?.hasMeetContext) {
    return `Story lift (${lift.reps} reps · meet)`;
  }
  if (noteSignals?.battleMatches?.length) {
    return `Story lift (${lift.reps} reps · battle)`;
  }
  if (noteSignals?.positiveMatches?.length) {
    return `Story lift (${lift.reps} reps · note)`;
  }
  return `Story lift (${lift.reps} reps)`;
}

/**
 * "Care signal" bonus for non-Big-Four lifts.
 *
 * High sets/reps frequency implies the lift mattered to the athlete over time, so story/frequent
 * lanes get a bonus for lifts the user repeatedly trained.
 */
function getStoryLiftCareBonus(liftTotals) {
  const totalSets = liftTotals?.totalSets ?? 0;
  const totalReps = liftTotals?.totalReps ?? 0;

  const setsSignal = Math.round(Math.log10(totalSets + 1) * 7);
  const repsSignal = Math.round(Math.log10(totalReps + 1) * 5);

  let milestoneBonus = 0;
  if (totalSets >= 250 || totalReps >= 1000) milestoneBonus += 10;
  else if (totalSets >= 120 || totalReps >= 500) milestoneBonus += 7;
  else if (totalSets >= 60 || totalReps >= 250) milestoneBonus += 4;
  else if (totalSets >= 25 || totalReps >= 100) milestoneBonus += 2;

  return Math.min(22, setsSignal + repsSignal + milestoneBonus);
}

/**
 * Lightweight fuzzy note parser used for nostalgia scoring and pool quotas.
 *
 * Returns normalized signal buckets (`meet`, `positive`, `battle`) plus tags for debug output.
 * This stays intentionally heuristic/regex-based for speed and tuneability.
 */
function analyzeClassicLiftNotes(notes) {
  if (!notes || typeof notes !== "string") {
    return {
      hasMeetContext: false,
      meetMatches: [],
      positiveMatches: [],
      battleMatches: [],
      tags: [],
    };
  }

  const normalized = normalizeClassicLiftNoteText(notes);
  const meetMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.meet,
  );
  const positiveMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.positive,
  );
  const battleMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.battle,
  );

  const tags = [];
  if (meetMatches.length > 0) tags.push("meet");
  if (positiveMatches.length > 0) tags.push("positive");
  if (battleMatches.length > 0) tags.push("battle");

  return {
    hasMeetContext: meetMatches.length > 0,
    meetMatches,
    positiveMatches,
    battleMatches,
    tags,
  };
}

/** Normalizes notes for keyword matching (lowercase + punctuation stripping). */
function normalizeClassicLiftNoteText(notes) {
  return notes
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches keyword/phrase list against normalized note text using word-boundary style checks.
 *
 * We avoid naive substring matching here to reduce false positives (e.g. short tokens inside words).
 */
function matchClassicLiftNoteKeywords(normalizedNotes, keywords) {
  if (!normalizedNotes) return [];

  const matches = [];
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const escaped = escapeRegExp(keyword.toLowerCase());
    const pattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
    if (pattern.test(normalizedNotes)) {
      matches.push(keyword);
    }
  }
  return matches;
}

/** Escapes user-defined keyword phrases for regex construction. */
function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Small nostalgia boost for lifts close to the same calendar date (month/day) this year.
 *
 * We compare against previous/current/next year to get the nearest "anniversary distance"
 * and return both the boost and `daysAway` for quotas/debugging.
 */
function getAnniversaryBoost(dateStr) {
  if (!dateStr) return { boost: 0, daysAway: null };

  const parts = dateStr.split("-");
  if (parts.length !== 3) return { boost: 0, daysAway: null };

  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return { boost: 0, daysAway: null };
  }

  const today = new Date();
  const y = today.getFullYear();
  const todayMidnight = new Date(y, today.getMonth(), today.getDate());
  const candidates = [
    new Date(y - 1, month - 1, day),
    new Date(y, month - 1, day),
    new Date(y + 1, month - 1, day),
  ];
  let minDays = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candidates.length; i++) {
    const diffMs = Math.abs(candidates[i].getTime() - todayMidnight.getTime());
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < minDays) minDays = diffDays;
  }

  let boost = 0;
  if (Number.isFinite(minDays)) {
    if (minDays <= 3) boost = 12;
    else if (minDays <= 7) boost = 8;
    else if (minDays <= 14) boost = 5;
    else if (minDays <= 30) boost = 2;
  }

  return {
    boost,
    daysAway: Number.isFinite(minDays) ? minDays : null,
  };
}

/**
 * Picks one candidate per browser tab session and persists it in sessionStorage.
 *
 * Behavior:
 * - Stable within a tab (refresh-safe)
 * - New tab gets a new random selection
 * - Falls back to deterministic hash if sessionStorage is unavailable
 */
function pickSessionStoredCandidate(candidates, { fingerprint }) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionSeed = `${todayStr}|${fingerprint}|${candidates.length}`;

  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(
        LOCAL_STORAGE_KEYS.CLASSIC_LIFT_SESSION,
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed?.seed === sessionSeed &&
          Number.isInteger(parsed.index) &&
          parsed.index >= 0 &&
          parsed.index < candidates.length
        ) {
          return candidates[parsed.index];
        }
      }

      const randomIndex = Math.floor(Math.random() * candidates.length);
      window.sessionStorage.setItem(
        LOCAL_STORAGE_KEYS.CLASSIC_LIFT_SESSION,
        JSON.stringify({ seed: sessionSeed, index: randomIndex }),
      );
      return candidates[randomIndex];
    } catch {
      // Fall through to deterministic hash when sessionStorage is unavailable.
    }
  }

  return candidates[hashStringToIndex(sessionSeed, candidates.length)];
}

/** Deterministic fallback index for environments where sessionStorage is unavailable. */
function hashStringToIndex(seed, modulo) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

/** Returns whole-day distance from today for a YYYY-MM-DD string (UTC-safe parsing). */
function getDaysAgoFromDateStr(dateStr) {
  if (!dateStr) return 0;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Finds the most recent 1-rep PR across the top 5 most frequent lift types
 * @param {Object} topLiftsByTypeAndReps - The data structure containing PRs by lift type and rep ranges
 * @param {Array} liftTypes - Array of lift types sorted by frequency (totalSets)
 * @returns {Object|null} The most recent 1-rep PR or null if none found
 */
function findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes) {
  if (!topLiftsByTypeAndReps || !liftTypes) return null;

  // Get the most frequent lift types
  const topFiveLiftTypes = liftTypes.slice(0, 5).map((lift) => lift.liftType);

  let mostRecentPR = null;
  let mostRecentDate = "";

  // Only look at PRs from the top lift types
  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    // Skip if this lift type isn't in the top
    if (!topFiveLiftTypes.includes(liftType)) return;

    const singleReps = repRanges[0]; // Index 0 is 1-rep maxes
    if (singleReps && singleReps.length > 0) {
      const topWeight = singleReps[0].weight;
      const pr = singleReps
        .filter((lift) => lift.weight === topWeight)
        .reduce(
          (best, lift) => (lift.date > best.date ? lift : best),
          singleReps[0],
        );
      if (!mostRecentPR || pr.date > mostRecentDate) {
        mostRecentPR = pr;
        mostRecentDate = pr.date;
      }
    }
  });

  return mostRecentPR;
}

/**
 * Calculates PRs achieved in the last 12 months
 * @param {Object} topLiftsByTypeAndReps - The data structure containing PRs by lift type and rep ranges
 * @returns {Object} Object containing count of PRs and array of lift types with PRs
 */
function calculatePRsInLast12Months(topLiftsByTypeAndReps) {
  if (!topLiftsByTypeAndReps) return { count: 0, liftTypes: [] };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const twelveMonthsAgo = subtractDaysFromStr(todayStr, 365);
  const prLiftTypes = new Set();

  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    // Look at all rep ranges
    Object.values(repRanges).forEach((prs) => {
      if (prs && prs.length > 0) {
        // Check if any PR in this rep range is from last 12 months
        const hasRecentPR = prs.some((pr) => pr.date >= twelveMonthsAgo);
        if (hasRecentPR) {
          prLiftTypes.add(liftType);
        }
      }
    });
  });

  return {
    count: prLiftTypes.size,
    liftTypes: Array.from(prLiftTypes),
  };
}

/**
 * Calculates session momentum by comparing the last 90 days to the previous 90 days.
 * Uses precomputed unique session dates from sessionTonnageLookup.
 * @param {Array<string>} allSessionDates - Sorted unique session dates (YYYY-MM-DD)
 * @returns {Object} Object containing session counts and percentage change
 */
function calculateSessionMomentumFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return { recentSessions: 0, previousSessions: 0, percentageChange: 0 };
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const ninetyDaysAgoStr = subtractDaysFromStr(todayStr, 90);
  const oneEightyDaysAgoStr = subtractDaysFromStr(todayStr, 180);

  const recentSessionDates = new Set();
  const previousSessionDates = new Set();

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    // YYYY-MM-DD string comparison
    if (dateStr >= ninetyDaysAgoStr && dateStr <= todayStr) {
      recentSessionDates.add(dateStr);
    } else if (dateStr >= oneEightyDaysAgoStr && dateStr < ninetyDaysAgoStr) {
      previousSessionDates.add(dateStr);
    }
  }

  const recentSessions = recentSessionDates.size;
  const previousSessions = previousSessionDates.size;

  let percentageChange = 0;
  if (previousSessions > 0) {
    percentageChange = Math.round(
      ((recentSessions - previousSessions) / previousSessions) * 100,
    );
  } else if (recentSessions > 0) {
    percentageChange = 100; // From 0 to something is a 100% improvement for this context
  }

  return { recentSessions, previousSessions, percentageChange };
}

// YYYY-MM-DD only. Returns Monday of that week as "YYYY-MM-DD" (one Date used).
function getWeekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Days in month (1-12); Feb uses 28, caller can pass 29 for leap year.
function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

// YYYY-MM-DD minus n days, returns "YYYY-MM-DD". Pure string/math, no Date.
function subtractDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    d--;
    if (d < 1) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d = daysInMonth(y, m);
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// YYYY-MM-DD plus n days, returns "YYYY-MM-DD". Pure string/math, no Date.
function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Calculates current streak and best streak of weeks with 3+ sessions.
 * A "session" = one calendar day with at least one gym visit (we count unique days, not sets/lifts).
 * Uses string comparison for dates (YYYY-MM-DD) and caches week key per unique date.
 *
 * @param {Array<string>} allSessionDates - Sorted unique session dates (YYYY-MM-DD)
 * @returns {Object} Object containing currentStreak, bestStreak (weeks), and sessionsThisWeek (unique days)
 */
function calculateStreakFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  // --- Phase 1: Build "sessions per week" (unique days per week) ---
  // weekMap: for each week (Monday's date as "YYYY-MM-DD"), we store the Set of *dates* that had
  // at least one gym session that week. So if you trained Mon/Wed/Fri, that week key maps to 3 dates.
  // We do NOT count lift entries — one workout with 20 sets still counts as 1 session (one day).
  const dateToWeekKey = new Map(); // cache: dateStr -> Monday of that week
  const weekMap = new Map(); // weekKey (Monday YYYY-MM-DD) -> Set of date strings (unique session days in that week)

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    // Resolve which week (Monday) this session falls into; cache so we only compute once per unique date
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr); // add this session date to that week's set (Set = unique days)
  }

  // Session count per week = number of unique days with a gym session that week (3+ = "streak week")
  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });

  const weekKeys = Array.from(weekSessionCount.keys()).sort(); // ascending; string sort is correct for YYYY-MM-DD
  if (weekKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const oldestWeek = weekKeys[0];

  // --- Phase 2: Reference weeks (this week, last week) ---
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thisWeekKey = getWeekKeyFromDateStr(todayStr);
  const sessionsThisWeek = weekSessionCount.get(thisWeekKey) || 0;

  // --- Phase 3: Current streak (consecutive weeks with 3+ sessions) ---
  // Count the current week immediately once it reaches 3+ sessions.
  // If current week is below 3, it does not break the streak yet.
  let currentStreak = 0;
  const thisWeekIsQualified = sessionsThisWeek >= 3;
  if (thisWeekIsQualified) {
    currentStreak = 1;
  }
  const lastCompleteWeekKey = subtractDaysFromStr(thisWeekKey, 7); // Monday of the last completed week
  let weekKey = lastCompleteWeekKey;
  while (weekKey >= oldestWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      currentStreak++;
    } else {
      break;
    }
    weekKey = subtractDaysFromStr(weekKey, 7);
  }

  // --- Phase 4: Best streak (longest run of consecutive 3+ session weeks) ---
  // Include this week only when it has already reached 3+ sessions.
  let bestStreak = 0;
  let tempStreak = 0;
  weekKey = oldestWeek;
  const bestStreakEndWeek = thisWeekIsQualified
    ? thisWeekKey
    : lastCompleteWeekKey;
  while (weekKey <= bestStreakEndWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }

  return { currentStreak, bestStreak, sessionsThisWeek };
}
