"use client";

import {
  Card,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { useMemo, useRef } from "react";
import { devLog } from "@/lib/processing-utils";
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
  Award,
  Flame,
} from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";

const statCardBase =
  "animate-fade flex h-full flex-col justify-between rounded-xl border shadow-none opacity-0";

const ACCENTS = {
  primary: {
    card: "border-l-primary bg-primary/5",
    iconBg: "bg-primary/10",
    icon: "text-primary",
  },
  amber: {
    card: "border-l-amber-500 bg-amber-500/5",
    iconBg: "bg-amber-500/10",
    icon: "text-amber-500",
  },
  emerald: {
    card: "border-l-emerald-500 bg-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    icon: "text-emerald-500",
  },
  violet: {
    card: "border-l-violet-500 bg-violet-500/5",
    iconBg: "bg-violet-500/10",
    icon: "text-violet-500",
  },
  orange: {
    card: "border-l-orange-500 bg-orange-500/5",
    iconBg: "bg-orange-500/10",
    icon: "text-orange-500",
  },
};

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

/**
 * Reusable stat card with icon, description, title, and footer.
 * @param {Object} props
 * @param {"primary"|"amber"|"emerald"|"violet"|"orange"} props.accent - Accent preset key
 * @param {React.Component} props.icon - Lucide icon component
 * @param {string} props.description - CardDescription text
 * @param {React.ReactNode} props.title - CardTitle content
 * @param {React.ReactNode} props.footer - CardFooter content
 * @param {React.ReactNode} [props.action] - Optional CardAction (e.g. percentage badge)
 * @param {number} props.animationDelay - Delay in ms for animation
 */
function StatCard({ accent, icon: Icon, description, title, footer, action, animationDelay }) {
  const { card, iconBg, icon } = ACCENTS[accent] ?? ACCENTS.primary;
  return (
    <Card
      className={`${statCardBase} relative border-l-4 ${card} [animation-delay:${animationDelay}ms]`}
    >
      {action}
      <CardHeader className="flex flex-row items-start gap-3 p-4">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <CardDescription>{description}</CardDescription>
          <CardTitle className="mt-1 min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 pt-0 text-sm">
        {footer}
      </CardFooter>
    </Card>
  );
}

// Show a section row of key metrics with accent colors and icons
export function SectionTopCards({ isProgressDone = false }) {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();

  // Global-ish unit preference shared with calculator & strength-level pages.
  // Defaults to imperial (lb) when not set.
  const [isMetricPreference] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CALC_IS_METRIC,
    false,
    { initializeWithValue: false },
  );
  const preferredUnit = isMetricPreference ? "kg" : "lb";

  // Find the most recent PR single from top 5 most frequent lifts
  const mostRecentPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);

  // Calculate lifetime tonnage (all-time total weight moved) in preferred units.
  const lifetimeTonnage = useMemo(
    () => calculateLifetimeTonnage(parsedData, preferredUnit),
    [parsedData, preferredUnit],
  );

  // Calculate session momentum
  const { recentSessions, previousSessions, percentageChange } = useMemo(
    () => calculateSessionMomentum(parsedData),
    [parsedData],
  );

  const { currentStreak, bestStreak, sessionsThisWeek } = useMemo(
    () => calculateStreak(parsedData),
    [parsedData],
  );
  const sessionsNeededThisWeek = Math.max(0, 3 - (sessionsThisWeek ?? 0));

  const streakEncouragementRef = useRef(null);
  if (streakEncouragementRef.current === null) {
    streakEncouragementRef.current =
      STREAK_ENCOURAGMENTS[
        Math.floor(Math.random() * STREAK_ENCOURAGMENTS.length)
      ];
  }
  const encouragementMessage = streakEncouragementRef.current;

  return (
    <div className="col-span-full grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
              <div className="line-clamp-1 text-muted-foreground">
                {calculateTotalStats(liftTypes).totalReps.toLocaleString()} reps and{" "}
                {calculateTotalStats(liftTypes).totalSets.toLocaleString()} sets lifted
              </div>
            }
            animationDelay={0}
          />

          <StatCard
            accent="amber"
            icon={Trophy}
            description="Most Recent PR Single"
            title={
              mostRecentPR
                ? `${mostRecentPR.liftType} 1@${mostRecentPR.weight}${mostRecentPR.unitType}`
                : "No PRs yet"
            }
            footer={
              <div className="text-muted-foreground">
                {mostRecentPR
                  ? `Performed on ${format(new Date(mostRecentPR.date), "d MMMM yyyy")}`
                  : ""}
              </div>
            }
            animationDelay={250}
          />

          <StatCard
            accent="emerald"
            icon={Activity}
            description="Session Momentum"
            title={`${recentSessions} sessions`}
            action={
              percentageChange !== 0 ? (
                <CardAction>
                  <span
                    className={`flex items-center text-sm font-normal ${
                      percentageChange > 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {percentageChange > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    {Math.abs(percentageChange)}%
                  </span>
                </CardAction>
              ) : null
            }
            footer={
              <>
                <div className="text-muted-foreground">in the last 90 days</div>
                <div className="text-muted-foreground">
                  ({previousSessions} sessions in previous 90 days)
                </div>
              </>
            }
            animationDelay={500}
          />

          <StatCard
            accent="violet"
            icon={Award}
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
                <>
                  <div className="text-muted-foreground">
                    Across {lifetimeTonnage.sessionCount.toLocaleString()} logged
                    {" "}
                    sessions
                  </div>
                  <div className="text-muted-foreground">
                    Avg per session:{" "}
                    {formatLifetimeTonnage(
                      lifetimeTonnage.averagePerSession,
                    )}{" "}
                    {lifetimeTonnage.primaryUnit}
                  </div>
                  {lifetimeTonnage.hasTwelveMonthsOfData &&
                    lifetimeTonnage.lastYearPrimaryTotal > 0 && (
                      <div className="text-muted-foreground">
                        In the last 12 months:{" "}
                        {formatLifetimeTonnage(
                          lifetimeTonnage.lastYearPrimaryTotal,
                        )}{" "}
                        {lifetimeTonnage.primaryUnit}
                      </div>
                    )}
                </>
              ) : (
                <div className="text-muted-foreground">
                  Once you start logging training, we'll track your lifetime
                  tonnage here.
                </div>
              )
            }
            animationDelay={750}
          />

          <StatCard
            accent="orange"
            icon={Flame}
            description="Weekly consistency"
            title={`${currentStreak} week${currentStreak === 1 ? "" : "s"} in a row`}
            footer={
              <>
                <div className="text-muted-foreground">
                  {currentStreak > 0
                    ? `You're on a ${currentStreak}-week streak of 3+ sessions. Your best run: ${bestStreak} week${bestStreak === 1 ? "" : "s"}.`
                    : `Aim for 3+ sessions per week. Your best so far: ${bestStreak} week${bestStreak === 1 ? "" : "s"} in a row.`}
                </div>
                {sessionsNeededThisWeek > 0 && (
                  <div className="text-muted-foreground">
                    {sessionsNeededThisWeek === 1
                      ? "One more session by Sunday night and you keep the streak going."
                      : `${sessionsNeededThisWeek} more sessions by Sunday night and you're still on track.`
                    }
                  </div>
                )}
                {sessionsNeededThisWeek === 0 && (sessionsThisWeek ?? 0) >= 3 && (
                  <div className="text-muted-foreground">
                    This week: {sessionsThisWeek} sessions. {encouragementMessage}
                  </div>
                )}
              </>
            }
            animationDelay={1000}
          />
        </>
      )}
    </div>
  );
}

function SectionTopCardsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div
      key={`section-top-card-skeleton-${index}`}
      className="flex min-h-[260px] flex-col justify-between rounded-xl border border-border/60 bg-card/30 p-4 md:min-h-[280px]"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
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
    if (years >= 10) {
      return `Over ${years} years of strength mastery`;
    } else if (years >= 5) {
      return `${years} years of strength excellence`;
    } else if (years >= 1) {
      return `${years} year${years > 1 ? "s" : ""} of strength commitment`;
    }
  }

  if (months > 0) {
    if (months >= 6) {
      return `${months} months of strength progress`;
    } else {
      return `${months} month${months > 1 ? "s" : ""} of lifting`;
    }
  }

  return `${days} day${days !== 1 ? "s" : ""} of lifting`;
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
 * Calculates lifetime tonnage (sum of weight × reps) across all non-goal lifts.
 * Returns totals per unit plus a primary unit/total for display.
 */
function calculateLifetimeTonnage(parsedData, preferredUnit = "lb") {
  const startTime = performance.now();

  if (!parsedData || parsedData.length === 0) {
    devLog("calculateLifetimeTonnage execution time: 0ms");
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
  const sessionDates = new Set();
  const todayStr = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgoStr = subtractDaysFromStr(todayStr, 365);
  const lastYearByUnit = {};
  let earliestDateStr = null;
  let latestDateStr = null;

  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (!entry || entry.isGoal) continue;

    const { date, weight, reps, unitType } = entry;
    if (!date) continue;

    sessionDates.add(date);

    if (!earliestDateStr || date < earliestDateStr) {
      earliestDateStr = date;
    }
    if (!latestDateStr || date > latestDateStr) {
      latestDateStr = date;
    }

    const repsSafe = typeof reps === "number" ? reps : 0;
    const weightSafe = typeof weight === "number" ? weight : 0;
    const tonnage = repsSafe * weightSafe;
    if (!tonnage) continue;

    const unit = unitType || "lb";
    totalByUnit[unit] = (totalByUnit[unit] ?? 0) + tonnage;

    if (date >= twelveMonthsAgoStr && date <= todayStr) {
      lastYearByUnit[unit] = (lastYearByUnit[unit] ?? 0) + tonnage;
    }
  }

  const elapsedMs = Math.round(performance.now() - startTime);
  devLog(`calculateLifetimeTonnage execution time: ${elapsedMs}ms`);

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
    sessionDates.size > 0
      ? Math.round(primaryTotal / sessionDates.size)
      : 0;

  return {
    totalByUnit,
    primaryUnit,
    primaryTotal,
    sessionCount: sessionDates.size,
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
      const pr = singleReps[0]; // First item is highest weight
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

  const todayStr = new Date().toISOString().slice(0, 10);
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
 * @param {Array} parsedData - Array of workout entries sorted chronologically
 * @returns {Object} Object containing session counts and percentage change
 */
function calculateSessionMomentum(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return { recentSessions: 0, previousSessions: 0, percentageChange: 0 };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgoStr = subtractDaysFromStr(todayStr, 90);
  const oneEightyDaysAgoStr = subtractDaysFromStr(todayStr, 180);

  let recentSessions = 0;
  let previousSessions = 0;

  for (const entry of parsedData) {
    if (entry.isGoal) continue;

    const dateStr = entry.date;
    if (!dateStr || typeof dateStr !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }

    // YYYY-MM-DD string comparison
    if (dateStr >= ninetyDaysAgoStr && dateStr <= todayStr) {
      recentSessions++;
    } else if (dateStr >= oneEightyDaysAgoStr && dateStr < ninetyDaysAgoStr) {
      previousSessions++;
    }
  }

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
 * @param {Array} parsedData - Array of workout entries sorted chronologically
 * @returns {Object} Object containing currentStreak, bestStreak (weeks), and sessionsThisWeek (unique days)
 */
function calculateStreak(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const startTime = performance.now();

  // --- Phase 1: Build "sessions per week" (unique days per week) ---
  // weekMap: for each week (Monday's date as "YYYY-MM-DD"), we store the Set of *dates* that had
  // at least one gym session that week. So if you trained Mon/Wed/Fri, that week key maps to 3 dates.
  // We do NOT count lift entries — one workout with 20 sets still counts as 1 session (one day).
  const dateToWeekKey = new Map(); // cache: dateStr -> Monday of that week (so we compute once per unique day)
  const weekMap = new Map(); // weekKey (Monday YYYY-MM-DD) -> Set of date strings (unique session days in that week)

  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (entry.isGoal) continue;
    const dateStr = entry.date;
    if (!dateStr || typeof dateStr !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisWeekKey = getWeekKeyFromDateStr(todayStr);
  const sessionsThisWeek = weekSessionCount.get(thisWeekKey) || 0;

  // --- Phase 3: Current streak (consecutive weeks with 3+ sessions, INCLUDING this week if it's already at 3+) ---
  // We walk week-by-week starting from the current week backwards. A week with fewer than 3 sessions breaks the streak.
  let currentStreak = 0;
  let weekKey = thisWeekKey;
  while (weekKey >= oldestWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      currentStreak++;
    } else {
      break;
    }
    weekKey = subtractDaysFromStr(weekKey, 7);
  }

  // --- Phase 4: Best streak (longest run of consecutive weeks with 3+ sessions, over full history INCLUDING this week) ---
  let bestStreak = 0;
  let tempStreak = 0;
  weekKey = oldestWeek;
  while (weekKey <= thisWeekKey) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }

  devLog(
    "calculateStreak execution time: " +
      `${Math.round(performance.now() - startTime)}ms`,
  );

  return { currentStreak, bestStreak, sessionsThisWeek };
}
