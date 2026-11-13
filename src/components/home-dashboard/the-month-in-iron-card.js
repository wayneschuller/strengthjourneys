/**
 * Month-in-progress dashboard card that compares the current calendar month
 * against the previous month for sessions and, for the lifter's main lifts
 * (the Big Four first), tonnage and strength tiers.
 */
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import confetti from "canvas-confetti";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import {
  AiReviewActions,
  buildCardCopyText,
} from "@/components/ai-review-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CountUp, formatCountUpInteger } from "@/components/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BIG_FOUR_LIFT_TYPES, getDisplayWeight } from "@/lib/processing-utils";
import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM, estimateEntryE1RM } from "@/lib/estimate-e1rm";
import { toKg, unitTypeFor } from "@/lib/weight-units";
import { LiftArtwork, getLiftArtwork } from "@/components/lift-artwork";
import {
  getBigFourBodyBenefit,
  getBigFourParentLift,
} from "@/lib/lifts/lift-registry";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import { MiniFeedbackWidget } from "@/components/feedback";
import { gaTrackCoffeeNudgeClick } from "@/lib/analytics/analytics";
import {
  buildAiAssistantPromptLink,
  buildMonthlyReviewPrompt,
} from "@/lib/ai/review-prompts";

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Card that challenges the user to beat their previous calendar month across
 * sessions, and tonnage and strength level consistency on the lifter's main
 * lifts.
 * Reads data from UserLiftingDataProvider; takes no props.
 */
export function TheMonthInIronCard({
  dashboardStage = "established",
  dataMaturityStage: stageFromParent = null,
  sessionCount: sessionCountFromParent = null,
}) {
  const { dataSource, parsedData, sheetInfo } = useUserLiftingData();
  const bio = useAthleteBio();
  const { isMetric } = bio;
  const sessionCount = useMemo(() => {
    if (typeof sessionCountFromParent === "number")
      return sessionCountFromParent;
    if (!Array.isArray(parsedData)) return 0;
    const dates = new Set();
    parsedData.forEach((entry) => {
      if (entry?.date) dates.add(entry.date);
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
  const boundaries = useMemo(() => {
    const base = getMonthBoundaries(safeMonthOffset);
    return { ...base, comeback: getComebackWindow(parsedData, base) };
  }, [safeMonthOffset, parsedData]);
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

  const lineup = useMemo(
    () => getMonthLineup(parsedData, boundaries),
    [parsedData, boundaries],
  );
  const stats = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
    return computeMonthlyBattleStats(parsedData, boundaries, lineup);
  }, [parsedData, boundaries, lineup]);
  const upNextBestSets = useMemo(
    () => getUpNextBestSets(parsedData, boundaries, lineup),
    [parsedData, boundaries, lineup],
  );

  const strengthLevelStats = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0 || !bio)
      return null;
    return computeStrengthLevelStats(parsedData, boundaries, bio, lineup);
  }, [parsedData, bio, boundaries, lineup]);

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
    ? getHeadlinePaceStatus(stats.sessions, stats, boundaries)
    : null;
  const bigFourPaceStatus = stats
    ? getHeadlinePaceStatus(stats.lineupTonnage, stats, boundaries)
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
    () => getMonthlyRevealRowCount(stats),
    [stats],
  );
  const highlightsComplete =
    totalRevealRows > 0 && revealedRows >= totalRevealRows;
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

  /*
   * The verdict strip scores this month against the previous one, so it only
   * has something to say when the previous one has sessions in it. Without
   * that baseline every check passes by default and the strip reports a green
   * score to a lifter who has not trained, which is the one claim this card
   * must never make. Covers both lifters who arrive here with no previous
   * month: the brand new one, and the one coming back.
   */
  const hasComparisonMonth = (stats?.sessions?.last ?? 0) > 0;

  // Buy-Me-a-Coffee nudge: shown when the user is clearly winning a month.
  // Current month: only in the final week (avoid false positives mid-month).
  // Past month: any winning historical month qualifies.
  // Copy is hashed by a stable per-month seed so a given month always shows the same phrase.
  const isCurrentMonthLastWeekWin =
    !!boundaries?.isCurrentMonthView &&
    typeof boundaries?.daysRemainingInCurrentMonth === "number" &&
    boundaries.daysRemainingInCurrentMonth <= 7;
  const isPastMonthWin = !!boundaries && !boundaries.isCurrentMonthView;
  const showCoffeeNudge =
    dataSource !== "demo" &&
    hasComparisonMonth &&
    verdictHeadline?.tone === "win" &&
    highlightsComplete &&
    (isCurrentMonthLastWeekWin || isPastMonthWin);
  const coffeeNudgeSurface = isPastMonthWin
    ? "month_win_past"
    : "month_win_last_week";
  const coffeeNudgeSeed = isPastMonthWin
    ? boundaries?.currentMonthStart
    : boundaries?.todayStr;
  const coffeeNudgeText = showCoffeeNudge
    ? pickPhraseForMonth(COFFEE_WIN_NUDGES, coffeeNudgeSeed)
    : "";

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

  useEffect(
    () => () => {
      if (highlightStartTimerRef.current) {
        clearTimeout(highlightStartTimerRef.current);
        highlightStartTimerRef.current = null;
      }
      if (highlightStepTimerRef.current) {
        clearInterval(highlightStepTimerRef.current);
        highlightStepTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const isPastMonthView = !!boundaries && !boundaries.isCurrentMonthView;
    const isLastWeekCurrentMonth =
      !!boundaries?.isCurrentMonthView &&
      typeof boundaries.daysRemainingInCurrentMonth === "number" &&
      boundaries.daysRemainingInCurrentMonth <= 7;
    const shouldCelebrate =
      isChecksWin(checksSummary) && (isPastMonthView || isLastWeekCurrentMonth);

    if (!shouldCelebrate) {
      confettiFiredRef.current = false;
      return;
    }

    if (confettiFiredRef.current) return;
    if (typeof window === "undefined") return;
    if (!highlightsComplete) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
      return;

    confettiFiredRef.current = true;
    const timer = setTimeout(
      () => fireMonthWinConfetti(cardRef),
      CONFETTI_AFTER_HIGHLIGHT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [boundaries, checksSummary, highlightsComplete, safeMonthOffset]);

  const viewPreviousMonth = () => {
    setMonthOffset((prev) => Math.min(maxMonthOffset, prev + 1));
  };

  const viewNextMonth = () => {
    setMonthOffset((prev) => Math.max(0, prev - 1));
  };
  const monthCopyLines = useMemo(
    () =>
      buildMonthCardPromptSummary({
        stats,
        strengthLevelStats,
        strengthSetupRequired,
        boundaries,
        unit,
        checksSummary,
        verdictHeadline,
      }),
    [
      boundaries,
      checksSummary,
      stats,
      strengthLevelStats,
      strengthSetupRequired,
      unit,
      verdictHeadline,
    ],
  );
  const aiReviewLink = useMemo(
    () =>
      buildAiAssistantPromptLink(
        buildMonthlyReviewPrompt({
          startDate: boundaries.currentMonthStart,
          endDate: boundaries.todayStr,
          isCurrentMonth: boundaries.isCurrentMonthView,
          summaryLines: monthCopyLines,
        }),
      ),
    [boundaries, monthCopyLines],
  );

  if (dataMaturityStage !== "mature") {
    return (
      <EarlyMonthMomentumCard
        dataSource={dataSource}
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
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {dataSource === "demo" && <DemoModeBadge />}
              {monthCardTitle}
            </CardTitle>
            <CardDescription>{motivationalPhrase}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AiReviewActions
              aiReviewLink={aiReviewLink}
              contentRef={cardRef}
              copyText={buildCardCopyText({
                title: monthCardTitle,
                subtitle: motivationalPhrase,
                lines: monthCopyLines,
              })}
            />
            <span
              className="text-muted-foreground hidden text-xs font-medium tracking-wide italic"
              data-copy-only
            >
              strengthjourneys.xyz
            </span>
            <div
              className="bg-muted/30 flex items-center gap-0.5 rounded-lg border p-0.5"
              data-copy-exclude
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Previous month"
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
                      aria-label="Next month"
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
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3">
        {!stats && <Skeleton className="h-[30vh]" />}

        {stats && (
          <>
            <BigFourCriteriaTable
              sessions={stats.sessions}
              upNextBestSets={upNextBestSets}
              tonnageByLift={stats.tonnageByLift}
              strengthLevelStats={strengthLevelStats}
              strengthSetupRequired={strengthSetupRequired}
              boundaries={boundaries}
              unit={unit}
              revealedRows={revealedRows}
              hasComparisonMonth={hasComparisonMonth}
            />

            {hasComparisonMonth && (
              <>
                <Separator />
                <motion.div
                  className={`flex items-center gap-4 rounded-xl border px-3 py-2.5 transition-colors duration-500 ${
                    highlightsComplete && verdictHeadline?.tone === "win"
                      ? "border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_18px_-6px_rgba(16,185,129,0.45)]"
                      : highlightsComplete &&
                          verdictHeadline?.tone === "progress"
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-border/40 bg-muted/10"
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                >
                  {checksSummary && (
                    <MonthScoreRing
                      met={highlightsComplete ? checksSummary.checksMet : 0}
                      total={checksSummary.checksTotal}
                      tone={highlightsComplete ? verdictHeadline?.tone : null}
                      size={44}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-[10px] font-semibold">
                      {verdictHeadline?.phaseLabel}
                      {highlightsComplete && verdictHeadline?.scoreText
                        ? ` · ${verdictHeadline.scoreText}`
                        : ""}
                    </div>
                    <p className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
                      <span
                        className={
                          !highlightsComplete ||
                          verdictHeadline?.tone === "neutral"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {verdictHeadline?.text || "Keep forging ⚒️"}
                      </span>
                    </p>
                  </div>
                </motion.div>
              </>
            )}

            {showCoffeeNudge && (
              <motion.div
                key={boundaries?.currentMonthStart}
                data-copy-exclude
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
              >
                <p className="leading-snug">{coffeeNudgeText}</p>
                <a
                  href="https://buymeacoffee.com/lrhvbjxzqr"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => gaTrackCoffeeNudgeClick(coffeeNudgeSurface)}
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-500"
                >
                  ☕ Buy me a coffee
                </a>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
      {/* Asking "Useful?" under the invitation panel asks the wrong question:
          there is no verdict to rate, only an offer to come back. The widget
          belongs to the comparison, so it appears with it. */}
      {stats && hasComparisonMonth && dashboardStage === "established" && (
        <CardFooter className="pt-0" data-copy-exclude>
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
  dataSource,
  parsedData,
  dashboardStage,
  dataMaturityStage,
  isMetric,
  sheetUrl,
}) {
  const stats = useMemo(() => {
    const entries = Array.isArray(parsedData) ? parsedData : [];
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
    dataMaturityStage === "no_sessions"
      ? [
          "Set your preferred units in your bio settings.",
          "Open the Log page and add your first training session.",
          "Already have history? Import it and merge it into this sheet.",
        ]
      : dashboardStage === "starter_sample"
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
  const weekPlanDays = useMemo(() => getWeekPlanDays(), []);
  const showFirstMonthTemplate = dashboardStage === "first_month";
  const isTemplateMode = showWeekTemplate || showFirstMonthTemplate;

  return (
    <Card className="flex h-full flex-1 flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          {dataSource === "demo" && <DemoModeBadge />}
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent
        className={`flex flex-1 flex-col gap-4 ${
          isTemplateMode ? "justify-start pt-0" : "justify-center"
        }`}
      >
        {showWeekTemplate ? (
          <div className="bg-background/60 rounded-lg px-3 py-3">
            <p className="text-muted-foreground text-sm">
              Start with{" "}
              <span className="text-foreground font-medium">an empty bar</span>{" "}
              and work up to{" "}
              <span className="text-foreground font-medium">
                a moderate weight
              </span>
              .{" "}
              <span className="text-foreground font-medium">
                3x5 means three sets of five reps
              </span>
              . Rest a few minutes between sets.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              The days are only a suggestion. Start today if you can, then leave
              about two days between sessions.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <WeekPlanLiftSession
                title="Session 1"
                dayLabel={weekPlanDays[0].label}
                isToday={weekPlanDays[0].isToday}
                lifts={[{ liftType: "Back Squat", prescription: "3×5" }]}
              />
              <WeekPlanLiftSession
                title="Session 2"
                dayLabel={weekPlanDays[1].label}
                lifts={[{ liftType: "Bench Press", prescription: "3×5" }]}
              />
              <WeekPlanLiftSession
                title="Session 3"
                dayLabel={weekPlanDays[2].label}
                lifts={[
                  { liftType: "Deadlift", prescription: "1×5" },
                  { liftType: "Strict Press", prescription: "3×5" },
                ]}
              />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              Each work set should feel{" "}
              <span className="text-foreground font-medium">
                solid and challenging
              </span>
              , but never like a desperate grind. You will finish knowing you
              could have done{" "}
              <span className="text-foreground font-medium">2-3 more reps</span>{" "}
              if needed. Over the following weeks,{" "}
              <span className="text-foreground font-medium">
                add small amounts of weight
              </span>{" "}
              so the lifts get heavier while still moving cleanly.
            </p>
          </div>
        ) : showFirstMonthTemplate ? (
          <div className="bg-background/60 rounded-lg px-3 py-3">
            <p className="text-muted-foreground text-sm">
              You can continue what you did in the previous week, or feel free
              to start adding more lifts to each session as the movements begin
              to feel more natural. Keep the sessions simple, use manageable
              weights, and add small amounts over time.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <WeekPlanSession
                title="Session 1"
                items={[
                  { liftType: "Back Squat", prescription: "3×5" },
                  { liftType: "Strict Press", prescription: "3×5" },
                ]}
              />
              <WeekPlanSession
                title="Session 2"
                items={[
                  {
                    liftType: "Back Squat",
                    prescription: "3×5 (+ small weight increase)",
                  },
                  { liftType: "Bench Press", prescription: "3×5" },
                ]}
              />
              <WeekPlanSession
                title="Session 3"
                items={[
                  {
                    liftType: "Back Squat",
                    prescription: "3×5 (+ small weight increase again)",
                  },
                  { liftType: "Strict Press", prescription: "3×5" },
                  {
                    liftType: "Deadlift",
                    prescription: "1×5 (+ small weight increase)",
                  },
                ]}
              />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              If you are especially keen, try implementing the{" "}
              <a
                href="https://startingstrength.com/get-started/programs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Starting Strength Novice Linear Progression
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <MomentumStat label="Sessions" value={stats.sessions} />
              <MomentumStat label="Sets Logged" value={stats.sets} />
              <MomentumStat label="Big Four" value={stats.bigFourTouches} />
            </div>
            <p className="bg-muted/20 text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-sm">
              Total volume so far:{" "}
              <span className="text-foreground font-medium">
                <CountUp
                  value={stats.tonnageValue}
                  format={formatCountUpInteger}
                  duration={MONTH_COUNT_UP_SECONDS}
                />{" "}
                {stats.tonnageUnit}
              </span>
              . Keep stacking consistent sessions.
            </p>
            <div className="bg-background/80 rounded-lg border px-3 py-3">
              <p className="text-muted-foreground mb-2 text-xs font-semibold">
                Coaching notes
              </p>
              <div className="text-muted-foreground space-y-2 text-sm">
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
    <div className="bg-background/80 rounded-lg border px-2 py-3 text-center">
      <div className="text-lg font-semibold tabular-nums">
        <CountUp
          value={value}
          format={formatCountUpInteger}
          duration={MONTH_COUNT_UP_SECONDS}
        />
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function WeekPlanSession({ title, items }) {
  return (
    <div className="border-border/70 bg-muted/10 rounded-lg border px-3 py-3">
      <p className="text-foreground mb-2 text-sm font-semibold">{title}</p>
      <div className="text-muted-foreground space-y-2 text-sm">
        {items.map((item) =>
          typeof item === "string" ? (
            <p key={item}>{item}</p>
          ) : (
            <p key={`${title}-${item.liftType}-${item.prescription}`}>
              <Link
                href={getLiftDetailUrl(item.liftType)}
                className="text-primary font-medium hover:underline"
              >
                {item.liftType}
              </Link>{" "}
              — {item.prescription}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

/*
 * Names the three template sessions after real weekdays instead of "Session 1".
 *
 * A novice reading "Session 1" still has to decide when session one happens.
 * Anchoring on today and stepping two days removes that decision: it is
 * Wednesday, so squat today, press Friday, pull Sunday. Recomputed on each
 * render, so the plan always starts from the day the lifter is actually
 * looking at it rather than drifting behind the week.
 */
function getWeekPlanDays(today = new Date()) {
  return [0, 2, 4].map((offset) => {
    const date = addDays(today, offset);
    return {
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "EEEE"),
      isToday: offset === 0,
    };
  });
}

function WeekPlanLiftSession({ title, dayLabel, lifts, isToday = false }) {
  return (
    <div
      className={`group bg-muted/10 relative rounded-lg border px-3 py-3 ${
        isToday ? "border-primary/40" : "border-border/70"
      }`}
    >
      {/* The session number is the structure and leads; the weekday under it
          is only a suggested day to put that session on. */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">{title}</p>
          {dayLabel && (
            <p className="text-muted-foreground text-xs">
              {isToday ? `Today, ${dayLabel}` : dayLabel}
            </p>
          )}
        </div>
        {isToday && (
          // The Log button sits over this badge on hover, so the badge fades
          // rather than the two stacking on top of each other.
          <span className="text-primary shrink-0 text-[10px] font-semibold transition-opacity md:group-focus-within:opacity-0 md:group-hover:opacity-0">
            Start here
          </span>
        )}
      </div>
      {/* Only today's card offers to log: the other two name days that have not
          happened yet, where a log button would be an invitation to record a
          session nobody has done. Revealed on hover so the plan stays calm,
          and on focus so it is reachable without a mouse. */}
      {isToday && (
        <Link
          href="/log?source=month-card-week-plan"
          className="border-primary/40 bg-background text-foreground focus-visible:ring-ring absolute top-2 right-2 hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none md:inline-flex"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
          Log
        </Link>
      )}
      <div className="space-y-3">
        {lifts.map(({ liftType, prescription }) => {
          const href = getLiftDetailUrl(liftType);

          return (
            <div
              key={`${title}-${liftType}`}
              className="flex items-center gap-3"
            >
              <Link href={href} className="shrink-0">
                <LiftArtwork
                  liftType={liftType}
                  size="sm"
                  animate={false}
                  className="h-12 w-12"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={href}
                  className="text-primary font-medium hover:underline"
                >
                  {liftType}
                </Link>
                <p className="text-muted-foreground text-sm">{prescription}</p>
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

const EARLY_MONTH_ON_TRACK_HEADLINES = [
  "Strong start.",
  "Good first week.",
  "Keep stacking sessions.",
  "Stay with it.",
];

// Week one has no gap to close yet, so these open the month rather than
// measure it.
const EARLY_MONTH_CATCH_UP_HEADLINES = [
  "Plenty of month left.",
  "The month is wide open.",
  "A perfect month is still on.",
  "Get the next session in.",
];

// The first week back after a layoff. The month restarts from the return day,
// so these greet the return instead of measuring a gap that illness made.
const COMEBACK_ON_TRACK_HEADLINES = [
  "Back under the bar.",
  "The comeback is on.",
  "Right back into it.",
  "Picking up where you left off.",
];

const COMEBACK_CATCH_UP_HEADLINES = [
  "Back under the bar.",
  "First one back is done.",
  "The comeback starts here.",
  "Get the next session in.",
];

const MID_MONTH_ON_TRACK_HEADLINES = [
  "On track.",
  "Keep going.",
  "Good pace.",
  "Hold the line.",
];

const MID_MONTH_CATCH_UP_HEADLINES = [
  "Still winnable.",
  "Close the gap this week.",
  "Make the next sessions count.",
  "Last month is reachable.",
];

const LAST_WEEK_ON_TRACK_HEADLINES = [
  "Win in sight.",
  "Close it out.",
  "Nearly there.",
  "Finish strong.",
];

const LAST_WEEK_CATCH_UP_HEADLINES = [
  "Final push.",
  "Last chance to catch last month",
  "Make the week count.",
  "Close the gap now.",
];

// Headlines for the Big Four invitation panel, shown when there is nothing to
// compare in either month. Every line has to work for someone whose last
// session was a long time ago, so they open a door rather than mark a return.
const BIG_FOUR_INVITATION_HEADLINES = [
  "Four lifts, and here is what each one gives back.",
  "A fresh month, and four good reasons to pick up a bar.",
  "The bar is still there, and so is everything it builds.",
  "Whenever you are ready, these four are ready too.",
  "The month is wide open. Here is what the big four are for.",
];

// Same panel, but the lifter has trained this month without touching a Big
// Four lift, so the invitation is to add one rather than to begin.
const BIG_FOUR_INVITATION_PARTIAL_HEADLINES = [
  "You are training. Add one of these four and the month starts scoring.",
  "Sessions are going in. Here is what each big four lift would add.",
  "Good month so far. Any one of these four builds on it.",
];

// Surface only in the final week of a month the user is winning. Hashed by today's date for daily variety.
const COFFEE_WIN_NUDGES = [
  "Crushing this month? Solo dev here. A coffee keeps me coding.",
  "A winning month deserves a small thank-you. Buy me a coffee?",
  "You're closing out a strong month. Want to fuel the next one?",
  "Solo dev watching you crush your month. A coffee would make my week.",
  "If this app helped you win the month, I'd love a coffee.",
  "Big month, small ask. Buy me a coffee?",
  "You're winning. I'm caffeinated. Let's keep both going.",
  "Free app, one developer, lots of coffee. You know what to do.",
  "Built this for people exactly like you. A coffee says thanks.",
  "Strong month. No ads, no tracking, just one dev and a coffee habit.",
];

// Slower than the Lift Explorer E1RM on purpose: this card's numbers keep
// settling while the rows light up green one by one, so the count and the
// verdict land together instead of the figures finishing first.
const MONTH_COUNT_UP_SECONDS = 2.2;
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
function getLiftPaceStatus(
  currentTonnage,
  lastTonnage,
  dayOfMonth,
  daysInCurrentMonth,
) {
  if (!lastTonnage || !dayOfMonth || !daysInCurrentMonth) return "no-data";
  const expected = lastTonnage * (dayOfMonth / daysInCurrentMonth);
  if (expected <= 0) return "no-data";
  const ratio = currentTonnage / expected;
  if (ratio >= 1.0) return "ahead";
  if (ratio >= TONNAGE_CLOSE_ENOUGH_RATIO) return "on-pace";
  return "behind";
}

/*
 * Comeback mode. A lifter who returns after a layoff (sickness, travel) is
 * behind a straight line drawn from the 1st on every row, and stays behind
 * however well they train, because the line assumes days they never had. So
 * when the latest gap of COMEBACK_GAP_DAYS or more ends inside the month being
 * viewed, the race restarts on the return day: the goal becomes last month's
 * rate over the days from the return to month end, and pace is measured on
 * the work done since. The colours and the pressure stay exactly as they are;
 * only the finish line moves to somewhere the lifter can still reach.
 */
const COMEBACK_GAP_DAYS = 10;

function getComebackWindow(parsedData, boundaries) {
  if (!boundaries?.isCurrentMonthView || !Array.isArray(parsedData)) {
    return null;
  }
  const { currentMonthStart, todayStr, dayOfMonth, daysInCurrentMonth } =
    boundaries;
  const dateSet = new Set();
  for (const entry of parsedData) {
    if (!entry?.date || (entry.reps ?? 0) < 1) continue;
    if (entry.date <= todayStr) dateSet.add(entry.date);
  }
  const dates = [...dateSet].sort();

  // Walk back through this month's sessions to the most recent return.
  for (let i = dates.length - 1; i > 0; i--) {
    if (dates[i] < currentMonthStart) break;
    const previous = parseIsoDate(dates[i - 1]);
    const returned = parseIsoDate(dates[i]);
    if (!previous || !returned) continue;
    const gapDays = Math.round((returned - previous) / 86400000);
    if (gapDays < COMEBACK_GAP_DAYS) continue;

    const returnDay = returned.getDate();
    // Back on the 1st is just a normal month.
    if (returnDay <= 1) return null;
    const daysInWindow = daysInCurrentMonth - returnDay + 1;
    return {
      returnDate: dates[i],
      returnLabel: format(returned, "MMM d"),
      gapDays,
      daysInWindow,
      daysElapsed: Math.max(1, dayOfMonth - returnDay + 1),
      share: daysInWindow / daysInCurrentMonth,
    };
  }
  return null;
}

// The four numbers a pace check needs for one metric (sessions or a lift's
// tonnage), rebased to the comeback window when there is one.
function getPaceArgs(metric, boundaries) {
  const comeback = boundaries?.comeback;
  if (comeback) {
    return [
      metric?.sinceReturn ?? 0,
      (metric?.last ?? 0) * comeback.share,
      comeback.daysElapsed,
      comeback.daysInWindow,
    ];
  }
  return [
    metric?.current ?? 0,
    metric?.last ?? 0,
    boundaries?.dayOfMonth,
    boundaries?.daysInCurrentMonth,
  ];
}

function getMetricPaceStatus(metric, boundaries) {
  return getLiftPaceStatus(...getPaceArgs(metric, boundaries));
}

// The month-end figure a row is chasing, in the same terms as the number the
// row displays: anything logged before the layoff plus last month's rate over
// the days since the return. Null outside comeback mode.
function getComebackGoal(metric, boundaries) {
  const comeback = boundaries?.comeback;
  if (!comeback || !(metric?.last > 0)) return null;
  const beforeLayoff = (metric.current ?? 0) - (metric.sinceReturn ?? 0);
  return beforeLayoff + metric.last * comeback.share;
}

function getSessionsCheckPassed(sessions, boundaries) {
  if (boundaries?.comeback) {
    const ps = getMetricPaceStatus(sessions, boundaries);
    return ps === "ahead" || ps === "on-pace" || ps === "no-data";
  }
  return passesTonnageThreshold(sessions.current, sessions.lastSameDay);
}

function getHeadlinePaceStatus(metric, stats, boundaries) {
  const comeback = boundaries?.comeback;
  if (comeback) {
    return getPaceStatus(
      metric.sinceReturn ?? 0,
      metric.last * comeback.share,
      comeback.daysElapsed / comeback.daysInWindow,
    );
  }
  return getPaceStatus(metric.current, metric.last, stats.progressRatio);
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

// Compact circular progress ring showing "checks met / checks total" for the month.
// Pass tone={null} to render an unrevealed neutral ring (used while the row-by-row
// stagger reveal is still playing out) — the fill and fraction pop in once tone is set.
function MonthScoreRing({ met, total, tone, size = 36 }) {
  if (!total) return null;
  const revealed = tone !== null && tone !== undefined;
  const pct = revealed ? Math.min(1, Math.max(0, met / total)) : 0;
  const stroke = Math.max(3, Math.round(size / 9));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringColorClass =
    tone === "win"
      ? "text-emerald-500"
      : tone === "progress"
        ? "text-amber-500"
        : "text-muted-foreground/70";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted/40"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={ringColorClass}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
            delay: revealed ? 0.1 : 0,
          }}
        />
      </svg>
      <span
        className={`text-foreground absolute inset-0 flex items-center justify-center font-bold tabular-nums transition-opacity duration-300 ${
          size >= 44 ? "text-[11px]" : "text-[9px]"
        } ${revealed ? "opacity-100" : "opacity-0"}`}
      >
        {met}/{total}
      </span>
    </div>
  );
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
    currentMonthName: targetMonthDate.toLocaleString("default", {
      month: "long",
    }),
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
    if (!entry) continue;
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

/*
 * The lineup: which lifts get a row. The card works because a lifter repeats
 * the same core of lifts month after month, so the rows are that core, read
 * from the month being viewed and the two before it. The Big Four trained in
 * that stretch come first, in their usual order. Any slots left are filled by
 * the lifts the lifter trained on the most days, so someone who never touches
 * a barbell still gets a month to win. The window only picks the rows; every
 * number on the card is still this month against last month.
 */
const LINEUP_SIZE = 4;
// A top-up lift has to be part of the routine, not a one-off.
const LINEUP_MIN_SESSIONS = 3;

function getLineupWindowStart(boundaries) {
  const monthStart = parseIsoDate(boundaries?.currentMonthStart);
  if (!monthStart) return null;
  return format(
    new Date(monthStart.getFullYear(), monthStart.getMonth() - 2, 1),
    "yyyy-MM-dd",
  );
}

function getMonthLineup(parsedData, boundaries) {
  const windowStart = getLineupWindowStart(boundaries);
  if (!Array.isArray(parsedData) || parsedData.length === 0 || !windowStart) {
    return [];
  }
  const nativeUnit = parsedData[0]?.unitType ?? "lb";
  const bigFourTrained = new Set();
  const datesByLift = new Map();

  for (const entry of parsedData) {
    if (!entry?.date || (entry.reps ?? 0) < 1) continue;
    if (entry.unitType !== nativeUnit) continue;
    if (entry.date < windowStart || entry.date > boundaries.todayStr) continue;
    const share = getBigFourShare(entry.liftType);
    if (share) {
      bigFourTrained.add(share.liftType);
      continue;
    }
    // Tonnage is the score, so a lift with no load on the bar cannot be one.
    if (!(entry.weight > 0)) continue;
    if (!datesByLift.has(entry.liftType)) {
      datesByLift.set(entry.liftType, new Set());
    }
    datesByLift.get(entry.liftType).add(entry.date);
  }

  const lineup = BIG_FOUR_LIFT_TYPES.filter((liftType) =>
    bigFourTrained.has(liftType),
  );
  const topUps = [...datesByLift.entries()]
    .filter(([, dates]) => dates.size >= LINEUP_MIN_SESSIONS)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([liftType]) => liftType);
  for (const liftType of topUps) {
    if (lineup.length >= LINEUP_SIZE) break;
    lineup.push(liftType);
  }
  return lineup;
}

function computeMonthlyBattleStats(parsedData, boundaries, lineup = []) {
  const nativeUnit = parsedData[0]?.unitType ?? "lb";
  const lineupSet = new Set(lineup);
  // Each row also tallies the variations that fed it, so the card can say
  // what is inside a number that no longer matches the lift's own page.
  const initRows = () =>
    Object.fromEntries(
      lineup.map((liftType) => [
        liftType,
        { current: 0, last: 0, lastSameDay: 0, sinceReturn: 0, variations: {} },
      ]),
    );

  let currentTonnage = 0;
  let lastTonnage = 0;
  let lastTonnageSameDay = 0;
  const currentDates = new Set();
  const lastDates = new Set();
  const lastDatesSameDay = new Set();
  let currentLineup = 0;
  let lastLineup = 0;
  let lastLineupSameDay = 0;
  const tonnageByLift = initRows();
  // Comeback mode measures pace on the work done since the return day.
  const returnDate = boundaries.comeback?.returnDate ?? null;
  const sinceReturnDates = new Set();
  let sinceReturnLineup = 0;

  for (const entry of parsedData) {
    if ((entry.reps ?? 0) < 1) continue;
    if (entry.unitType !== nativeUnit) continue;

    const tonnage = (entry.weight ?? 0) * (entry.reps ?? 0);
    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;
    const share = getRowShare(liftType, lineupSet);
    const rowTonnage = share ? tonnage * share.tonnageRatio : 0;
    const row = share ? tonnageByLift[share.liftType] : null;

    if (inCurrent) {
      currentTonnage += tonnage;
      currentDates.add(date);
      if (row) {
        currentLineup += rowTonnage;
        addRowTonnage(row, share, liftType, "current", rowTonnage);
      }
      if (returnDate && date >= returnDate) {
        sinceReturnDates.add(date);
        if (row) {
          sinceReturnLineup += rowTonnage;
          row.sinceReturn += rowTonnage;
        }
      }
    } else if (inLast) {
      lastTonnage += tonnage;
      lastDates.add(date);
      if (row) {
        lastLineup += rowTonnage;
        addRowTonnage(row, share, liftType, "last", rowTonnage);
      }
      if (date <= boundaries.prevMonthSameDayStr) {
        lastTonnageSameDay += tonnage;
        lastDatesSameDay.add(date);
        if (row) {
          lastLineupSameDay += rowTonnage;
          row.lastSameDay += rowTonnage;
        }
      }
    }
  }

  return {
    tonnage: {
      current: currentTonnage,
      last: lastTonnage,
      lastSameDay: lastTonnageSameDay,
    },
    sessions: {
      current: currentDates.size,
      last: lastDates.size,
      lastSameDay: lastDatesSameDay.size,
      sinceReturn: sinceReturnDates.size,
    },
    lineupTonnage: {
      current: currentLineup,
      last: lastLineup,
      lastSameDay: lastLineupSameDay,
      sinceReturn: sinceReturnLineup,
    },
    tonnageByLift,
    progressRatio: boundaries.dayOfMonth / boundaries.daysInPrevMonth,
    nativeUnit,
  };
}

// A set counts toward a Big Four row when it is the lift itself or a
// variation linked to it in the registry. A variation adds only its share of
// the tonnage, so a rack pull adds half: more weight, less distance.
// The lineup row a set counts toward, or null when it counts toward none.
function getRowShare(liftType, lineupSet) {
  const share = getBigFourShare(liftType);
  if (share) return lineupSet.has(share.liftType) ? share : null;
  return lineupSet.has(liftType)
    ? { liftType, tonnageRatio: 1, isVariation: false }
    : null;
}

function getBigFourShare(liftType) {
  if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
    return { liftType, tonnageRatio: 1, isVariation: false };
  }
  const parent = getBigFourParentLift(liftType);
  return parent ? { ...parent, isVariation: true } : null;
}

function addRowTonnage(row, share, liftType, monthKey, amount) {
  row[monthKey] += amount;
  if (!share.isVariation) return;
  row.variations[liftType] ??= {
    current: 0,
    last: 0,
    tonnageRatio: share.tonnageRatio,
  };
  row.variations[liftType][monthKey] += amount;
}

// ─── Strength level stats (per Big Four lift, best category hit) ───────────

function computeStrengthLevelStats(parsedData, boundaries, bio, lineup = []) {
  if (bio.bioDataIsDefault) return null;

  // Standards only exist for some lifts. A row without them is scored on
  // tonnage alone.
  const result = Object.fromEntries(
    lineup.map((liftType) => [
      liftType,
      {
        current: null,
        last: null,
        hasStandard: !!getStandardForLiftDate(
          bio.age,
          boundaries.todayStr,
          bio.bodyWeight,
          bio.sex,
          liftType,
          bio.isMetric,
          bio.bodyweightSeries,
        ),
      },
    ]),
  );

  for (const entry of parsedData) {
    const reps = entry.reps ?? 0;
    if (reps < 1) continue;
    if (!result[entry.liftType]?.hasStandard) continue;

    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;

    if (!inCurrent && !inLast) continue;

    // In the standard's unit (the display unit), not the unit it was logged in.
    const e1rm = estimateEntryE1RM(entry, undefined, unitTypeFor(bio.isMetric));
    const standard = getStandardForLiftDate(
      bio.age,
      date,
      bio.bodyWeight,
      bio.sex,
      liftType,
      bio.isMetric,
      bio.bodyweightSeries,
    );
    if (!standard) continue;
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
  for (const { current, last } of Object.values(strengthLevelStats)) {
    if (last === null) continue; // not trained last month — no regression possible
    if (isStrengthLevelRegressed(current, last)) {
      return { passed: false, skipped: false };
    }
  }
  return { passed: true, skipped: false };
}

// ─── Pace status ───────────────────────────────────────────────────────────

function getPaceStatus(current, last, progressRatio) {
  if (last === 0)
    return { status: "no-data", fillPct: 0, needed: 0, projected: 0 };
  const fillPct = Math.min(100, (current / last) * 100);
  const paceTarget = last * progressRatio;
  const pacePct = paceTarget > 0 ? current / paceTarget : 1;
  const status =
    pacePct >= 1.0 ? "ahead" : pacePct >= 0.85 ? "on-pace" : "behind";
  const projected = progressRatio > 0 ? current / progressRatio : current;
  return {
    status,
    fillPct,
    needed: Math.max(0, Math.round(last - current)),
    projected,
  };
}

// ─── Verdict ───────────────────────────────────────────────────────────────

// One row's tonnage check: true or false when there is a comparison to make,
// null when the row has nothing in either month and so nothing to score. A
// lift with no baseline counts as met the moment it is trained.
function getTonnageCheckPassed(lift, boundaries) {
  const current = lift?.current ?? 0;
  const last = lift?.last ?? 0;
  if (last === 0) return current > 0 ? true : null;
  if (boundaries?.isCurrentMonthView && boundaries.dayOfMonth > 0) {
    const ps = getMetricPaceStatus(lift, boundaries);
    return ps === "ahead" || ps === "on-pace";
  }
  return passesTonnageThreshold(current, last);
}

// The month is won with at most two checks missed, once the strength checks
// are in play. With the full nine that is the long-standing 7 of 9; shorter
// lineups keep the same allowance without letting a tiny scorecard win free.
function isChecksWin(checksSummary) {
  if (!checksSummary?.fullChecks) return false;
  const { checksMet, checksTotal } = checksSummary;
  // Sessions alone is not a scorecard.
  if (checksTotal < 2) return false;
  return (
    checksMet >= Math.max(checksTotal - 2, Math.ceil(checksTotal * 0.7), 1)
  );
}

function getVerdict(stats, strengthLevelPassed, boundaries) {
  const { sessions, lineupTonnage, tonnage, tonnageByLift } = stats;

  if (sessions.last === 0 && lineupTonnage.last === 0 && tonnage.last === 0) {
    return { label: "Writing History", emoji: "📖", won: false };
  }

  const primaryMet =
    getSessionsCheckPassed(sessions, boundaries) &&
    Object.values(tonnageByLift ?? {}).every(
      (lift) => getTonnageCheckPassed(lift, boundaries) !== false,
    );
  const strengthOK = strengthLevelPassed.skipped || strengthLevelPassed.passed;

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
  const monthPhase = getCurrentMonthPhase(boundaries);
  const phaseLabel = getMonthPhaseLabel(monthPhase, boundaries);
  const hasFullChecks = !!checksSummary?.fullChecks;
  const monthWon = hasFullChecks
    ? isChecksWin(checksSummary)
    : Boolean(verdict?.won);

  if (isPastMonthView) {
    if (verdict?.label === "Writing History") {
      return {
        tone: "neutral",
        text:
          pastMonthNoBaselineHeadline ||
          "No prior month to beat. Baseline set.",
        scoreText: checksText ? `${checksText} green` : null,
        phaseLabel,
      };
    }

    return {
      tone: monthWon ? "win" : "neutral",
      text: monthWon
        ? pastMonthWinHeadline || "Month Won ✅"
        : pastMonthLossHeadline || "Month Lost ❌",
      scoreText: checksText ? `${checksText} green` : null,
      phaseLabel,
    };
  }

  if (
    monthPhase === "last-week" &&
    hasFullChecks &&
    isChecksWin(checksSummary)
  ) {
    return {
      tone: "win",
      text: topTierPhrase || "Month Won ✅",
      scoreText: checksText ? `${checksText} green` : null,
      phaseLabel,
    };
  }

  if (monthPhase === "last-week" && verdict?.won) {
    return {
      tone: "win",
      text:
        verdict.label === "Month Crushed"
          ? topTierPhrase || "Month Won ✅"
          : "Month Won ✅",
      scoreText: checksText ? `${checksText} green` : null,
      phaseLabel,
    };
  }

  const onPace = (s) => s?.status === "ahead" || s?.status === "on-pace";
  const phraseSeed = `${boundaries?.todayStr || ""}:${checksText || ""}`;
  const currentMonthIsOnPace =
    verdict?.won || (onPace(sessionsPaceStatus) && onPace(bigFourPaceStatus));

  if (currentMonthIsOnPace) {
    const text = getCurrentMonthEncouragement({
      phase: monthPhase,
      onTrack: true,
      phraseSeed,
      comeback: !!boundaries?.comeback,
    });

    return {
      tone: "progress",
      text,
      scoreText: checksText ? `${checksText} green` : null,
      phaseLabel,
    };
  }

  const text = getCurrentMonthEncouragement({
    phase: monthPhase,
    onTrack: false,
    phraseSeed,
    comeback: !!boundaries?.comeback,
  });

  return {
    tone: "neutral",
    text,
    scoreText: checksText ? `${checksText} green` : null,
    phaseLabel,
  };
}

function getCurrentMonthPhase(boundaries) {
  if (!boundaries?.isCurrentMonthView) return "past";
  if (boundaries.dayOfMonth <= 7) return "first-week";
  // The first week back gets the same grace as week one, and for the same
  // reason: a few days in, the pace maths is noise.
  if (boundaries.comeback && boundaries.comeback.daysElapsed <= 7) {
    return "first-week";
  }
  if (boundaries.daysRemainingInCurrentMonth <= 7) return "last-week";
  return "middle";
}

// Short badge text giving temporal context, so the same verdict area reads
// differently depending on where the user is in the month.
function getMonthPhaseLabel(monthPhase, boundaries) {
  if (monthPhase === "past") {
    return boundaries?.currentMonthShortYear || "Past month";
  }
  const comeback = boundaries?.comeback;
  if (comeback && monthPhase !== "last-week") {
    return `Back since ${comeback.returnLabel}`;
  }
  if (monthPhase === "first-week") return "Week one";
  if (monthPhase === "last-week") {
    const days = boundaries?.daysRemainingInCurrentMonth ?? 0;
    return days <= 1 ? "Final day" : `${days} days left`;
  }
  return "Mid-month";
}

function getCurrentMonthEncouragement({
  phase,
  onTrack,
  phraseSeed,
  comeback = false,
}) {
  if (comeback && phase === "first-week") {
    return pickPhraseForMonth(
      onTrack ? COMEBACK_ON_TRACK_HEADLINES : COMEBACK_CATCH_UP_HEADLINES,
      phraseSeed,
    );
  }
  const phraseMap = {
    "first-week": onTrack
      ? EARLY_MONTH_ON_TRACK_HEADLINES
      : EARLY_MONTH_CATCH_UP_HEADLINES,
    middle: onTrack
      ? MID_MONTH_ON_TRACK_HEADLINES
      : MID_MONTH_CATCH_UP_HEADLINES,
    "last-week": onTrack
      ? LAST_WEEK_ON_TRACK_HEADLINES
      : LAST_WEEK_CATCH_UP_HEADLINES,
  };

  return pickPhraseForMonth(
    phraseMap[phase] || MID_MONTH_CATCH_UP_HEADLINES,
    phraseSeed,
  );
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
  return `${formatTonnageFigure(value)} ${unit}`;
}

// The number half of formatTonnage, split out so CountUp can tick the figure
// while the unit beside it stays still.
function formatTonnageFigure(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

// Variations that fed a row in one month, biggest first, as
// "1.1k kg Front Squat and 900 kg Rack Pull at 50%". Null when none did.
function describeVariations(variations, monthKey, unit) {
  const parts = getRowVariations(variations, monthKey).map(([name, tally]) => {
    const share =
      tally.tonnageRatio < 1
        ? ` at ${Math.round(tally.tonnageRatio * 100)}%`
        : "";
    return `${formatTonnageFigure(tally[monthKey])} ${unit} ${name}${share}`;
  });
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function getVariationNames(variations, monthKey) {
  const names = getRowVariations(variations, monthKey).map(([name]) => name);
  return names.length > 0 ? names.join(", ") : null;
}

function getRowVariations(variations, monthKey) {
  return Object.entries(variations ?? {})
    .filter(([, tally]) => tally[monthKey] > 0)
    .sort(([, a], [, b]) => b[monthKey] - a[monthKey]);
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

  if (getSessionsCheckPassed(stats.sessions, boundaries)) {
    checksMet += 1;
  }

  // A row with nothing to compare adds no check, so the score is out of
  // however many comparisons the month really holds.
  for (const lift of Object.values(stats.tonnageByLift ?? {})) {
    const passed = getTonnageCheckPassed(lift, boundaries);
    if (passed === null) continue;
    checksTotal += 1;
    if (passed) checksMet += 1;
  }

  for (const { current, last } of Object.values(strengthLevelStats ?? {})) {
    if (current === null && last === null) continue;
    checksTotal += 1;
    if (last === null || !isStrengthLevelRegressed(current, last)) {
      checksMet += 1;
    }
  }

  return { checksMet, checksTotal, fullChecks: !!strengthLevelStats };
}

function buildMonthCardPromptSummary({
  stats,
  strengthLevelStats,
  strengthSetupRequired,
  boundaries,
  unit,
  checksSummary,
  verdictHeadline,
}) {
  const lines = [
    `range=${boundaries.currentMonthStart}..${boundaries.todayStr}${boundaries.isCurrentMonthView ? " current_month" : " historical_month"}`,
    `comparison_month=${boundaries.prevMonthName} (${boundaries.prevMonthStart}..${boundaries.prevMonthEnd})`,
  ];

  if (!stats) return lines;

  if (boundaries.comeback) {
    const { returnDate, gapDays, daysInWindow } = boundaries.comeback;
    lines.push(
      `comeback=returned ${returnDate} after ${gapDays} days off; pace and score are measured from that day against the previous month's rate over the ${daysInWindow} days from the return to month end`,
    );
  }

  if (checksSummary) {
    lines.push(
      `score=${checksSummary.checksMet}/${checksSummary.checksTotal} green`,
    );
  }
  if (verdictHeadline?.text) {
    lines.push(`headline=${verdictHeadline.text}`);
  }

  lines.push(
    `sessions=current ${stats.sessions.current}, previous ${stats.sessions.last}, previous_same_day ${stats.sessions.lastSameDay}`,
  );
  lines.push(
    `total_tonnage=current ${formatTonnage(stats.tonnage.current, unit)}, previous ${formatTonnage(stats.tonnage.last, unit)}, previous_same_day ${formatTonnage(stats.tonnage.lastSameDay, unit)}`,
  );
  lines.push(
    `main_lifts_tonnage=current ${formatTonnage(stats.lineupTonnage.current, unit)}, previous ${formatTonnage(stats.lineupTonnage.last, unit)}, previous_same_day ${formatTonnage(stats.lineupTonnage.lastSameDay, unit)}`,
  );

  const liftRows = Object.keys(stats.tonnageByLift ?? {}).map((liftType) => {
    const tonnage = stats.tonnageByLift[liftType];
    const currentTonnage = tonnage.current ?? 0;
    const lastTonnage = tonnage.last ?? 0;
    const liftPaceStatus =
      boundaries.isCurrentMonthView && boundaries.dayOfMonth > 0
        ? getMetricPaceStatus(tonnage, boundaries)
        : "no-data";
    const tonnageBaseline = lastTonnage === 0;
    const tonnageNewWin = tonnageBaseline && currentTonnage > 0;
    const tonnagePassed = tonnageBaseline
      ? tonnageNewWin
      : boundaries.isCurrentMonthView
        ? liftPaceStatus === "ahead" || liftPaceStatus === "on-pace"
        : passesTonnageThreshold(currentTonnage, lastTonnage);
    const strength = strengthLevelStats?.[liftType] ?? {
      current: null,
      last: null,
    };
    // Without this the review could tell a lifter who front squatted all
    // month that they skipped squats.
    const includedNow = describeVariations(tonnage.variations, "current", unit);
    const includedBefore = describeVariations(tonnage.variations, "last", unit);
    const variationsText = [
      includedNow && ` (current includes ${includedNow})`,
      includedBefore && ` (previous includes ${includedBefore})`,
    ]
      .filter(Boolean)
      .join("");
    const currentStrength = formatPromptStrengthLevel(strength.current);
    const lastStrength = formatPromptStrengthLevel(strength.last);
    const strengthStatus = strengthSetupRequired
      ? "setup_required"
      : strength.last === null
        ? strength.current === null
          ? "no_baseline"
          : "new_baseline"
        : isStrengthLevelRegressed(strength.current, strength.last)
          ? "regressed"
          : "matched_or_better";

    return `${liftType}: tonnage current ${formatTonnage(currentTonnage, unit)}, previous ${formatTonnage(lastTonnage, unit)}${variationsText}, status ${tonnageBaseline && !tonnageNewWin ? "not_trained_either_month" : tonnagePassed ? "green" : "behind"}${liftPaceStatus !== "no-data" ? `/${liftPaceStatus}` : ""}; strength current ${currentStrength}, previous ${lastStrength}, status ${strengthStatus}`;
  });

  lines.push("main_lift_rows:");
  lines.push(...liftRows);

  return lines;
}

function formatPromptStrengthLevel(score) {
  const formatted = formatStrengthLevel(score);
  return formatted?.label || "none";
}

function getMonthlyRevealRowCount(stats) {
  if (!stats) return 0;
  return Object.keys(stats.tonnageByLift ?? {}).length + 1; // + sessions row
}

function getStrengthStatusTooltip({
  liftType,
  strengthLocked,
  strengthBaseline,
  strengthNewWin,
  strengthRegressed,
  strengthCurrent,
  strengthLast,
  strengthUnavailable = false,
}) {
  const liftLabel = formatLiftTypeLabel(liftType);

  if (strengthUnavailable) {
    return `${liftLabel} has no strength standards, so this row is scored on tonnage.`;
  }
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
  tonnagePending = false,
}) {
  const liftLabel = formatLiftTypeLabel(liftType).toLowerCase();

  if (tonnageBaseline && !tonnageNewWin) {
    return `No previous month ${liftLabel} tonnage to compare against.`;
  }
  if (tonnageNewWin) {
    return `First ${liftLabel} tonnage recorded this month — baseline set.`;
  }
  if (tonnagePending) {
    return `Early days. Plenty of month left to match last month's ${liftLabel} tonnage.`;
  }
  if (isCurrentMonthView && liftPaceStatus !== "no-data") {
    if (liftPaceStatus === "ahead")
      return `Ahead of expected ${liftLabel} pace for this point in the month.`;
    if (liftPaceStatus === "on-pace")
      return `Within 10% of expected ${liftLabel} pace — on track.`;
    return `Behind expected ${liftLabel} pace for this point in the month.`;
  }
  if (currentTonnage > lastTonnage)
    return `Passed previous month ${liftLabel} tonnage.`;
  if (tonnagePassed) return `Matched previous month ${liftLabel} tonnage.`;
  return `Below previous month ${liftLabel} tonnage.`;
}

function getStrengthLastColumnTooltip(boundaries, liftType) {
  return `${boundaries.prevMonthName} best ${formatLiftTypeLabel(liftType)} strength level hit across the full month.`;
}

function getTonnageLastColumnTooltip(liftType) {
  return `Previous month ${formatLiftTypeLabel(liftType).toLowerCase()} tonnage.`;
}

// ─── Big Four Criteria Table (Strength + Tonnage per lift) ────────────────

function BigFourCriteriaTable({
  sessions,
  upNextBestSets,
  tonnageByLift,
  strengthLevelStats,
  strengthSetupRequired = false,
  boundaries,
  unit,
  revealedRows = 0,
  hasComparisonMonth = true,
}) {
  const isCurrentMonthView = boundaries?.isCurrentMonthView;
  /*
   * In week one the pace maths is mostly noise: a lift trained once a week is
   * "behind" until the day it happens, and on the 2nd every row is. Painting
   * that red tells a lifter they are losing a month they have barely started
   * and can still win outright. So in week one a row that is not yet green
   * stays neutral, and red waits until there is a real gap to report.
   */
  const earlyDays = getCurrentMonthPhase(boundaries) === "first-week";
  // Every lift in the lineup gets a row. One with nothing in either month is
  // still part of the lifter's routine, so it shows as "Up next" rather than
  // dropping out and leaving the card a row short.
  const rows = Object.keys(tonnageByLift ?? {}).map((liftType) => ({
    liftType,
    tonnage: tonnageByLift[liftType],
    strength: strengthLevelStats?.[liftType] ?? { current: null, last: null },
  }));

  /*
   * In a month with no baseline, the Big Four lifts outside the lineup earn an
   * invitation row: that month is a fresh start, and the lifter working
   * through it should see the whole set rather than watch the other lifts
   * disappear the moment they log the first one.
   */
  const invitationRows = hasComparisonMonth
    ? []
    : BIG_FOUR_LIFT_TYPES.filter((liftType) => !tonnageByLift?.[liftType]).map(
        (liftType) => ({ liftType }),
      );

  if (rows.length === 0) {
    return (
      <BigFourInvitationPanel
        monthPhraseKey={boundaries?.currentMonthStart}
        hasSessionsThisMonth={(sessions?.current ?? 0) > 0}
        monthName={boundaries?.currentMonthName}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end" data-copy-exclude>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="border-border/40 bg-muted/30 flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={4}>
              <p className="max-w-52 text-center text-xs">
                <span className="text-emerald-500">●</span> Ahead of pace{"  "}
                <span className="text-amber-500">●</span> On track{"  "}
                <span className="text-red-500">●</span> Behind pace
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!!sessions &&
        (() => {
          const rowHighlighted = revealedRows >= 1;
          const isCurrentMonthView = boundaries?.isCurrentMonthView;
          const previousSessionsCompared = sessions.last ?? 0;
          const baseline = previousSessionsCompared === 0;
          const sessionPace = isCurrentMonthView
            ? getMetricPaceStatus(sessions, boundaries)
            : "no-data";
          const comebackGoal = getComebackGoal(sessions, boundaries);
          const sessionsGoal =
            comebackGoal === null
              ? previousSessionsCompared
              : Math.max(1, Math.round(comebackGoal));
          const goalSuffix =
            comebackGoal === null ? "" : ` · goal ${sessionsGoal}`;
          const passed =
            baseline ||
            (isCurrentMonthView
              ? sessionPace === "ahead" || sessionPace === "on-pace"
              : passesTonnageThreshold(
                  sessions.current ?? 0,
                  previousSessionsCompared,
                ));
          const currentSessionsReporting = formatCurrentSessionsReporting(
            sessions.current ?? 0,
            boundaries,
          );
          const currentMonthSuffix = isCurrentMonthView
            ? currentSessionsReporting.replace(`${sessions.current ?? 0} `, "")
            : null;
          const pending = earlyDays && !baseline && !passed;
          const rowBg =
            baseline || pending
              ? "bg-muted/20"
              : passed
                ? "bg-emerald-50/30 dark:bg-emerald-950/15"
                : "bg-red-50/30 dark:bg-red-950/15";
          const rightColor = baseline
            ? "text-muted-foreground"
            : passed
              ? "text-emerald-600 dark:text-emerald-400"
              : pending
                ? "text-foreground"
                : "text-red-600 dark:text-red-400";
          const revealRowBg = rowHighlighted ? rowBg : "bg-transparent";
          const revealRightColor = rowHighlighted
            ? rightColor
            : "text-foreground";

          return (
            <motion.div
              className={`border-border/25 grid grid-cols-[1fr_100px_1fr] items-start gap-2 rounded-md border px-2 py-1 transition-colors duration-500 ${revealRowBg}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right">
                      <CountUp
                        value={previousSessionsCompared}
                        format={formatCountUpInteger}
                        duration={MONTH_COUNT_UP_SECONDS}
                        className={`text-2xl font-semibold tracking-tight tabular-nums transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}
                      />
                      <div
                        className={`text-[10px] font-medium transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground/80" : "text-foreground/80"}`}
                      >
                        {boundaries.prevMonthName}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="max-w-56 text-center text-xs">
                      Total sessions logged in {boundaries.prevMonthName},
                      counted from unique training dates.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div
                className={`self-center text-center text-xs font-medium transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}
              >
                Sessions
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-left">
                      <div className="flex items-baseline gap-1">
                        <CountUp
                          value={sessions.current}
                          format={formatCountUpInteger}
                          duration={MONTH_COUNT_UP_SECONDS}
                          className={`text-2xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${revealRightColor}`}
                        />
                        {rowHighlighted && passed && !baseline && (
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-[10px] font-medium">
                        {boundaries.currentMonthName}
                        {currentMonthSuffix ? ` · ${currentMonthSuffix}` : ""}
                      </div>
                      {rowHighlighted && isCurrentMonthView && !baseline && (
                        <div
                          className={`text-[10px] font-medium ${
                            sessionPace === "ahead"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : sessionPace === "on-pace"
                                ? "text-amber-600 dark:text-amber-400"
                                : pending
                                  ? "text-muted-foreground"
                                  : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {sessionPace === "ahead"
                            ? "▲ Ahead of pace"
                            : sessionPace === "on-pace"
                              ? "→ On track"
                              : pending
                                ? "Early days"
                                : "▼ Behind pace"}
                          {goalSuffix}
                        </div>
                      )}
                      {rowHighlighted && !baseline && (
                        <div className="bg-muted/40 mt-1 h-1 w-full overflow-hidden rounded-full">
                          <motion.div
                            className={`h-full rounded-full ${passed ? "bg-emerald-500" : pending ? "bg-muted-foreground/40" : "bg-red-500"}`}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, ((sessions.current ?? 0) / sessionsGoal) * 100)}%`,
                            }}
                            transition={{
                              duration: 0.6,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="max-w-56 text-center text-xs">
                      {comebackGoal === null
                        ? `Compared with ${boundaries.prevMonthName}'s total of ${previousSessionsCompared}; being within 10% of pace counts as on track.`
                        : `You came back on ${boundaries.comeback.returnLabel}, so the goal is ${boundaries.prevMonthName}'s rate from that day to month end: ${sessionsGoal} sessions. Being within 10% of pace counts as on track.`}
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
        const liftPaceStatus =
          isCurrentMonthView && boundaries.dayOfMonth > 0
            ? getMetricPaceStatus(tonnage, boundaries)
            : "no-data";
        const comebackGoal = getComebackGoal(tonnage, boundaries);
        const tonnageGoal = comebackGoal ?? lastTonnage;
        const goalSuffix =
          comebackGoal === null
            ? ""
            : ` · goal ${formatTonnageFigure(comebackGoal)}`;
        const comebackTooltip =
          comebackGoal === null
            ? ""
            : ` You came back on ${boundaries.comeback.returnLabel}, so the goal is ${boundaries.prevMonthName}'s rate from that day to month end: ${formatTonnage(comebackGoal, unit)}.`;
        const tonnageBaseline = lastTonnage === 0;
        const tonnageNewWin = tonnageBaseline && currentTonnage > 0;
        const tonnagePassed = tonnageBaseline
          ? tonnageNewWin
          : isCurrentMonthView
            ? liftPaceStatus === "ahead" || liftPaceStatus === "on-pace"
            : passesTonnageThreshold(currentTonnage, lastTonnage);
        const tonnagePending = earlyDays && !tonnageBaseline && !tonnagePassed;
        const tonnageColor =
          tonnageBaseline && !tonnageNewWin
            ? "text-muted-foreground"
            : tonnageNewWin || tonnagePassed
              ? "text-emerald-600 dark:text-emerald-400"
              : tonnagePending
                ? "text-foreground"
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
        const strengthPending = earlyDays && !strengthPassed;
        const strengthColor = strengthLocked
          ? "text-muted-foreground"
          : strengthBaseline && !strengthNewWin
            ? "text-muted-foreground"
            : strengthNewWin || strengthPassed
              ? "text-emerald-600 dark:text-emerald-400"
              : strengthPending
                ? "text-muted-foreground"
                : "text-red-600 dark:text-red-400";
        const strengthBg =
          strengthLocked ||
          strengthPending ||
          (strengthBaseline && !strengthNewWin)
            ? "bg-muted/20"
            : strengthPassed
              ? "bg-emerald-50/30 dark:bg-emerald-950/15"
              : "bg-red-50/30 dark:bg-red-950/15";
        const tonnageBg =
          tonnagePending || (tonnageBaseline && !tonnageNewWin)
            ? "bg-muted/20"
            : tonnagePassed
              ? "bg-emerald-50/30 dark:bg-emerald-950/15"
              : "bg-red-50/30 dark:bg-red-950/15";
        const revealStrengthBg = rowHighlighted ? strengthBg : "bg-transparent";
        const revealTonnageBg = rowHighlighted ? tonnageBg : "bg-transparent";
        const revealStrengthColor = rowHighlighted
          ? strengthColor
          : "text-foreground";
        const revealTonnageColor = rowHighlighted
          ? tonnageColor
          : "text-foreground";

        const strengthStatusTooltip = getStrengthStatusTooltip({
          liftType,
          strengthLocked,
          strengthBaseline,
          strengthNewWin,
          strengthRegressed,
          strengthCurrent: strength.current,
          strengthLast: strength.last,
          strengthUnavailable: strength.hasStandard === false,
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
          tonnagePending,
        });
        const lastVariations = describeVariations(
          tonnage.variations,
          "last",
          unit,
        );
        const currentVariations = describeVariations(
          tonnage.variations,
          "current",
          unit,
        );
        const currentVariationNames = getVariationNames(
          tonnage.variations,
          "current",
        );
        const tonnageLastTooltip = lastVariations
          ? `${getTonnageLastColumnTooltip(liftType)} Includes ${lastVariations}.`
          : getTonnageLastColumnTooltip(liftType);
        const liftInsightHref = getLiftDetailUrl(liftType);
        // Week one, lift not trained yet: one quiet "Up next" cell with last
        // month's best set stands in for "Still to come", "0 kg lifted" and
        // "Early days", which read as three ways of saying nothing.
        const showUpNext =
          currentTonnage === 0 && (lastTonnage === 0 || earlyDays);
        const RowLink = liftInsightHref ? Link : "div";

        return (
          <motion.div
            key={liftType}
            className="border-border/25 grid grid-cols-[1fr_100px_1fr] grid-rows-2 items-center gap-x-2 gap-y-0.5 rounded-md border px-2 py-1.5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover="hover"
            transition={{
              duration: 0.35,
              delay: 0.08 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div
              className={`rounded-sm px-1.5 py-0.5 text-right transition-colors duration-500 ${revealStrengthBg}`}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs">
                      {strengthLocked ? (
                        <span
                          className={
                            rowHighlighted
                              ? "text-muted-foreground/70"
                              : "text-foreground"
                          }
                        >
                          Locked
                        </span>
                      ) : lastStrengthFmt ? (
                        <span
                          className={`bg-muted/60 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${rowHighlighted ? "text-muted-foreground" : "text-foreground"}`}
                        >
                          {lastStrengthFmt.emoji} {lastStrengthFmt.label}
                        </span>
                      ) : (
                        <span
                          className={
                            rowHighlighted
                              ? "text-muted-foreground/40"
                              : "text-foreground"
                          }
                        >
                          —
                        </span>
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

            <RowLink
              {...(liftInsightHref ? { href: liftInsightHref } : {})}
              className="focus-visible:ring-ring row-span-2 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <motion.div
                className="flex flex-col items-center justify-center gap-1"
                variants={{
                  hover: { scale: 1.06, y: -1 },
                }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <div
                  className={`rounded-full p-1.5 ring-1 transition-colors duration-500 ${
                    !rowHighlighted
                      ? "bg-muted/10 ring-border/40"
                      : tonnagePassed || tonnageNewWin
                        ? "bg-emerald-500/10 ring-emerald-500/40"
                        : tonnageBaseline || tonnagePending
                          ? "bg-muted/10 ring-border/40"
                          : "bg-red-500/10 ring-red-500/40"
                  }`}
                >
                  {getLiftArtwork(liftType) ? (
                    <LiftArtwork
                      liftType={liftType}
                      size="sm"
                      animate={false}
                      className="h-16 w-16"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-16 w-16 items-center justify-center text-lg font-semibold">
                      {getLiftInitials(liftType)}
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] transition-colors duration-500 ${rowHighlighted ? "text-muted-foreground/80" : "text-foreground/80"}`}
                >
                  {formatLiftTypeLabel(liftType)}
                </span>
              </motion.div>
            </RowLink>

            {showUpNext && lastTonnage === 0 ? (
              <IdleLiftCell lastDate={upNextBestSets?.[liftType]?.lastDate} />
            ) : showUpNext ? (
              <UpNextCell
                best={upNextBestSets?.[liftType]}
                prevMonthName={boundaries.prevMonthName}
              />
            ) : (
              <div
                className={`rounded-sm px-1.5 py-0.5 text-left transition-colors duration-500 ${revealStrengthBg}`}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs font-medium">
                        {strengthLocked ? (
                          <span className={revealStrengthColor}>
                            Setup required
                          </span>
                        ) : currentStrengthFmt ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors duration-500 ${
                              rowHighlighted
                                ? strengthPassed || strengthNewWin
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : strengthPending
                                    ? "bg-muted/60 text-foreground"
                                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                                : "bg-muted/60 text-foreground"
                            }`}
                          >
                            {currentStrengthFmt.emoji}{" "}
                            {currentStrengthFmt.label}
                          </span>
                        ) : (
                          <span className={revealStrengthColor}>
                            {strength.last === null
                              ? "—"
                              : strengthPending
                                ? "Still to come"
                                : "Not trained"}
                          </span>
                        )}
                        {rowHighlighted &&
                          !strengthLocked &&
                          strengthPassed &&
                          (strengthNewWin || !strengthBaseline) && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ✓
                            </span>
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
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`rounded-sm px-1.5 py-0.5 text-right transition-colors duration-500 ${revealTonnageBg}`}
                  >
                    <div
                      className={`text-xs transition-colors duration-500 ${revealTonnageColor}`}
                    >
                      <span
                        className={
                          rowHighlighted
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        <CountUp
                          value={tonnage.last ?? 0}
                          format={formatTonnageFigure}
                          duration={MONTH_COUNT_UP_SECONDS}
                        />{" "}
                        {unit} lifted
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

            {!showUpNext && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`rounded-sm px-1.5 py-0.5 text-left transition-colors duration-500 ${revealTonnageBg}`}
                    >
                      <div
                        className={`flex items-center gap-1 text-xs font-semibold transition-colors duration-500 ${revealTonnageColor}`}
                      >
                        <span>
                          <CountUp
                            value={currentTonnage}
                            format={formatTonnageFigure}
                            duration={MONTH_COUNT_UP_SECONDS}
                          />{" "}
                          {unit} lifted
                        </span>
                        {rowHighlighted && (tonnagePassed || tonnageNewWin) && (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ✓
                          </span>
                        )}
                      </div>
                      {rowHighlighted &&
                        isCurrentMonthView &&
                        liftPaceStatus !== "no-data" && (
                          <div
                            className={`text-[10px] font-medium ${
                              liftPaceStatus === "ahead"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : liftPaceStatus === "on-pace"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : tonnagePending
                                    ? "text-muted-foreground"
                                    : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {liftPaceStatus === "ahead"
                              ? "▲ Ahead of pace"
                              : liftPaceStatus === "on-pace"
                                ? "→ On track"
                                : tonnagePending
                                  ? "Early days"
                                  : "▼ Behind pace"}
                            {goalSuffix}
                          </div>
                        )}
                      {rowHighlighted && currentVariationNames && (
                        <div className="text-muted-foreground text-[10px]">
                          Includes {currentVariationNames}
                        </div>
                      )}
                      {rowHighlighted && !tonnageBaseline && (
                        <div className="bg-muted/40 mt-1 h-1 w-full overflow-hidden rounded-full">
                          <motion.div
                            className={`h-full rounded-full ${
                              tonnagePassed
                                ? "bg-emerald-500"
                                : tonnagePending
                                  ? "bg-muted-foreground/40"
                                  : "bg-red-500"
                            }`}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, (currentTonnage / tonnageGoal) * 100)}%`,
                            }}
                            transition={{
                              duration: 0.6,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="max-w-56 text-center text-xs">
                      {tonnageStatusTooltip}
                      {comebackTooltip}
                      {currentVariations && ` Includes ${currentVariations}.`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </motion.div>
        );
      })}

      {invitationRows.length > 0 && (
        <div className="space-y-2 pt-1">
          {invitationRows.map(({ liftType }, i) => (
            <BigFourInvitationRow
              key={liftType}
              liftType={liftType}
              index={i}
            />
          ))}
        </div>
      )}

      <div className="space-y-1 pt-0.5">
        <AthleteBioInlineSettings
          forceStackedControls
          defaultBioPrompt="Enter your details to unlock this feature."
        />
      </div>
    </div>
  );
}

// The right-hand side of a Big Four row in week one before the lift has been
// trained: what's next, and last month's best set as something to aim at.
// Spans both rows so the comparison grid keeps its shape.
function UpNextCell({ best, prevMonthName }) {
  const { isMetric } = useAthleteBio();
  const bestSet = best?.set ?? null;
  const display = bestSet ? getDisplayWeight(bestSet, isMetric) : null;
  return (
    <div className="bg-muted/20 row-span-2 flex flex-col justify-center rounded-sm px-1.5 py-1 text-left">
      <p className="text-foreground text-xs font-semibold">Up next</p>
      {display && (
        <p className="text-muted-foreground text-[11px] leading-snug">
          {prevMonthName}&apos;s best{" "}
          <span className="text-foreground font-medium tabular-nums">
            {bestSet.reps}@{display.value}
            {display.unit}
          </span>
        </p>
      )}
    </div>
  );
}

// The right-hand side of a lineup row with nothing in either month. It states
// when the lift was last trained and stops there: saying what to do next is
// The Week in Iron's job, and this card only keeps the month's score.
function IdleLiftCell({ lastDate }) {
  const date = parseIsoDate(lastDate);
  return (
    <div className="bg-muted/20 row-span-2 flex flex-col justify-center rounded-sm px-1.5 py-1 text-left">
      <p className="text-muted-foreground text-xs font-medium">Last trained</p>
      {date && (
        <p className="text-foreground text-xs font-semibold tabular-nums">
          {format(date, "MMM d")}
        </p>
      )}
    </div>
  );
}

// Initials for a lift we have no drawing of, so its row still has a face.
function getLiftInitials(liftType) {
  return String(liftType ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

// The set to aim at for each lineup lift: last month's best by estimated
// one-rep max in real load (so a heavy triple can beat a lighter single), or
// the best of the two months before when last month has none.
function getUpNextBestSets(parsedData, boundaries, lineup = []) {
  const windowStart = getLineupWindowStart(boundaries);
  if (!Array.isArray(parsedData) || !boundaries?.prevMonthStart) return {};
  const lineupSet = new Set(lineup);
  const bestLastMonth = {};
  const bestRecent = {};
  const lastDates = {};
  const keepBest = (best, entry, e1rmKg) => {
    if (!best[entry.liftType] || e1rmKg > best[entry.liftType].e1rmKg) {
      best[entry.liftType] = { e1rmKg, set: entry };
    }
  };
  for (const entry of parsedData) {
    if (!entry.date || !lineupSet.has(entry.liftType)) continue;
    if (entry.date < windowStart || entry.date > boundaries.prevMonthEnd) {
      continue;
    }
    if (!(entry.reps >= 1) || !(entry.weight > 0)) continue;
    const e1rmKg = toKg(
      estimateE1RM(entry.reps, entry.weight, "Brzycki"),
      entry.unitType,
    );
    keepBest(bestRecent, entry, e1rmKg);
    if (!(lastDates[entry.liftType] >= entry.date)) {
      lastDates[entry.liftType] = entry.date;
    }
    if (entry.date >= boundaries.prevMonthStart) {
      keepBest(bestLastMonth, entry, e1rmKg);
    }
  }
  return Object.fromEntries(
    lineup
      .filter((liftType) => bestRecent[liftType])
      .map((liftType) => [
        liftType,
        bestLastMonth[liftType]
          ? { set: bestLastMonth[liftType].set, fromLastMonth: true }
          : {
              set: bestRecent[liftType].set,
              fromLastMonth: false,
              lastDate: lastDates[liftType],
            },
      ]),
  );
}

// ─── Big Four invitation (nothing to compare in either month) ──────────────

/*
 * Shown in place of the comparison table when neither this month nor last
 * month has a Big Four lift to score. That is almost always a lifter with real
 * history who has been away a while, and the honest reading of their data is
 * an empty table, so the card stops scoring and says something useful instead:
 * the four lifts, and what each one gives the body.
 *
 * Deliberately says nothing about the time away. Counting the weeks would be
 * accurate and would also be the reason to close the tab. The four lifts are a
 * better argument than any number we could put here.
 */
function BigFourInvitationPanel({
  monthPhraseKey,
  hasSessionsThisMonth = false,
  monthName,
}) {
  const headline = pickPhraseForMonth(
    hasSessionsThisMonth
      ? BIG_FOUR_INVITATION_PARTIAL_HEADLINES
      : BIG_FOUR_INVITATION_HEADLINES,
    monthPhraseKey,
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-muted-foreground text-sm">{headline}</p>

      <div className="space-y-2">
        {BIG_FOUR_LIFT_TYPES.map((liftType, index) => (
          <BigFourInvitationRow
            key={liftType}
            liftType={liftType}
            index={index}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/log?source=month-card-invitation">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Log any lift
          </Link>
        </Button>
        <p className="text-muted-foreground text-xs">
          One session puts {monthName || "this month"} on the board.
        </p>
      </div>
    </div>
  );
}

/*
 * One lift as an invitation rather than a score: the illustration in the same
 * ringed circle the comparison column uses, and what the lift gives the body.
 *
 * Used both for the full panel and, once a lifter is part way through a
 * no-baseline month, for the lifts they have not trained yet. Keeping them in
 * the list means the set stays whole and visibly fills in, rather than three
 * quarters of the card vanishing as a reward for coming back.
 */
function BigFourInvitationRow({ liftType, index = 0 }) {
  const copy = getBigFourBodyBenefit(liftType);
  if (!copy) return null;
  const href = getLiftDetailUrl(liftType);

  return (
    <motion.div
      className="border-border/40 bg-muted/10 flex items-start gap-3 rounded-lg border px-2.5 py-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: 0.06 * index,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={href}
        className="focus-visible:ring-ring shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <motion.div
          className="bg-muted/10 ring-border/40 rounded-full p-1.5 ring-1"
          whileHover={{ scale: 1.06, y: -1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <LiftArtwork
            liftType={liftType}
            size="sm"
            animate={false}
            className="h-14 w-14"
          />
        </motion.div>
      </Link>
      <div className="min-w-0">
        <Link
          href={href}
          className="text-foreground text-sm font-semibold hover:underline"
        >
          {liftType}
        </Link>
        <p className="text-muted-foreground/80 text-[11px] font-medium">
          {copy.tagline}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {copy.benefit}
        </p>
      </div>
    </motion.div>
  );
}
