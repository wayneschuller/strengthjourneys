
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import confetti from "canvas-confetti";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BIG_FOUR_LIFT_TYPES,
} from "@/lib/processing-utils";
import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { MiniFeedbackWidget } from "@/components/feedback";

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Card that challenges the user to beat their previous calendar month across
 * sessions, Big Four tonnage, and Big Four strength level consistency.
 * Reads data from UserLiftingDataProvider; takes no props.
 */
export function ThisMonthInIronCard() {
  const { parsedData } = useUserLiftingData();
  const bio = useAthleteBio();
  const { isMetric } = bio;
  const { status: authStatus } = useSession();

  const boundaries = useMemo(() => getMonthBoundaries(), []);

  const [topTierVerdict, setTopTierVerdict] = useState(TOP_TIER_VERDICTS[0]);
  useEffect(() => {
    setTopTierVerdict(
      TOP_TIER_VERDICTS[Math.floor(Math.random() * TOP_TIER_VERDICTS.length)],
    );
  }, []);

  const [motivationalPhrase, setMotivationalPhrase] = useState(
    MOTIVATIONAL_PHRASES[0],
  );
  useEffect(() => {
    setMotivationalPhrase(
      MOTIVATIONAL_PHRASES[
        Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)
      ],
    );
  }, []);

  const stats = useMemo(() => {
    if (!parsedData) return null;
    return computeMonthlyBattleStats(parsedData, boundaries);
  }, [parsedData, boundaries]);

  const strengthLevelStats = useMemo(() => {
    if (!parsedData || !bio) return null;
    return computeStrengthLevelStats(parsedData, boundaries, bio);
  }, [parsedData, bio, boundaries]);

  const strengthLevelPassed = useMemo(
    () => getStrengthLevelPassed(strengthLevelStats),
    [strengthLevelStats],
  );

  const verdict = useMemo(() => {
    if (!stats) return null;
    return getVerdict(stats, strengthLevelPassed);
  }, [stats, strengthLevelPassed]);

  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");

  const sessionsPaceStatus = stats
    ? getPaceStatus(stats.sessions.current, stats.sessions.last, stats.progressRatio)
    : null;
  const bigFourPaceStatus = stats
    ? getPaceStatus(stats.bigFourTonnage.current, stats.bigFourTonnage.last, stats.progressRatio)
    : null;

  const strengthSetupRequired = !!bio?.bioDataIsDefault;
  const checksSummary = useMemo(
    () => getMonthlyChecksSummary(stats, strengthLevelStats),
    [stats, strengthLevelStats],
  );
  const confettiFiredRef = useRef(false);
  const cardRef = useRef(null);
  const highlightStartTimerRef = useRef(null);
  const highlightStepTimerRef = useRef(null);
  const highlightQueuedRef = useRef(false);
  const [revealedRows, setRevealedRows] = useState(0);
  const isCardInView = useInView(cardRef, { once: true, amount: 0.35 });
  const totalRevealRows = useMemo(
    () => getMonthlyRevealRowCount(stats, strengthLevelStats),
    [stats, strengthLevelStats],
  );
  const highlightsComplete = totalRevealRows > 0 && revealedRows >= totalRevealRows;
  const verdictHeadline = useMemo(
    () =>
      getVerdictHeadline({
        verdict,
        checksSummary,
        sessionsPaceStatus,
        bigFourPaceStatus,
        topTierPhrase: topTierVerdict,
      }),
    [verdict, checksSummary, sessionsPaceStatus, bigFourPaceStatus, topTierVerdict],
  );

  useEffect(() => {
    if (!isCardInView || !stats || totalRevealRows === 0) {
      setRevealedRows(0);
      highlightQueuedRef.current = false;
      if (highlightStartTimerRef.current) {
        clearTimeout(highlightStartTimerRef.current);
        highlightStartTimerRef.current = null;
      }
      if (highlightStepTimerRef.current) {
        clearInterval(highlightStepTimerRef.current);
        highlightStepTimerRef.current = null;
      }
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setRevealedRows(totalRevealRows);
      highlightQueuedRef.current = false;
      return;
    }

    if (revealedRows >= totalRevealRows || highlightQueuedRef.current) return;

    setRevealedRows(0);
    highlightQueuedRef.current = true;
    highlightStartTimerRef.current = setTimeout(() => {
      setRevealedRows(1);
      highlightStartTimerRef.current = null;
      highlightStepTimerRef.current = setInterval(() => {
        setRevealedRows((prev) => {
          const next = Math.min(totalRevealRows, prev + 1);
          if (next >= totalRevealRows && highlightStepTimerRef.current) {
            clearInterval(highlightStepTimerRef.current);
            highlightStepTimerRef.current = null;
            highlightQueuedRef.current = false;
          }
          return next;
        });
      }, HIGHLIGHT_ROW_STAGGER_MS);
    }, HIGHLIGHT_REVEAL_DELAY_MS);
  }, [isCardInView, stats, totalRevealRows, revealedRows]);

  useEffect(() => () => {
    if (highlightStartTimerRef.current) {
      clearTimeout(highlightStartTimerRef.current);
      highlightStartTimerRef.current = null;
    }
    if (highlightStepTimerRef.current) {
      clearInterval(highlightStepTimerRef.current);
      highlightStepTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldCelebrate =
      checksSummary?.checksTotal === 9 && checksSummary.checksMet >= 7;

    if (!shouldCelebrate) {
      confettiFiredRef.current = false;
      return;
    }

    if (confettiFiredRef.current) return;
    if (typeof window === "undefined") return;
    if (!highlightsComplete) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    confettiFiredRef.current = true;
    const timer = setTimeout(
      () => fireMonthWinConfetti(cardRef),
      CONFETTI_AFTER_HIGHLIGHT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [checksSummary, highlightsComplete]);

  return (
    <Card ref={cardRef} className="flex h-full flex-1 flex-col">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo Mode: "}
          This Month in Iron
        </CardTitle>
        <CardDescription>{motivationalPhrase}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4">
        {!stats && <Skeleton className="h-[30vh]" />}

        {stats && (
          <>
            <BigFourCriteriaTable
              sessions={stats.sessions}
              bigFourByLift={stats.bigFourByLift}
              strengthLevelStats={strengthLevelStats}
              strengthSetupRequired={strengthSetupRequired}
              boundaries={boundaries}
              unit={unit}
              revealedRows={revealedRows}
            />

            <Separator />
            <motion.div
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <p className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
                <span
                  className={
                    !highlightsComplete || verdictHeadline?.tone === "neutral"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {verdictHeadline?.text || "Keep forging ⚒️"}
                </span>
                {highlightsComplete && verdictHeadline?.scoreText && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground align-middle">
                    {verdictHeadline.scoreText}
                  </span>
                )}
              </p>
            </motion.div>
          </>
        )}
      </CardContent>
      {stats && (
        <CardFooter className="pt-0">
          <MiniFeedbackWidget
            contextId="this_month_in_iron_card"
            page="/analyzer"
            analyticsExtra={{ context: "this_month_in_iron_card" }}
          />
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Motivational phrases ──────────────────────────────────────────────────

const TOP_TIER_VERDICTS = [
  "Won the Month ✅",
  "Win Secured 🔒",
  "Win Complete ✅",
  "Clean Win 💪",
  "Iron Win 🏆",
  "Win Confirmed ✅",
  "Total Win 🏆",
  "Owned the Month 👑",
  "Month Dominated 👑",
  "Won and Done ✅",
];

const MOTIVATIONAL_PHRASES = [
  "Win the month, win the year",
  "Win the month, win the game",
  "One month at a time",
  "Own the month",
  "Better than last month",
  "Outwork last month",
  "Beat last month",
  "Make last month jealous",
  "One month stronger",
  "This month or never",
];

const BIG_FOUR_LIFT_URLS = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const HIGHLIGHT_REVEAL_DELAY_MS = 650;
const HIGHLIGHT_ROW_STAGGER_MS = 170;
const CONFETTI_AFTER_HIGHLIGHT_DELAY_MS = 200;

// ─── Strength level constants ──────────────────────────────────────────────

const LEVEL_SCORES = {
  "Physically Active": 0,
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Elite: 4,
};

const LEVEL_LABELS = [
  "Physically Active",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Elite",
];

const LEVEL_EMOJIS = ["🏃", "🌱", "💪", "🔥", "👑"];
const TONNAGE_CLOSE_ENOUGH_RATIO = 0.9; // Tonnage/session checks: within 10% of last month still counts as a win.
function formatStrengthLevel(score) {
  if (score === null || score === undefined) return null;
  const tier = Math.min(4, Math.floor(score));
  const label = LEVEL_LABELS[tier];
  const emoji = LEVEL_EMOJIS[tier];
  return { label, emoji, score: tier };
}

function isStrengthLevelRegressed(current, last) {
  return last !== null && (current === null || current < last);
}

function passesTonnageThreshold(current, last) {
  return current >= last * TONNAGE_CLOSE_ENOUGH_RATIO;
}

function AnimatedInteger({ value, className = "" }) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 180, damping: 22 });
  const displayVal = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(value ?? 0);
  }, [value, motionVal]);

  return <motion.span className={className}>{displayVal}</motion.span>;
}

// ─── Month boundary helpers ────────────────────────────────────────────────

function getMonthBoundaries() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${y}-${pad(m + 1)}-${pad(d)}`;
  const currentMonthStart = `${y}-${pad(m + 1)}-01`;

  const prevDate = new Date(y, m - 1, 1);
  const py = prevDate.getFullYear();
  const pm = prevDate.getMonth();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const daysInCurrentMonth = new Date(y, m + 1, 0).getDate();

  const sameDayInPrev = Math.min(d, daysInPrevMonth);

  return {
    todayStr,
    currentMonthStart,
    prevMonthStart: `${py}-${pad(pm + 1)}-01`,
    prevMonthEnd: `${py}-${pad(pm + 1)}-${pad(daysInPrevMonth)}`,
    prevMonthSameDayStr: `${py}-${pad(pm + 1)}-${pad(sameDayInPrev)}`,
    dayOfMonth: d,
    daysInCurrentMonth,
    daysRemainingInCurrentMonth: Math.max(0, daysInCurrentMonth - d),
    daysInPrevMonth,
    currentMonthName: today.toLocaleString("default", { month: "long" }),
    prevMonthName: prevDate.toLocaleString("default", { month: "long" }),
  };
}

// ─── Monthly stats calculation ─────────────────────────────────────────────

function computeMonthlyBattleStats(parsedData, boundaries) {
  const nativeUnit = parsedData.find((e) => !e.isGoal)?.unitType ?? "lb";
  const initBigFourByLift = () =>
    Object.fromEntries(
      BIG_FOUR_LIFT_TYPES.map((liftType) => [
        liftType,
        { current: 0, last: 0, lastSameDay: 0 },
      ]),
    );

  let currentTonnage = 0;
  let lastTonnage = 0;
  let lastTonnageSameDay = 0;
  const currentDates = new Set();
  const lastDates = new Set();
  const lastDatesSameDay = new Set();
  let currentBigFour = 0;
  let lastBigFour = 0;
  let lastBigFourSameDay = 0;
  const bigFourByLift = initBigFourByLift();

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    if ((entry.reps ?? 0) < 1) continue;
    if (entry.unitType !== nativeUnit) continue;

    const tonnage = (entry.weight ?? 0) * (entry.reps ?? 0);
    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;

    if (inCurrent) {
      currentTonnage += tonnage;
      currentDates.add(date);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        currentBigFour += tonnage;
        bigFourByLift[liftType].current += tonnage;
      }
    } else if (inLast) {
      lastTonnage += tonnage;
      lastDates.add(date);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        lastBigFour += tonnage;
        bigFourByLift[liftType].last += tonnage;
      }
      if (date <= boundaries.prevMonthSameDayStr) {
        lastTonnageSameDay += tonnage;
        lastDatesSameDay.add(date);
        if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
          lastBigFourSameDay += tonnage;
          bigFourByLift[liftType].lastSameDay += tonnage;
        }
      }
    }
  }

  return {
    tonnage: { current: currentTonnage, last: lastTonnage, lastSameDay: lastTonnageSameDay },
    sessions: { current: currentDates.size, last: lastDates.size, lastSameDay: lastDatesSameDay.size },
    bigFourTonnage: { current: currentBigFour, last: lastBigFour, lastSameDay: lastBigFourSameDay },
    bigFourByLift,
    progressRatio: boundaries.dayOfMonth / boundaries.daysInPrevMonth,
    nativeUnit,
  };
}

// ─── Strength level stats (per Big Four lift, best category hit) ───────────

function computeStrengthLevelStats(parsedData, boundaries, bio) {
  if (bio.bioDataIsDefault) return null;

  const result = Object.fromEntries(
    BIG_FOUR_LIFT_TYPES.map((liftType) => [
      liftType,
      { current: null, last: null },
    ]),
  );

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    const reps = entry.reps ?? 0;
    if (reps < 1) continue;
    if (!BIG_FOUR_LIFT_TYPES.includes(entry.liftType)) continue;

    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;

    if (!inCurrent && !inLast) continue;

    const e1rm = estimateE1RM(reps, entry.weight ?? 0);
    const standard = getStandardForLiftDate(
      bio.age,
      date,
      bio.bodyWeight,
      bio.sex,
      liftType,
      bio.isMetric,
    );
    const rating = getStrengthRatingForE1RM(e1rm, standard);
    const score = LEVEL_SCORES[rating] ?? 0;
    const monthKey = inCurrent ? "current" : "last";
    const prevScore = result[liftType][monthKey];
    if (prevScore === null || score > prevScore) {
      result[liftType][monthKey] = score;
    }
  }

  return result;
}

function getStrengthLevelPassed(strengthLevelStats) {
  if (!strengthLevelStats) return { passed: true, skipped: true };
  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    const { current, last } = strengthLevelStats[liftType];
    if (last === null) continue; // not trained last month — no regression possible
    if (isStrengthLevelRegressed(current, last)) {
      return { passed: false, skipped: false };
    }
  }
  return { passed: true, skipped: false };
}

// ─── Pace status ───────────────────────────────────────────────────────────

function getPaceStatus(current, last, progressRatio) {
  if (last === 0) return { status: "no-data", fillPct: 0, needed: 0, projected: 0 };
  const fillPct = Math.min(100, (current / last) * 100);
  const paceTarget = last * progressRatio;
  const pacePct = paceTarget > 0 ? current / paceTarget : 1;
  const status =
    pacePct >= 1.0 ? "ahead" : pacePct >= 0.85 ? "on-pace" : "behind";
  const projected = progressRatio > 0 ? current / progressRatio : current;
  return { status, fillPct, needed: Math.max(0, Math.round(last - current)), projected };
}

// ─── Verdict ───────────────────────────────────────────────────────────────

function getVerdict(stats, strengthLevelPassed) {
  const { sessions, bigFourTonnage, tonnage, bigFourByLift } = stats;

  if (
    sessions.last === 0 &&
    bigFourTonnage.last === 0 &&
    tonnage.last === 0
  ) {
    return { label: "Writing History", emoji: "📖", won: false };
  }

  const primaryMet =
    passesTonnageThreshold(sessions.current, sessions.lastSameDay) &&
    BIG_FOUR_LIFT_TYPES.every((liftType) => {
      const lift = bigFourByLift?.[liftType];
      return passesTonnageThreshold(lift?.current ?? 0, lift?.last ?? 0);
    });
  const strengthOK =
    strengthLevelPassed.skipped || strengthLevelPassed.passed;

  if (primaryMet && strengthOK) {
    return { label: "Month Crushed", emoji: "💥", won: true };
  }
  if (primaryMet) {
    // Sessions + tonnage all pass; strength has a regression caveat
    return { label: "Month Won", emoji: "✅", won: true };
  }
  return { label: "Still Forging", emoji: "⚒️", won: false };
}

function getVerdictHeadline({
  verdict,
  checksSummary,
  sessionsPaceStatus,
  bigFourPaceStatus,
  topTierPhrase,
}) {
  const checksText = checksSummary
    ? `${checksSummary.checksMet}/${checksSummary.checksTotal}`
    : null;

  if (checksSummary?.checksTotal === 9 && checksSummary.checksMet >= 7) {
    return {
      tone: "win",
      text: topTierPhrase || "Month Won ✅",
      scoreText: checksText ? `${checksText} green` : null,
    };
  }

  if (verdict?.won) {
    return {
      tone: "win",
      text: verdict.label === "Month Crushed"
        ? (topTierPhrase || "Month Won ✅")
        : "Month Won ✅",
      scoreText: checksText ? `${checksText} green` : null,
    };
  }

  const onPace = (s) => s?.status === "ahead" || s?.status === "on-pace";
  if (onPace(sessionsPaceStatus) && onPace(bigFourPaceStatus)) {
    return {
      tone: "progress",
      text: checksText
        ? `⚒️ ${checksText} checks green — on track to win the month`
        : "⚒️ On track to win the month",
      scoreText: null,
    };
  }

  return {
    tone: "neutral",
    text: checksText
      ? `⚒️ ${checksText} checks green — keep forging`
      : "⚒️ Keep forging",
    scoreText: null,
  };
}

function getConfettiOriginFromRef(ref) {
  if (!ref?.current || typeof window === "undefined") {
    return { x: 0.5, y: 0.5 };
  }

  const rect = ref.current.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

function fireMonthWinConfetti(cardRef) {
  const defaults = {
    spread: 70,
    startVelocity: 42,
    ticks: 180,
    zIndex: 2000,
  };
  const origin = getConfettiOriginFromRef(cardRef);

  confetti({
    ...defaults,
    particleCount: 160,
    origin,
  });
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatTonnage(value, unit) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ${unit}`;
  }
  return `${Math.round(value)} ${unit}`;
}

function formatLiftTypeLabel(liftType) {
  return liftType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCurrentSessionsReporting(count, boundaries) {
  const daysRemaining = boundaries?.daysRemainingInCurrentMonth ?? 0;
  if (daysRemaining <= 10) {
    const dayLabel = daysRemaining === 1 ? "day" : "days";
    return `${count} with ${daysRemaining} ${dayLabel} left`;
  }
  return `${count} so far`;
}

function getMonthlyChecksSummary(stats, strengthLevelStats) {
  if (!stats) return null;

  let checksMet = 0;
  let checksTotal = 1; // sessions

  if (passesTonnageThreshold(stats.sessions.current, stats.sessions.lastSameDay)) {
    checksMet += 1;
  }

  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    checksTotal += 1; // tonnage
    const lift = stats.bigFourByLift?.[liftType];
    if (passesTonnageThreshold(lift?.current ?? 0, lift?.last ?? 0)) checksMet += 1;
  }

  if (strengthLevelStats) {
    for (const liftType of BIG_FOUR_LIFT_TYPES) {
      checksTotal += 1; // strength
      const { current, last } = strengthLevelStats[liftType] ?? {
        current: null,
        last: null,
      };
      const passed = last === null || !isStrengthLevelRegressed(current, last);
      if (passed) checksMet += 1;
    }
  }

  return { checksMet, checksTotal };
}

function getMonthlyRevealRowCount(stats, strengthLevelStats) {
  if (!stats) return 0;

  const liftRows = BIG_FOUR_LIFT_TYPES.map((liftType) => {
    const tonnage = stats.bigFourByLift?.[liftType] ?? {
      current: 0,
      last: 0,
    };
    const strength = strengthLevelStats?.[liftType] ?? { current: null, last: null };
    const hasTonnage = (tonnage.current ?? 0) > 0 || (tonnage.last ?? 0) > 0;
    const hasStrength = strength.current !== null || strength.last !== null;
    return hasTonnage || hasStrength;
  }).filter(Boolean).length;

  const hasSessionsRow = !!stats.sessions;
  return liftRows + (hasSessionsRow ? 1 : 0);
}

function getStrengthStatusTooltip({
  liftType,
  strengthLocked,
  strengthBaseline,
  strengthNewWin,
  strengthRegressed,
  strengthCurrent,
  strengthLast,
}) {
  const liftLabel = formatLiftTypeLabel(liftType);

  if (strengthLocked) {
    return `${liftLabel} strength-level comparisons require age, sex, and bodyweight.`;
  }
  if (strengthBaseline && !strengthNewWin) {
    return `No previous ${liftLabel} strength-level baseline or current data yet.`;
  }
  if (strengthNewWin) {
    return `No previous ${liftLabel} strength-level baseline, so current data this month counts as a win.`;
  }
  if (strengthRegressed) {
    return `${liftLabel} has not yet matched your best strength category from last month.`;
  }
  if (strengthCurrent > strengthLast) {
    return `Exceeded your best ${liftLabel} strength level from last month.`;
  }
  return `Matched your best ${liftLabel} strength level from last month.`;
}

function getTonnageStatusTooltip({
  liftType,
  currentTonnage,
  lastTonnage,
  tonnageBaseline,
  tonnageNewWin,
  tonnagePassed,
}) {
  const liftLabel = formatLiftTypeLabel(liftType).toLowerCase();

  if (tonnageBaseline && !tonnageNewWin) {
    return `Matched previous month ${liftLabel} tonnage.`;
  }
  if (tonnageNewWin) {
    return `Passed previous month ${liftLabel} tonnage.`;
  }
  if (currentTonnage > lastTonnage) {
    return `Passed previous month ${liftLabel} tonnage.`;
  }
  if (tonnagePassed) {
    return `Matched previous month ${liftLabel} tonnage.`;
  }
  return `Below previous month ${liftLabel} tonnage.`;
}

function getStrengthLastColumnTooltip(boundaries, liftType) {
  return `${boundaries.prevMonthName} best ${formatLiftTypeLabel(liftType)} strength level hit across the full month.`;
}

function getTonnageLastColumnTooltip(liftType) {
  return `Previous month ${formatLiftTypeLabel(liftType).toLowerCase()} tonnage.`;
}

// ─── Status colors ─────────────────────────────────────────────────────────

const STATUS_COLORS = {
  ahead: "bg-emerald-500",
  "on-pace": "bg-amber-400",
  behind: "bg-red-500",
  "no-data": "bg-muted",
};

const STATUS_TRACK_COLORS = {
  ahead: "bg-emerald-100 dark:bg-emerald-950",
  "on-pace": "bg-amber-100 dark:bg-amber-950",
  behind: "bg-red-100 dark:bg-red-950",
  "no-data": "bg-muted/40",
};

function PaceStatusLine({ status, needed, hideNeeded, projectedLabel }) {
  if (status === "no-data") {
    return (
      <p className="text-xs text-muted-foreground">
        No data for last month yet — keep logging!
      </p>
    );
  }
  if (status === "ahead") {
    return (
      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        ▲ On pace for {projectedLabel}
      </p>
    );
  }
  if (status === "on-pace") {
    return (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        → On pace for {projectedLabel}
      </p>
    );
  }
  return (
    <p className="text-xs font-medium text-red-600 dark:text-red-400">
      {hideNeeded
        ? "▼ Behind last month"
        : `▼ Behind pace · Need ${needed.toLocaleString()} more to win`}
    </p>
  );
}

// ─── MetricRow ─────────────────────────────────────────────────────────────

function MetricRow({
  label,
  currentLabel,
  lastLabel,
  paceStatus,
  index,
  progressRatio,
  showPaceMarker = true,
  hideNeeded = false,
  paceTooltip,
  projectedLabel,
  vsTooltip,
  labelTooltip,
}) {
  const { status, fillPct } = paceStatus;
  const rowDelay = index * 0.08;
  const paceMarkerPct = Math.min(100, progressRatio * 100);

  const labelEl = labelTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm font-medium">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <p className="max-w-52 text-center text-xs">{labelTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <span className="text-sm font-medium">{label}</span>
  );

  const vsEl = vsTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{currentLabel}</span>
            {" vs "}
            {lastLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <p className="max-w-44 text-center text-xs">{vsTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{currentLabel}</span>
      {" vs "}
      {lastLabel}
    </span>
  );

  return (
    <motion.div
      className="space-y-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rowDelay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-baseline justify-between gap-2">
        {labelEl}
        {vsEl}
      </div>
      <div
        className={`relative h-2.5 w-full rounded-full ${STATUS_TRACK_COLORS[status]}`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className={`h-full rounded-full ${STATUS_COLORS[status]}`}
            initial={{ width: "0%" }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.7, delay: rowDelay + 0.1, ease: "easeOut" }}
          />
        </div>
        {showPaceMarker && status !== "no-data" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-default"
                  style={{ left: `${paceMarkerPct}%` }}
                >
                  <div className="mx-auto h-full w-0.5 bg-foreground/40" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="max-w-44 text-center text-xs">{paceTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <PaceStatusLine
        status={status}
        needed={paceStatus.needed}
        hideNeeded={hideNeeded}
        projectedLabel={projectedLabel}
      />
    </motion.div>
  );
}

// ─── Big Four Criteria Table (Strength + Tonnage per lift) ────────────────

function BigFourCriteriaTable({
  sessions,
  bigFourByLift,
  strengthLevelStats,
  strengthSetupRequired = false,
  boundaries,
  unit,
  revealedRows = 0,
}) {
  const rows = BIG_FOUR_LIFT_TYPES.map((liftType) => {
    const tonnage = bigFourByLift?.[liftType] ?? {
      current: 0,
      last: 0,
      lastSameDay: 0,
    };
    const strength = strengthLevelStats?.[liftType] ?? { current: null, last: null };
    return { liftType, tonnage, strength };
  }).filter(({ tonnage, strength }) => {
    const hasTonnage = (tonnage.current ?? 0) > 0 || (tonnage.last ?? 0) > 0;
    const hasStrength = strength.current !== null || strength.last !== null;
    return hasTonnage || hasStrength;
  });

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60">
        No Big Four lift criteria to compare yet this month or last.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_100px_1fr] items-center gap-2 border-b border-border/30 px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
        <div className="text-right">{boundaries.prevMonthName}</div>
        <div className="text-center" aria-hidden="true"></div>
        <div className="text-left">{boundaries.currentMonthName}</div>
      </div>

      {!!sessions && (() => {
        const rowHighlighted = revealedRows >= 1;
        const baseline = (sessions.lastSameDay ?? 0) === 0;
        const passed = baseline || passesTonnageThreshold(
          sessions.current ?? 0,
          sessions.lastSameDay ?? 0,
        );
        const currentSessionsReporting = formatCurrentSessionsReporting(
          sessions.current ?? 0,
          boundaries,
        );
        const rowBg = baseline
          ? "bg-muted/20"
          : passed
            ? "bg-emerald-50/30 dark:bg-emerald-950/15"
            : "bg-red-50/30 dark:bg-red-950/15";
        const rightColor = baseline
          ? "text-muted-foreground"
          : passed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";
        const revealRowBg = rowHighlighted ? rowBg : "bg-transparent";
        const revealRightColor = rowHighlighted ? rightColor : "text-foreground";

        return (
          <motion.div
            className={`grid grid-cols-[1fr_100px_1fr] items-center gap-2 rounded-md border border-border/25 px-2 py-1.5 transition-colors duration-500 ${revealRowBg}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right">
                    <AnimatedInteger
                      value={sessions.lastSameDay}
                      className={`tabular-nums text-2xl font-semibold tracking-tight transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}
                    />
                    <div className={`text-[10px] transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground/80" : "text-foreground/80"}`}>
                      of {sessions.last ?? 0} total
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    {boundaries.prevMonthName} sessions through day{" "}
                    {boundaries.dayOfMonth}, counted from unique logged training dates.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className={`text-center text-xs font-medium leading-tight transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}>
              <div>Gym</div>
              <div>Sessions</div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-left">
                    <div className="flex items-baseline gap-1">
                      <AnimatedInteger
                        value={sessions.current}
                        className={`tabular-nums text-2xl font-bold tracking-tight transition-colors duration-500 ${revealRightColor}`}
                      />
                      {rowHighlighted && passed && !baseline && (
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {currentSessionsReporting.replace(
                        `${sessions.current ?? 0} `,
                        "",
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    Compared with last month&apos;s same-day count; being within 10% still counts as on track.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        );
      })()}

      {rows.map(({ liftType, tonnage, strength }, i) => {
        const rowHighlightIndex = sessions ? i + 2 : i + 1;
        const rowHighlighted = revealedRows >= rowHighlightIndex;
        const currentTonnage = tonnage.current ?? 0;
        const lastTonnage = tonnage.last ?? 0;
        const tonnagePassed = passesTonnageThreshold(
          tonnage.current ?? 0,
          tonnage.last ?? 0,
        );
        const tonnageBaseline = lastTonnage === 0;
        const tonnageNewWin = tonnageBaseline && currentTonnage > 0;
        const tonnageColor = tonnageBaseline && !tonnageNewWin
          ? "text-muted-foreground"
          : tonnageNewWin || tonnagePassed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";

        const currentStrengthFmt = formatStrengthLevel(strength.current);
        const lastStrengthFmt = formatStrengthLevel(strength.last);
        const strengthBaseline = strength.last === null;
        const strengthNewWin = strengthBaseline && strength.current !== null;
        const strengthRegressed = isStrengthLevelRegressed(
          strength.current,
          strength.last,
        );
        const strengthLocked = strengthSetupRequired;
        const strengthPassed = strengthLocked
          ? true
          : strengthBaseline || !strengthRegressed;
        const strengthColor = strengthLocked
          ? "text-muted-foreground"
          : strengthBaseline && !strengthNewWin
          ? "text-muted-foreground"
          : strengthNewWin || strengthPassed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";
        const strengthBg =
          strengthLocked || (strengthBaseline && !strengthNewWin)
            ? "bg-muted/20"
            : strengthPassed
          ? "bg-emerald-50/30 dark:bg-emerald-950/15"
          : "bg-red-50/30 dark:bg-red-950/15";
        const tonnageBg =
          tonnageBaseline && !tonnageNewWin
            ? "bg-muted/20"
            : tonnagePassed
          ? "bg-emerald-50/30 dark:bg-emerald-950/15"
          : "bg-red-50/30 dark:bg-red-950/15";
        const revealStrengthBg = rowHighlighted ? strengthBg : "bg-transparent";
        const revealTonnageBg = rowHighlighted ? tonnageBg : "bg-transparent";
        const revealStrengthColor = rowHighlighted ? strengthColor : "text-foreground";
        const revealTonnageColor = rowHighlighted ? tonnageColor : "text-foreground";

        const strengthStatusTooltip = getStrengthStatusTooltip({
          liftType,
          strengthLocked,
          strengthBaseline,
          strengthNewWin,
          strengthRegressed,
          strengthCurrent: strength.current,
          strengthLast: strength.last,
        });
        const lastStrengthTooltip = getStrengthLastColumnTooltip(
          boundaries,
          liftType,
        );
        const tonnageStatusTooltip = getTonnageStatusTooltip({
          liftType,
          currentTonnage,
          lastTonnage,
          tonnageBaseline,
          tonnageNewWin,
          tonnagePassed,
        });
        const tonnageLastTooltip = getTonnageLastColumnTooltip(liftType);
        const liftInsightHref = BIG_FOUR_LIFT_URLS[liftType];

        return (
          <motion.div
            key={liftType}
            className="grid grid-cols-[1fr_100px_1fr] grid-rows-2 items-center gap-x-2 gap-y-1 rounded-md border border-border/25 px-2 py-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover="hover"
            transition={{
              duration: 0.35,
              delay: 0.08 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className={`rounded px-1.5 py-1 text-right transition-colors duration-500 ${revealStrengthBg}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs">
                      {strengthLocked ? (
                        <span className={rowHighlighted ? "text-muted-foreground/70" : "text-foreground"}>Locked</span>
                      ) : lastStrengthFmt ? (
                        <span className={rowHighlighted ? "text-muted-foreground" : "text-foreground"}>
                          {lastStrengthFmt.emoji} {lastStrengthFmt.label}
                        </span>
                      ) : (
                        <span className={rowHighlighted ? "text-muted-foreground/40" : "text-foreground"}>—</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="max-w-52 text-center text-xs">
                      {strengthLocked
                        ? "Add age, sex, and bodyweight in your profile to compare strength levels."
                        : lastStrengthTooltip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Link
              href={liftInsightHref}
              className="row-span-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <motion.div
                className="flex flex-col items-center justify-center gap-1"
                variants={{
                  hover: { scale: 1.06, y: -1 },
                }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <LiftSvg liftType={liftType} size="sm" animate={false} />
                <span className={`text-[10px] transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground/80" : "text-foreground/80"}`}>
                  {formatLiftTypeLabel(liftType)}
                </span>
              </motion.div>
            </Link>

            <div className={`rounded px-1.5 py-1 text-left transition-colors duration-500 ${revealStrengthBg}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1 text-xs font-medium transition-colors duration-500 ${revealStrengthColor}`}>
                      {strengthLocked ? (
                        <span>Setup required</span>
                      ) : currentStrengthFmt ? (
                        <span>
                          {currentStrengthFmt.emoji} {currentStrengthFmt.label}
                        </span>
                      ) : (
                        <span>{strength.last !== null ? "Not trained" : "—"}</span>
                      )}
                      {rowHighlighted && !strengthLocked && strengthPassed && (strengthNewWin || !strengthBaseline) && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="max-w-52 text-center text-xs">
                      {strengthStatusTooltip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`rounded px-1.5 py-1 text-right transition-colors duration-500 ${revealTonnageBg}`}>
                    <div className={`text-xs transition-colors duration-500 ${revealTonnageColor}`}>
                      <span className={rowHighlighted ? "text-muted-foreground" : "text-foreground"}>
                        {formatTonnage(tonnage.last ?? 0, unit)} lifted
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    {tonnageLastTooltip}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`rounded px-1.5 py-1 text-left transition-colors duration-500 ${revealTonnageBg}`}>
                    <div className={`flex items-center gap-1 text-xs font-semibold transition-colors duration-500 ${revealTonnageColor}`}>
                      <span>{formatTonnage(tonnage.current ?? 0, unit)} lifted</span>
                      {rowHighlighted && (tonnagePassed || tonnageNewWin) && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    {tonnageStatusTooltip}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        );
      })}

      <div className="space-y-1 pt-1">
        <AthleteBioInlineSettings
          forceStackedControls
          autoOpenWhenDefault
          defaultBioPrompt="Enter your details to unlock this feature."
        />
      </div>
    </div>
  );
}
