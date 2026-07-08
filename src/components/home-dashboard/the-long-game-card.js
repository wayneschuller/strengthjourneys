/**
 * Long Game card coordinates the dashboard heatmap experience while delegated
 * modules render specific views and build their training activity data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { devLog, logTiming } from "@/lib/processing-utils";
import {
  gaEvent,
  GA_EVENT_TAGS,
  gaTrackHomeImportNudge,
} from "@/lib/analytics";
import { MiniFeedbackWidget } from "@/components/feedback";
import { ShareCopyButton } from "@/components/share-copy-button";
import { LiftResultCopyButton } from "@/components/lift-result-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  LOCAL_STORAGE_KEYS,
  getSheetScopedStorageKey,
} from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollToLatestYear } from "@/hooks/use-scroll-to-latest-year";
import { StreaksLeaderboard } from "@/components/home-dashboard/streaks-leaderboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  copyElementImageToClipboard,
  copyFullLongGameCardImageFast,
  copyYearHeatmapImageFast,
} from "@/components/home-dashboard/long-game/long-game-share-utils";
import {
  findTrainingHistoryDateBounds,
  getTrainingHistoryTitleOptions,
  getVisibleTrainingDateRanges,
} from "@/components/home-dashboard/long-game/long-game-training-activity";
import { ConsistencyGradesRow } from "@/components/home-dashboard/long-game/consistency-grades-row";
import { MemoizedDailyTrainingHeatmap } from "@/components/home-dashboard/long-game/daily-training-heatmap";
import {
  FirstMonthLongGameState,
  LongGameImportNudge,
  StarterLongGameState,
} from "@/components/home-dashboard/long-game/long-game-starter-states";
import { MonthlyTrainingPatternGrid } from "@/components/home-dashboard/long-game/monthly-training-pattern-grid";
import { WeeklyTrainingPatternGrid } from "@/components/home-dashboard/long-game/weekly-training-pattern-grid";

const LONG_GAME_YEAR_LABEL_WIDTH = 48;

/**
 * Main card showing the user's full training history as heatmaps, with PR-weighted color intensity.
 * Supports three view modes — daily (one calendar grid per year), weekly (53-column grid across all
 * years), and monthly (12-column grid across all years) — persisted to localStorage. Also renders
 * consistency grade rings and a share button that captures the card to clipboard via html2canvas.
 * Reads parsedData from UserLiftingDataProvider; takes no props.
 */
export function TheLongGameCard({
  dashboardStage = "established",
  dataMaturityStage: stageFromParent = null,
  sessionCount: sessionCountFromParent = null,
}) {
  const {
    parsedData,
    isLoading,
    sheetInfo,
    streakLeaderboard,
    isImportedData,
  } = useUserLiftingData();
  const [intervals, setIntervals] = useState(null);
  const shareRef = useRef(null);
  const dailyHeatmapScrollRef = useRef(null);
  const yearRowRefs = useRef({});
  const yearShareTimerRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingYear, setSharingYear] = useState(null);
  const [sharedYear, setSharedYear] = useState(null);
  const trackedImportNudgeKeyRef = useRef(null);
  const { isSuccess: isShareSuccess, triggerSuccess: triggerShareSuccess } =
    useTransientSuccess();
  // SSR default = first stage-1 title; randomised client-side once intervals load
  const [cardTitle, setCardTitle] = useState(
    getTrainingHistoryTitleOptions(1)[0],
  );
  const sessionCount = useMemo(() => {
    if (typeof sessionCountFromParent === "number")
      return sessionCountFromParent;
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

  // initializeWithValue: false → SSR renders "daily" (default), client hydrates from localStorage on mount
  // Keep the heatmap mode scoped to the linked sheet. A new or switched sheet
  // should start from its own sane default ("daily"), not inherit an old
  // lifter's mature-history preference from another dataset.
  const [viewMode, setViewMode] = useLocalStorage(
    getSheetScopedStorageKey(
      LOCAL_STORAGE_KEYS.HEATMAP_VIEW_MODE,
      sheetInfo?.ssid,
    ),
    "daily",
    { initializeWithValue: false },
  );
  const isFirstWeekIntroState =
    dashboardStage === "starter_sample" || dashboardStage === "first_real_week";
  const isFirstMonthFocusState = dashboardStage === "first_month";
  const canShareHeatmaps = dashboardStage === "established";
  const showWeeklyToggle =
    (dashboardStage === "early_base" || dashboardStage === "established") &&
    intervals?.length > 2;
  const showMonthlyToggle =
    dashboardStage === "established" && intervals?.length >= 5;
  const showStreaksToggle =
    dashboardStage === "established" &&
    Array.isArray(streakLeaderboard) &&
    streakLeaderboard.length >= 1;
  const showImportMergeNudge =
    !isSharing &&
    !isImportedData &&
    dashboardStage !== "starter_sample" &&
    dashboardStage !== "first_real_week" &&
    dashboardStage !== "established";
  const effectiveViewMode = useMemo(() => {
    if (dashboardStage === "starter_sample") return "daily";
    if (dashboardStage === "first_real_week") return "daily";
    if (dashboardStage === "first_month") return "daily";
    // Fall back to daily when the persisted choice is no longer available
    if (viewMode === "weekly" && !showWeeklyToggle) return "daily";
    if (viewMode === "monthly" && !showMonthlyToggle) return "daily";
    if (viewMode === "streaks" && !showStreaksToggle) return "daily";
    return viewMode;
  }, [
    dashboardStage,
    viewMode,
    showWeeklyToggle,
    showMonthlyToggle,
    showStreaksToggle,
  ]);

  // FIXME: I think we have the skills to not need this useEffect anymore
  useEffect(() => {
    if (isLoading) return;
    if (!parsedData || parsedData.length === 0) return;

    // Generate heatmap stuff
    const { startDate: nextStartDate, endDate: nextEndDate } =
      findTrainingHistoryDateBounds(parsedData);
    const intervals = getVisibleTrainingDateRanges({
      startDate: nextStartDate,
      endDate: nextEndDate,
      dashboardStage,
    });

    // devLog(`Heatmaps: setting intervals:`);
    // devLog(intervals);

    setIntervals(intervals); // intervals is the trigger for showing the heatmaps

    // Randomise card title based on training history length (client-side only)
    const titles = getTrainingHistoryTitleOptions(intervals.length);
    setCardTitle(titles[Math.floor(Math.random() * titles.length)]);
  }, [isLoading, parsedData, dashboardStage]);

  useEffect(() => {
    return () => {
      if (yearShareTimerRef.current) {
        clearTimeout(yearShareTimerRef.current);
      }
    };
  }, []);

  useScrollToLatestYear(
    dailyHeatmapScrollRef,
    intervals?.[intervals.length - 1]?.endDate ?? null,
    !!intervals && !isSharing && effectiveViewMode === "daily",
  );

  useEffect(() => {
    if (!showImportMergeNudge) return;
    const trackingKey = `${sheetInfo?.ssid || "no-sheet"}:${dashboardStage}`;
    if (trackedImportNudgeKeyRef.current === trackingKey) return;
    gaTrackHomeImportNudge({
      action: "impression",
      surface: "long_game_card",
      dashboardStage,
      sessionCount,
    });
    trackedImportNudgeKeyRef.current = trackingKey;
  }, [showImportMergeNudge, sheetInfo?.ssid, dashboardStage, sessionCount]);

  // if (!parsedData || parsedData.length === 0) { return null; }

  const handleCopyFullHeatmapImage = async () => {
    const startTime = performance.now();
    setIsSharing(true);
    // Wait a couple of frames so capture-mode layout/animation state has settled before sampling bounds.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    try {
      if (shareRef.current) {
        devLog("[heatmap-copy][full] share start");
        const usedFastPath = await copyFullLongGameCardImageFast({
          shareRef,
          viewMode,
          dateRanges: intervals,
          yearRowRefs,
        });
        if (!usedFastPath) {
          devLog("[heatmap-copy][full] using html2canvas fallback");
          const fallbackStart = performance.now();
          // Capture at devicePixelRatio (capped at 3) so weekly/monthly/streaks
          // exports look crisp on hi-DPI screens. Default html2canvas scale=1
          // produced visibly blurry month tiles.
          const exportScale = Math.max(
            2,
            Math.min(3, window.devicePixelRatio || 1),
          );
          // Keep copied image deterministic via `data-capture="light"` CSS contract.
          await copyElementImageToClipboard(
            shareRef.current,
            (element) =>
              element.id === "ignoreCopy" ||
              element.dataset.shareIgnore === "true",
            { scale: exportScale },
          );
          devLog(
            `[heatmap-copy][full] fallback total: ${Math.round(performance.now() - fallbackStart)}ms (scale=${exportScale})`,
          );
        }
        console.log("Heatmap copied to clipboard");
        gaEvent(GA_EVENT_TAGS.HEATMAP_SHARE_CLIPBOARD, {
          page: "/lift-explorer",
        });
      }

      devLog(
        `[heatmap-copy][full] handleShare total: ${Math.round(performance.now() - startTime)}ms`,
      );
      logTiming("html2canvas", performance.now() - startTime);
      triggerShareSuccess();
    } catch (err) {
      console.error("Error in copying heatmap: ", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyYearHeatmapImage = useCallback(async (year) => {
    const yearNode = yearRowRefs.current[year];
    if (!yearNode) return;

    const copyYearStart = performance.now();
    setSharingYear(year);
    try {
      const rowRect = yearNode.getBoundingClientRect();
      const heatmap = yearNode.querySelector(".react-calendar-heatmap");
      const heatmapRect = heatmap?.getBoundingClientRect();
      const captureWidth =
        heatmapRect && rowRect
          ? Math.ceil(Math.max(0, heatmapRect.right - rowRect.left))
          : undefined;
      const usedFastPath = await copyYearHeatmapImageFast(yearNode, year);
      if (!usedFastPath) {
        const fallbackStart = performance.now();
        await copyElementImageToClipboard(
          yearNode,
          (element) =>
            element.id === "ignoreCopy" ||
            element.dataset.shareIgnore === "true",
          captureWidth
            ? {
                width: captureWidth,
                height: Math.ceil(rowRect.height),
              }
            : undefined,
        );
        devLog(
          `[heatmap-copy][${year}] fallback html2canvas: ${Math.round(performance.now() - fallbackStart)}ms`,
        );
      }
      devLog(
        `[heatmap-copy][${year}] total copy: ${Math.round(performance.now() - copyYearStart)}ms`,
      );
      setSharedYear(year);
      if (yearShareTimerRef.current) clearTimeout(yearShareTimerRef.current);
      yearShareTimerRef.current = setTimeout(() => {
        setSharedYear(null);
        yearShareTimerRef.current = null;
      }, 1600);
      gaEvent(GA_EVENT_TAGS.HEATMAP_SHARE_CLIPBOARD, {
        page: "/lift-explorer",
        scope: "daily_year",
        year,
      });
    } catch (error) {
      console.error(`Error in copying ${year} heatmap: `, error);
    } finally {
      setSharingYear(null);
    }
  }, []);

  return (
    <div className="relative h-full">
      <Card
        ref={shareRef}
        className="flex h-full flex-col"
        // Keep copy output stable across themes: capture mode is driven by a
        // single CSS contract in globals.css (`[data-capture="light"]`).
        data-capture={isSharing ? "light" : undefined}
        style={
          isSharing
            ? {
                maxWidth: "800px",
                width: "100%",
              }
            : undefined
        }
      >
        <CardHeader data-share-section="header">
          <CardTitle>
            <span data-share-title="true">
              {isFirstWeekIntroState
                ? "The Long Game Starts Here"
                : dataMaturityStage === "no_sessions"
                  ? "The Long Game Starts Here"
                  : cardTitle}
            </span>
          </CardTitle>
          {isFirstWeekIntroState ? (
            <CardDescription>
              <span data-share-description="true">
                Every training day adds another square to your map.
              </span>
            </CardDescription>
          ) : dataMaturityStage === "no_sessions" ? (
            <CardDescription>
              <span data-share-description="true">
                Your heatmap will light up as soon as you log your first
                session.
              </span>
            </CardDescription>
          ) : (
            intervals && (
              <CardDescription>
                <span data-share-description="true">
                  {dataMaturityStage !== "mature" && "Your journey has begun. "}
                  {dashboardStage === "starter_sample"
                    ? "A close-up of your first training days."
                    : dashboardStage === "first_real_week"
                      ? "A close-up of your first weeks under the bar."
                      : dashboardStage === "first_month"
                        ? "A close-up of your first months of training."
                        : `Your strength journey from ${new Date(intervals[0].startDate).getFullYear()} - ${new Date(
                            intervals[intervals.length - 1].endDate,
                          ).getFullYear()}.`}
                </span>
              </CardDescription>
            )
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {isFirstWeekIntroState && (
            <StarterLongGameState
              parsedData={parsedData}
              sessionCount={sessionCount}
            />
          )}
          {!intervals &&
            !isFirstWeekIntroState &&
            dataMaturityStage !== "no_sessions" && (
              <Skeleton className="h-64 w-11/12 flex-1" />
            )}
          {!intervals &&
            !isFirstWeekIntroState &&
            dataMaturityStage === "no_sessions" && (
              <div className="bg-muted/20 flex h-64 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
                <p className="text-muted-foreground text-sm">
                  Your first training day is the first pixel in this map. Keep
                  showing up and the pattern builds.
                </p>
              </div>
            )}
          {intervals && !isFirstWeekIntroState && (
            <>
              {/* Consistency grade rings — always included in capture output */}
              {!isFirstMonthFocusState && (
                <>
                  <div className="mb-3" data-share-section="consistency">
                    {isSharing ? (
                      <div className="flex w-full items-start">
                        <div
                          className="shrink-0"
                          style={{ width: LONG_GAME_YEAR_LABEL_WIDTH }}
                        />
                        <div className="min-w-0 flex-1">
                          <ConsistencyGradesRow
                            parsedData={parsedData}
                            isVisible={!!intervals}
                            isCaptureMode={isSharing}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <ConsistencyGradesRow
                          parsedData={parsedData}
                          isVisible={!!intervals}
                          isCaptureMode={isSharing}
                        />
                      </div>
                    )}
                  </div>
                  {!isSharing && <hr className="border-border/60 mb-2" />}
                </>
              )}
              {/* View selector — right-justified, anchored just above the heatmap grid */}
              {!isSharing &&
                !isFirstMonthFocusState &&
                (showWeeklyToggle ||
                  showMonthlyToggle ||
                  showStreaksToggle) && (
                  <div className="mb-2 flex justify-end">
                    <div className="border-border/40 flex flex-row rounded border p-px text-[10px]">
                      {[
                        { key: "daily", label: "Daily" },
                        ...(showWeeklyToggle
                          ? [{ key: "weekly", label: "Weekly" }]
                          : []),
                        ...(showMonthlyToggle
                          ? [{ key: "monthly", label: "Monthly" }]
                          : []),
                        ...(showStreaksToggle
                          ? [{ key: "streaks", label: "Streaks" }]
                          : []),
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`rounded px-1.5 py-px transition-colors ${
                            effectiveViewMode === key
                              ? "bg-muted text-foreground/90 font-medium"
                              : "text-muted-foreground/40 hover:text-muted-foreground/70"
                          }`}
                          onClick={() => setViewMode(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              {isFirstMonthFocusState && (
                <FirstMonthLongGameState parsedData={parsedData} />
              )}
              {!isFirstMonthFocusState && effectiveViewMode === "daily" && (
                <div
                  ref={dailyHeatmapScrollRef}
                  className={
                    isSharing
                      ? ""
                      : dashboardStage === "starter_sample" ||
                          dashboardStage === "first_real_week" ||
                          dashboardStage === "first_month"
                        ? ""
                        : "max-h-[39vh] overflow-y-auto pr-1"
                  }
                >
                  <div className="flex flex-col gap-2">
                    {intervals.map((interval, index) => {
                      const year = new Date(interval.startDate).getFullYear();
                      const isCurrentYear = year === new Date().getFullYear();
                      return (
                        <div
                          key={`${index}-heatmap`}
                          ref={(node) => {
                            if (node) yearRowRefs.current[year] = node;
                            else delete yearRowRefs.current[year];
                          }}
                          className={`group relative flex w-full items-start px-1 py-1 ${
                            isCurrentYear ? "" : "opacity-80"
                          }`}
                        >
                          <div
                            className="shrink-0 pt-1 pr-3 text-right text-xs lg:text-sm"
                            style={{ width: LONG_GAME_YEAR_LABEL_WIDTH }}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span
                                data-year-label="true"
                                className={
                                  isCurrentYear
                                    ? "text-foreground text-[13px] font-semibold tabular-nums lg:text-sm"
                                    : "text-muted-foreground/70 tabular-nums"
                                }
                              >
                                {year}
                              </span>
                              {isCurrentYear &&
                                !isSharing &&
                                !interval?.label && (
                                  <span className="text-muted-foreground/60 text-[9px] leading-none">
                                    now
                                  </span>
                                )}
                              {interval?.label && !isSharing && (
                                <span className="text-muted-foreground/60 max-w-[4.5rem] text-right text-[9px] leading-none">
                                  {interval.label}
                                </span>
                              )}
                              {!isSharing &&
                                canShareHeatmaps &&
                                intervals.length > 1 && (
                                  <LiftResultCopyButton
                                    label={`Copy ${year} heatmap`}
                                    tooltip={`Copy ${year} heatmap`}
                                    onCopy={() =>
                                      handleCopyYearHeatmapImage(year)
                                    }
                                    isLoading={sharingYear === year}
                                    isSuccess={sharedYear === year}
                                    disabled={sharingYear === year}
                                    data-share-ignore="true"
                                    className="text-muted-foreground/50 hover:text-foreground h-6 w-6"
                                  />
                                )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <MemoizedDailyTrainingHeatmap
                              parsedData={parsedData}
                              startDate={interval.startDate}
                              endDate={interval.endDate}
                              isSharing={isSharing}
                              showMonthLabels={!interval?.isFocused}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!isFirstMonthFocusState && effectiveViewMode === "weekly" && (
                <WeeklyTrainingPatternGrid
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  isSharing={isSharing}
                />
              )}
              {!isFirstMonthFocusState && effectiveViewMode === "monthly" && (
                <MonthlyTrainingPatternGrid
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  isSharing={isSharing}
                />
              )}
              {!isFirstMonthFocusState &&
                effectiveViewMode === "streaks" &&
                showStreaksToggle && (
                  <StreaksLeaderboard
                    streaks={streakLeaderboard}
                    isSharing={isSharing}
                  />
                )}
              {/* Footer with app branding - only visible during image capture */}
              {isSharing && (
                <div
                  className="mt-6 flex items-center justify-center border-t pt-4"
                  data-share-section="branding"
                >
                  <p className="text-muted-foreground text-sm">
                    Created with{" "}
                    <span className="text-foreground font-semibold">
                      Strength Journeys
                    </span>
                    {" • "}
                    <span className="text-muted-foreground">
                      strengthjourneys.xyz
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
        {intervals && !isFirstWeekIntroState && (
          <CardFooter id="ignoreCopy">
            <div className="flex w-full flex-col gap-2">
              {showImportMergeNudge && (
                <LongGameImportNudge
                  dashboardStage={dashboardStage}
                  sessionCount={sessionCount}
                />
              )}
              {canShareHeatmaps && (
                <div className="flex justify-end">
                  <ShareCopyButton
                    label="Copy image"
                    tooltip="Share heatmaps to clipboard"
                    onClick={handleCopyFullHeatmapImage}
                    isLoading={isSharing}
                    isSuccess={isShareSuccess}
                    disabled={isSharing}
                    className="!border-zinc-300 !bg-white !text-zinc-900 hover:!bg-zinc-100"
                  />
                </div>
              )}
              {dashboardStage === "established" && (
                <MiniFeedbackWidget
                  contextId="heatmap_card"
                  page="/lift-explorer"
                  analyticsExtra={{ context: "activity_heatmaps_card" }}
                />
              )}
            </div>
          </CardFooter>
        )}
      </Card>
      {/* Cover the visible card during capture so the layout swap (light
          theme, hidden selector, branding footer, streaks heading, etc.)
          doesn't flash on screen. The overlay is a sibling, not a child of
          shareRef, so html2canvas does not include it in the snapshot. */}
      {isSharing && (
        <div className="bg-card/95 absolute inset-0 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Generating image…</span>
          </div>
        </div>
      )}
    </div>
  );
}
