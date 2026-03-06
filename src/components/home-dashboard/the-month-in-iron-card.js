
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Button } from "@/components/ui/button";
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
  getDisplayWeight,
} from "@/lib/processing-utils";
import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { MiniFeedbackWidget } from "@/components/feedback";

const BIG_FOUR_INSIGHT_HREFS = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Card that challenges the user to beat their previous calendar month across
 * sessions, Big Four tonnage, and Big Four strength level consistency.
 * Reads data from UserLiftingDataProvider; takes no props.
 */
export function TheMonthInIronCard({
  dashboardStage = "established",
  dataMaturityStage: stageFromParent = null,
  sessionCount: sessionCountFromParent = null,
}) {
  const { isDemoMode, parsedData, sheetInfo } = useUserLiftingData();
  const bio = useAthleteBio();
  const { isMetric } = bio;
  const { status: authStatus } = useSession();
  const sessionCount = useMemo(() => {
    if (typeof sessionCountFromParent === "number") return sessionCountFromParent;
    if (!Array.isArray(parsedData)) return 0;
    const dates = new Set();
    parsedData.forEach((entry) => {
      if (!entry?.isGoal && entry?.date) dates.add(entry.date);
    });
    return dates.size;
  }, [parsedData, sessionCountFromParent]);
  const dataMaturityStage = useMemo(() => {
    if (stageFromParent) return stageFromParent;
    if (sessionCount === 0) return "no_sessions";
    if (sessionCount <= 7) return "first_week";
    if (sessionCount <= 20) return "first_month";
    return "mature";
  }, [stageFromParent, sessionCount]);

  const [monthOffset, setMonthOffset] = useState(0);
  const maxMonthOffset = useMemo(
    () => getMaxMonthOffsetFromData(parsedData),
    [parsedData],
  );
  const safeMonthOffset = Math.min(monthOffset, maxMonthOffset);
  const boundaries = useMemo(
    () => getMonthBoundaries(safeMonthOffset),
    [safeMonthOffset],
  );
  const monthCardTitle = useMemo(
    () => getMonthlyCardTitle(boundaries),
    [boundaries],
  );
  const monthPhraseKey = boundaries.currentMonthStart;
  const topTierVerdict = useMemo(
    () => pickPhraseForMonth(TOP_TIER_VERDICTS, monthPhraseKey),
    [monthPhraseKey],
  );
  const motivationalPhrase = useMemo(
    () => pickPhraseForMonth(MOTIVATIONAL_PHRASES, monthPhraseKey),
    [monthPhraseKey],
  );
  const pastMonthWinHeadline = useMemo(
    () => pickPhraseForMonth(PAST_MONTH_WIN_HEADLINES, monthPhraseKey),
    [monthPhraseKey],
  );
  const pastMonthLossHeadline = useMemo(
    () => pickPhraseForMonth(PAST_MONTH_LOSS_HEADLINES, monthPhraseKey),
    [monthPhraseKey],
  );
  const pastMonthNoBaselineHeadline = useMemo(
    () => pickPhraseForMonth(PAST_MONTH_NO_BASELINE_HEADLINES, monthPhraseKey),
    [monthPhraseKey],
  );

  const stats = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
    return computeMonthlyBattleStats(parsedData, boundaries);
  }, [parsedData, boundaries]);

  const strengthLevelStats = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0 || !bio) return null;
    return computeStrengthLevelStats(parsedData, boundaries, bio);
  }, [parsedData, bio, boundaries]);

  const strengthLevelPassed = useMemo(
    () => getStrengthLevelPassed(strengthLevelStats),
    [strengthLevelStats],
  );

  const verdict = useMemo(() => {
    if (!stats) return null;
    return getVerdict(stats, strengthLevelPassed, boundaries);
  }, [stats, strengthLevelPassed, boundaries]);

  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");

  const sessionsPaceStatus = stats
    ? getPaceStatus(stats.sessions.current, stats.sessions.last, stats.progressRatio)
    : null;
  const bigFourPaceStatus = stats
    ? getPaceStatus(stats.bigFourTonnage.current, stats.bigFourTonnage.last, stats.progressRatio)
    : null;

  const strengthSetupRequired = !!bio?.bioDataIsDefault;
  const checksSummary = useMemo(
    () => getMonthlyChecksSummary(stats, strengthLevelStats, boundaries),
    [stats, strengthLevelStats, boundaries],
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
        boundaries,
        verdict,
        checksSummary,
        sessionsPaceStatus,
        bigFourPaceStatus,
        topTierPhrase: topTierVerdict,
        pastMonthWinHeadline,
        pastMonthLossHeadline,
        pastMonthNoBaselineHeadline,
      }),
    [
      boundaries,
      verdict,
      checksSummary,
      sessionsPaceStatus,
      bigFourPaceStatus,
      topTierVerdict,
      pastMonthWinHeadline,
      pastMonthLossHeadline,
      pastMonthNoBaselineHeadline,
    ],
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
  }, [checksSummary, highlightsComplete, safeMonthOffset]);

  const viewPreviousMonth = () => {
    setMonthOffset((prev) => Math.min(maxMonthOffset, prev + 1));
  };

  const viewNextMonth = () => {
    setMonthOffset((prev) => Math.max(0, prev - 1));
  };

  if (dataMaturityStage !== "mature") {
    return (
      <EarlyMonthMomentumCard
        isDemoMode={isDemoMode}
        parsedData={parsedData}
        dashboardStage={dashboardStage}
        dataMaturityStage={dataMaturityStage}
        isMetric={isMetric}
        sheetUrl={sheetInfo?.url}
      />
    );
  }

  return (
    <Card ref={cardRef} className="flex h-full flex-1 flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>
              {isDemoMode && "Demo Mode: "}
              {monthCardTitle}
            </CardTitle>
            <CardDescription>{motivationalPhrase}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={viewPreviousMonth}
                    disabled={safeMonthOffset >= maxMonthOffset}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous month</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={viewNextMonth}
                    disabled={safeMonthOffset === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next month</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
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
      {stats && dashboardStage === "established" && (
        <CardFooter className="pt-0">
          <MiniFeedbackWidget
            contextId="this_month_in_iron_card"
            page="/lift-explorer"
            analyticsExtra={{ context: "this_month_in_iron_card" }}
          />
        </CardFooter>
      )}
    </Card>
  );
}

function EarlyMonthMomentumCard({
  isDemoMode,
  parsedData,
  dashboardStage,
  dataMaturityStage,
  isMetric,
  sheetUrl,
}) {
  const stats = useMemo(() => {
    const entries = Array.isArray(parsedData)
      ? parsedData.filter((entry) => !entry?.isGoal)
      : [];
    const sessions = new Set(entries.map((entry) => entry.date)).size;
    const sets = entries.length;
    const totalTonnageNative = entries.reduce(
      (sum, entry) => sum + (entry.weight || 0) * (entry.reps || 0),
      0,
    );
    const unitType = entries[0]?.unitType ?? (isMetric ? "kg" : "lb");
    const totalTonnage = getDisplayWeight(
      { weight: totalTonnageNative, unitType },
      isMetric,
    );
    const bigFourTouches = new Set(
      entries
        .map((entry) => entry.liftType)
        .filter((liftType) => BIG_FOUR_LIFT_TYPES.includes(liftType)),
    ).size;
    return {
      sessions,
      sets,
      bigFourTouches,
      tonnageValue: Math.round(totalTonnage.value),
      tonnageUnit: totalTonnage.unitType,
    };
  }, [parsedData, isMetric]);

  const title =
    dashboardStage === "starter_sample" || dashboardStage === "first_real_week"
      ? "The First Week in Iron"
      : dataMaturityStage === "no_sessions"
        ? "The First Month in Iron"
        : "First Month Momentum";
  const subtitle =
    dashboardStage === "starter_sample"
      ? "Get into the gym and start the week strong."
      : dashboardStage === "first_real_week"
        ? "Keep the week simple, learn the lifts, and add only small jumps."
      : dataMaturityStage === "first_week"
        ? "Your first week is about showing up and building rhythm."
        : dataMaturityStage === "first_month"
          ? "Momentum now becomes measurable progress."
          : "Log your first session and this card will start scoring your month.";

  const guidanceItems =
    dashboardStage === "starter_sample"
      ? [
          "Open the sheet and replace the sample row.",
          "Aim for three simple sessions this week.",
          "Keep weights easy enough that technique stays clean.",
        ]
      : dashboardStage === "first_real_week"
        ? [
            "Repeat the same basic lifts before adding variety.",
            "Log every set so the habit becomes automatic.",
            "Leave a rep in reserve instead of chasing grinders.",
          ]
        : [
            "Squat and press regularly, deadlift once a week, and recover hard.",
            "Let consistency lead load. Good weeks compound faster than big swings.",
            "The goal this month is repeatable training, not dramatic heroics.",
          ];
  const showWeekTemplate =
    dashboardStage === "starter_sample" || dashboardStage === "first_real_week";
  const showFirstMonthTemplate = dashboardStage === "first_month";

  return (
    <Card className="flex h-full flex-1 flex-col">
      <CardHeader className="pb-3">
        <CardTitle>
          {isDemoMode && "Demo Mode: "}
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-4">
        {showWeekTemplate ? (
          <div className="rounded-lg border bg-background/80 px-3 py-3">
            <p className="text-sm text-muted-foreground">
              Start with an empty barbell and work up to a moderate weight. 3x5
              means three sets of five reps, with 3-5 minutes of rest between
              sets. It should feel heavy enough that you still have 2-3 reps in
              reserve.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <WeekPlanLiftSession
                title="Session 1"
                lifts={[
                  { liftType: "Back Squat", prescription: "3×5" },
                ]}
              />
              <WeekPlanLiftSession
                title="Session 2"
                lifts={[
                  { liftType: "Bench Press", prescription: "3×5" },
                ]}
              />
              <WeekPlanLiftSession
                title="Session 3"
                lifts={[
                  { liftType: "Deadlift", prescription: "1×5" },
                  { liftType: "Strict Press", prescription: "3×5" },
                ]}
              />
            </div>
          </div>
        ) : showFirstMonthTemplate ? (
          <div className="rounded-lg border bg-background/80 px-3 py-3">
            <p className="text-sm text-muted-foreground">
              In the first month, the aim is simply to learn the movements,
              build consistency, and start adding weight gradually. Choose
              weights that feel manageable so you can focus on solid technique
              and finish each set knowing you could have done another rep or
              two. Rest properly between sets, keep the sessions simple, and
              add only small increases each workout so you build steady
              momentum.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <WeekPlanSession
                title="Session 1"
                items={[
                  "Squat — 3×5 (comfortable weight, focus on depth and balance)",
                  "Press — 3×5 (tight body, straight bar path)",
                  "Deadlift — 1×5 (learn the setup and push the floor away)",
                ]}
              />
              <WeekPlanSession
                title="Session 2"
                items={[
                  "Squat — 3×5 (+ small weight increase)",
                  "Bench Press — 3×5 (consistent setup and control)",
                  "Back extension or light core — 2–3 easy sets",
                ]}
              />
              <WeekPlanSession
                title="Session 3"
                items={[
                  "Squat — 3×5 (+ small weight increase again)",
                  "Press — 3×5 (slightly heavier than Session 1)",
                  "Deadlift — 1×5 (+ small weight increase)",
                ]}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <MomentumStat label="Sessions" value={stats.sessions} />
              <MomentumStat label="Sets Logged" value={stats.sets} />
              <MomentumStat label="Big Four" value={stats.bigFourTouches} />
            </div>
            <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Total volume so far:{" "}
              <span className="font-medium text-foreground">
                {stats.tonnageValue.toLocaleString()} {stats.tonnageUnit}
              </span>
              . Keep stacking consistent sessions.
            </p>
            <div className="rounded-lg border bg-background/80 px-3 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Coaching Notes
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              {guidanceItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            </div>
          </>
        )}
      </CardContent>
      {dashboardStage === "established" && (
        <CardFooter className="pt-0">
          <MiniFeedbackWidget
            contextId="this_month_in_iron_card"
            page="/lift-explorer"
            analyticsExtra={{ context: "this_month_in_iron_card_early" }}
          />
        </CardFooter>
      )}
    </Card>
  );
}

function MomentumStat({ label, value }) {
  return (
    <div className="rounded-lg border bg-background/80 px-2 py-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function WeekPlanSession({ title, items }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-3">
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function WeekPlanLiftSession({ title, lifts }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-3">
        {lifts.map(({ liftType, prescription }) => {
          const href = BIG_FOUR_INSIGHT_HREFS[liftType];

          return (
            <div key={`${title}-${liftType}`} className="flex items-center gap-3">
              <Link href={href} className="shrink-0">
                <LiftSvg
                  liftType={liftType}
                  size="sm"
                  animate={false}
                  className="h-12 w-12"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={href}
                  className="font-medium text-primary hover:underline"
                >
                  {liftType}
                </Link>
                <p className="text-sm text-muted-foreground">{prescription}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

const PAST_MONTH_WIN_HEADLINES = [
  "Month Won ✅",
  "Month Locked In 🔒",
  "Month Dominated 👑",
  "Month Cleared 💪",
  "Month Beat: mission complete ✅",
  "Month conquered. Keep building 🏆",
];

const PAST_MONTH_LOSS_HEADLINES = [
  "Month Lost ❌",
  "Month slipped. Own it and reload ⚒️",
  "Last month got away. Next one is yours.",
  "Missed the month. Reset and attack.",
  "Month not won. Back to work.",
  "Outperformed by last month. Respond.",
];

const PAST_MONTH_NO_BASELINE_HEADLINES = [
  "No prior month to beat. Baseline set.",
  "First month on record. Benchmark logged.",
  "No month-versus-month baseline yet.",
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
// Returns "ahead" | "on-pace" | "behind" | "no-data".
// expected = last * (dayOfMonth / daysInCurrentMonth); green if current >= expected * 0.9.
function getLiftPaceStatus(currentTonnage, lastTonnage, dayOfMonth, daysInCurrentMonth) {
  if (!lastTonnage || !dayOfMonth || !daysInCurrentMonth) return "no-data";
  const expected = lastTonnage * (dayOfMonth / daysInCurrentMonth);
  if (expected <= 0) return "no-data";
  const ratio = currentTonnage / expected;
  if (ratio >= 1.0) return "ahead";
  if (ratio >= TONNAGE_CLOSE_ENOUGH_RATIO) return "on-pace";
  return "behind";
}

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

function getMonthBoundaries(monthOffset = 0) {
  const today = new Date();
  const targetMonthDate = new Date(
    today.getFullYear(),
    today.getMonth() - monthOffset,
    1,
  );
  const y = targetMonthDate.getFullYear();
  const m = targetMonthDate.getMonth();
  const daysInCurrentMonth = new Date(y, m + 1, 0).getDate();
  const d = monthOffset === 0 ? today.getDate() : daysInCurrentMonth;
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${y}-${pad(m + 1)}-${pad(d)}`;
  const currentMonthStart = `${y}-${pad(m + 1)}-01`;

  const prevDate = new Date(y, m - 1, 1);
  const py = prevDate.getFullYear();
  const pm = prevDate.getMonth();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

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
    currentMonthName: targetMonthDate.toLocaleString("default", { month: "long" }),
    currentMonthShortYear: targetMonthDate.toLocaleString("default", {
      month: "short",
      year: "numeric",
    }),
    prevMonthName: prevDate.toLocaleString("default", { month: "long" }),
    isCurrentMonthView: monthOffset === 0,
  };
}

function getMonthlyCardTitle(boundaries) {
  if (boundaries.isCurrentMonthView) return "The Month in Iron";
  return `${boundaries.currentMonthShortYear} in Iron`;
}

function parseIsoDate(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getMaxMonthOffsetFromData(parsedData) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return 0;

  let earliestDate = null;
  for (const entry of parsedData) {
    if (!entry || entry.isGoal) continue;
    const entryDate = parseIsoDate(entry.date);
    if (!entryDate) continue;
    if (!earliestDate || entryDate < earliestDate) {
      earliestDate = entryDate;
    }
  }

  if (!earliestDate) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const earliestYear = earliestDate.getFullYear();
  const earliestMonth = earliestDate.getMonth();

  return Math.max(
    0,
    (currentYear - earliestYear) * 12 + (currentMonth - earliestMonth),
  );
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

function getVerdict(stats, strengthLevelPassed, boundaries) {
  const { sessions, bigFourTonnage, tonnage, bigFourByLift } = stats;

  if (
    sessions.last === 0 &&
    bigFourTonnage.last === 0 &&
    tonnage.last === 0
  ) {
    return { label: "Writing History", emoji: "📖", won: false };
  }

  const isCurrentMonth = boundaries?.isCurrentMonthView;
  const primaryMet =
    passesTonnageThreshold(sessions.current, sessions.lastSameDay) &&
    BIG_FOUR_LIFT_TYPES.every((liftType) => {
      const lift = bigFourByLift?.[liftType];
      const current = lift?.current ?? 0;
      const last = lift?.last ?? 0;
      if (isCurrentMonth && boundaries.dayOfMonth > 0) {
        const ps = getLiftPaceStatus(current, last, boundaries.dayOfMonth, boundaries.daysInCurrentMonth);
        return ps === "ahead" || ps === "on-pace";
      }
      return passesTonnageThreshold(current, last);
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
  boundaries,
  verdict,
  checksSummary,
  sessionsPaceStatus,
  bigFourPaceStatus,
  topTierPhrase,
  pastMonthWinHeadline,
  pastMonthLossHeadline,
  pastMonthNoBaselineHeadline,
}) {
  const checksText = checksSummary
    ? `${checksSummary.checksMet}/${checksSummary.checksTotal}`
    : null;
  const isPastMonthView = !boundaries?.isCurrentMonthView;
  const hasFullChecks = checksSummary?.checksTotal === 9;
  const monthWon = hasFullChecks
    ? checksSummary.checksMet >= 7
    : Boolean(verdict?.won);

  if (isPastMonthView) {
    if (verdict?.label === "Writing History") {
      return {
        tone: "neutral",
        text: pastMonthNoBaselineHeadline || "No prior month to beat. Baseline set.",
        scoreText: checksText ? `${checksText} green` : null,
      };
    }

    return {
      tone: monthWon ? "win" : "neutral",
      text: monthWon
        ? (pastMonthWinHeadline || "Month Won ✅")
        : (pastMonthLossHeadline || "Month Lost ❌"),
      scoreText: checksText ? `${checksText} green` : null,
    };
  }

  if (hasFullChecks && checksSummary.checksMet >= 7) {
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

function hashString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickPhraseForMonth(phrases, monthKey) {
  if (!Array.isArray(phrases) || phrases.length === 0) return "";
  const idx = hashString(monthKey) % phrases.length;
  return phrases[idx];
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

function getMonthlyChecksSummary(stats, strengthLevelStats, boundaries) {
  if (!stats) return null;

  let checksMet = 0;
  let checksTotal = 1; // sessions

  if (passesTonnageThreshold(stats.sessions.current, stats.sessions.lastSameDay)) {
    checksMet += 1;
  }

  const isCurrentMonth = boundaries?.isCurrentMonthView;
  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    checksTotal += 1; // tonnage
    const lift = stats.bigFourByLift?.[liftType];
    const current = lift?.current ?? 0;
    const last = lift?.last ?? 0;
    let passed;
    if (isCurrentMonth && boundaries?.dayOfMonth > 0) {
      const ps = getLiftPaceStatus(current, last, boundaries.dayOfMonth, boundaries.daysInCurrentMonth);
      passed = ps === "ahead" || ps === "on-pace";
    } else {
      passed = passesTonnageThreshold(current, last);
    }
    if (passed) checksMet += 1;
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
  liftPaceStatus,
  isCurrentMonthView,
}) {
  const liftLabel = formatLiftTypeLabel(liftType).toLowerCase();

  if (tonnageBaseline && !tonnageNewWin) {
    return `No previous month ${liftLabel} tonnage to compare against.`;
  }
  if (tonnageNewWin) {
    return `First ${liftLabel} tonnage recorded this month — baseline set.`;
  }
  if (isCurrentMonthView && liftPaceStatus !== "no-data") {
    if (liftPaceStatus === "ahead") return `Ahead of expected ${liftLabel} pace for this point in the month.`;
    if (liftPaceStatus === "on-pace") return `Within 10% of expected ${liftLabel} pace — on track.`;
    return `Behind expected ${liftLabel} pace for this point in the month.`;
  }
  if (currentTonnage > lastTonnage) return `Passed previous month ${liftLabel} tonnage.`;
  if (tonnagePassed) return `Matched previous month ${liftLabel} tonnage.`;
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
  const isCurrentMonthView = boundaries?.isCurrentMonthView;
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
        const isCurrentMonthView = boundaries?.isCurrentMonthView;
        const previousSessionsCompared = isCurrentMonthView
          ? (sessions.lastSameDay ?? 0)
          : (sessions.last ?? 0);
        const baseline = previousSessionsCompared === 0;
        const passed = baseline || passesTonnageThreshold(
          sessions.current ?? 0,
          previousSessionsCompared,
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
                      value={previousSessionsCompared}
                      className={`tabular-nums text-2xl font-semibold tracking-tight transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}
                    />
                    {isCurrentMonthView && (
                      <div className={`text-[10px] transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground/80" : "text-foreground/80"}`}>
                        of {sessions.last ?? 0} total
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    {isCurrentMonthView
                      ? `${boundaries.prevMonthName} sessions through day ${boundaries.dayOfMonth}, counted from unique logged training dates.`
                      : `Total sessions logged in ${boundaries.prevMonthName}.`}
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
                      {isCurrentMonthView
                        ? currentSessionsReporting.replace(
                            `${sessions.current ?? 0} `,
                            "",
                          )
                        : ""}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="max-w-56 text-center text-xs">
                    {isCurrentMonthView
                      ? "Compared with last month&apos;s same-day count; being within 10% still counts as on track."
                      : "Compared with the full previous month total; being within 10% still counts as on track."}
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
        const liftPaceStatus = isCurrentMonthView && boundaries.dayOfMonth > 0
          ? getLiftPaceStatus(currentTonnage, lastTonnage, boundaries.dayOfMonth, boundaries.daysInCurrentMonth)
          : "no-data";
        const tonnageBaseline = lastTonnage === 0;
        const tonnageNewWin = tonnageBaseline && currentTonnage > 0;
        const tonnagePassed = tonnageBaseline
          ? tonnageNewWin
          : isCurrentMonthView
            ? (liftPaceStatus === "ahead" || liftPaceStatus === "on-pace")
            : passesTonnageThreshold(currentTonnage, lastTonnage);
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
          liftPaceStatus,
          isCurrentMonthView,
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
                      <span>{formatTonnage(currentTonnage, unit)} lifted</span>
                      {rowHighlighted && (tonnagePassed || tonnageNewWin) && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                    </div>
                    {rowHighlighted && isCurrentMonthView && liftPaceStatus !== "no-data" && (
                      <div className={`text-[10px] font-medium ${
                        liftPaceStatus === "ahead" ? "text-emerald-600 dark:text-emerald-400"
                        : liftPaceStatus === "on-pace" ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                      }`}>
                        {liftPaceStatus === "ahead" ? "▲ Ahead of pace"
                          : liftPaceStatus === "on-pace" ? "→ On track"
                          : "▼ Behind pace"}
                      </div>
                    )}
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
          defaultBioPrompt="Enter your details to unlock this feature."
        />
      </div>
    </div>
  );
}
