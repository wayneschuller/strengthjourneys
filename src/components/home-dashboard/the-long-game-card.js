import { format } from "date-fns";
import {
  Fragment,
  cloneElement,
  memo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import {
  coreLiftTypes,
  devLog,
  logTiming,
  getReadableDateString,
  getDisplayWeight,
} from "@/lib/processing-utils";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { MiniFeedbackWidget } from "@/components/feedback";
import { ShareCopyButton } from "@/components/share-copy-button";
import { LiftResultCopyButton } from "@/components/lift-result-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import {
  LOCAL_STORAGE_KEYS,
  getSheetScopedStorageKey,
} from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
import { SessionRow } from "@/components/visualizer/visualizer-utils";
import { motion } from "motion/react";
import { processConsistency } from "@/lib/consistency";
import { getGradeAndColor } from "@/lib/consistency-grades";
import {
  getCalendarYearWeekIndexFromWeekKey,
  getCalendarYearWeekStartFromIndex,
  getWeekKeyFromDateStr,
  parseYmdUtc,
} from "@/lib/date-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// We don't need this because we put our own styles in our globals.css
// import "react-calendar-heatmap/dist/styles.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const { parsedData, isLoading, sheetInfo } = useUserLiftingData();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const { status: authStatus } = useSession();
  const { theme } = useTheme();
  const shareRef = useRef(null);
  const yearRowRefs = useRef({});
  const yearShareTimerRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingYear, setSharingYear] = useState(null);
  const [sharedYear, setSharedYear] = useState(null);
  const { isSuccess: isShareSuccess, triggerSuccess: triggerShareSuccess } =
    useTransientSuccess();
  // SSR default = first stage-1 title; randomised client-side once intervals load
  const [cardTitle, setCardTitle] = useState(HEATMAP_TITLES_STAGE1[0]);
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
  const effectiveViewMode = useMemo(() => {
    if (dashboardStage === "starter_sample") return "daily";
    if (dashboardStage === "first_real_week") return "daily";
    if (dashboardStage === "first_month") return "daily";
    return viewMode;
  }, [dashboardStage, viewMode]);
  const isFirstWeekIntroState =
    dashboardStage === "starter_sample" || dashboardStage === "first_real_week";
  const isFirstMonthFocusState = dashboardStage === "first_month";
  const canShareHeatmaps = dashboardStage === "established";
  const showWeeklyToggle =
    (dashboardStage === "early_base" || dashboardStage === "established") &&
    intervals?.length > 2;
  const showMonthlyToggle =
    dashboardStage === "established" && intervals?.length >= 5;

  // FIXME: I think we have the skills to not need this useEffect anymore
  useEffect(() => {
    if (isLoading) return;
    if (!parsedData || parsedData.length === 0) return;

    // Generate heatmap stuff
    const { startDate, endDate } = findStartEndDates(parsedData);
    setStartDate(startDate);
    setEndDate(endDate);
    const intervals = getHeatmapIntervals({
      startDate,
      endDate,
      dashboardStage,
    });

    // devLog(`Heatmaps: setting intervals:`);
    // devLog(intervals);

    setIntervals(intervals); // intervals is the trigger for showing the heatmaps

    // Randomise card title based on training history length (client-side only)
    const titles = getHeatmapTitles(intervals.length);
    setCardTitle(titles[Math.floor(Math.random() * titles.length)]);
  }, [isLoading, parsedData, dashboardStage]);

  useEffect(() => {
    return () => {
      if (yearShareTimerRef.current) {
        clearTimeout(yearShareTimerRef.current);
      }
    };
  }, []);

  const writePngToClipboard = useCallback(async (blobPromise) => {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blobPromise }),
    ]);
  }, []);

  const copyNodeToClipboard = useCallback(
    async (node, ignoreElements, captureOptions = {}) => {
      if (!node) return;
      const html2canvas = (await import("html2canvas-pro")).default;
      const blobPromise = html2canvas(node, {
        ignoreElements,
        backgroundColor: "#ffffff",
        scale: 1,
        ...captureOptions,
      }).then(
        (canvas) =>
          new Promise((resolve) => canvas.toBlob(resolve, "image/png")),
      );
      await writePngToClipboard(blobPromise);
    },
    [writePngToClipboard],
  );

  const buildStyledSvgImage = useCallback(async (svgElement) => {
    const svgRect = svgElement.getBoundingClientRect();
    const cloneWithInlineSvgStyles = (sourceNode, targetNode) => {
      if (!(sourceNode instanceof Element) || !(targetNode instanceof Element))
        return;
      const sourceTag = sourceNode.tagName.toLowerCase();
      const computedStyle = window.getComputedStyle(sourceNode);

      if (sourceTag === "svg") {
        targetNode.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (!targetNode.getAttribute("width")) {
          targetNode.setAttribute("width", `${Math.ceil(svgRect.width)}`);
        }
        if (!targetNode.getAttribute("height")) {
          targetNode.setAttribute("height", `${Math.ceil(svgRect.height)}`);
        }
      }

      if (
        sourceTag === "rect" ||
        sourceTag === "path" ||
        sourceTag === "polygon" ||
        sourceTag === "circle" ||
        sourceTag === "ellipse" ||
        sourceTag === "line"
      ) {
        const fill = computedStyle.fill;
        if (fill && fill !== "none") targetNode.setAttribute("fill", fill);
        const stroke = computedStyle.stroke;
        if (stroke && stroke !== "none") {
          targetNode.setAttribute("stroke", stroke);
          targetNode.setAttribute("stroke-width", computedStyle.strokeWidth);
        }
        if (computedStyle.opacity && computedStyle.opacity !== "1") {
          targetNode.setAttribute("opacity", computedStyle.opacity);
        }
      }

      if (sourceTag === "text") {
        targetNode.setAttribute("fill", computedStyle.fill);
        targetNode.setAttribute("font-size", computedStyle.fontSize);
        targetNode.setAttribute("font-family", computedStyle.fontFamily);
        targetNode.setAttribute("letter-spacing", computedStyle.letterSpacing);
      }

      for (let i = 0; i < sourceNode.children.length; i += 1) {
        cloneWithInlineSvgStyles(
          sourceNode.children[i],
          targetNode.children[i],
        );
      }
    };

    const clonedSvg = svgElement.cloneNode(true);
    cloneWithInlineSvgStyles(svgElement, clonedSvg);

    const svgBlob = new Blob(
      [new XMLSerializer().serializeToString(clonedSvg)],
      {
        type: "image/svg+xml;charset=utf-8",
      },
    );
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = svgUrl;
    }).finally(() => {
      URL.revokeObjectURL(svgUrl);
    });

    return { image, rect: svgRect };
  }, []);

  const drawYearRowToContext = useCallback(
    async (ctx, yearNode, year, cardRect) => {
      const heatmapRoot = yearNode.querySelector(".react-calendar-heatmap");
      const heatmapSvg =
        heatmapRoot?.tagName?.toLowerCase() === "svg"
          ? heatmapRoot
          : heatmapRoot?.querySelector("svg");
      if (!heatmapSvg) return false;

      const rowRect = yearNode.getBoundingClientRect();
      const { image: svgImage, rect: svgRect } =
        await buildStyledSvgImage(heatmapSvg);

      const rowOffsetX = Math.max(0, rowRect.left - cardRect.left);
      const rowOffsetY = Math.max(0, rowRect.top - cardRect.top);

      const labelNode = yearNode.querySelector('[data-year-label="true"]');
      if (labelNode) {
        const labelRect = labelNode.getBoundingClientRect();
        const labelStyle = window.getComputedStyle(labelNode);
        ctx.fillStyle = labelStyle.color;
        ctx.font = `${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`;
        ctx.textBaseline = "top";
        ctx.fillText(
          String(year),
          Math.max(0, labelRect.left - cardRect.left),
          Math.max(0, labelRect.top - cardRect.top),
        );
      }

      ctx.drawImage(
        svgImage,
        rowOffsetX + Math.max(0, svgRect.left - rowRect.left),
        rowOffsetY + Math.max(0, svgRect.top - rowRect.top),
        svgRect.width,
        svgRect.height,
      );

      return true;
    },
    [buildStyledSvgImage],
  );

  const drawTextNodeToContext = useCallback(
    (ctx, node, cardRect, fallback = {}) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;

      ctx.fillStyle = fallback.color || style.color || "#111827";
      ctx.font = `${style.fontWeight || fallback.fontWeight || 400} ${style.fontSize || fallback.fontSize || "12px"} ${style.fontFamily || fallback.fontFamily || "sans-serif"}`;
      ctx.textBaseline = "top";
      ctx.fillText(
        text,
        Math.max(0, rect.left - cardRect.left),
        Math.max(0, rect.top - cardRect.top),
      );
    },
    [],
  );

  const copyYearRowFastToClipboard = useCallback(
    async (yearNode, year) => {
      const fastPathStart = performance.now();
      const heatmapRoot = yearNode.querySelector(".react-calendar-heatmap");
      const heatmapSvg =
        heatmapRoot?.tagName?.toLowerCase() === "svg"
          ? heatmapRoot
          : heatmapRoot?.querySelector("svg");
      if (!heatmapSvg) {
        devLog(
          `[heatmap-copy][${year}] fast-path skipped: svg not found (root=${Boolean(heatmapRoot)})`,
        );
        return false;
      }

      const rowRect = yearNode.getBoundingClientRect();
      const svgRect = heatmapSvg.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) {
        devLog(`[heatmap-copy][${year}] fast-path skipped: invalid svg bounds`);
        return false;
      }

      const { image: svgImage } = await buildStyledSvgImage(heatmapSvg);
      devLog(
        `[heatmap-copy][${year}] fast-path inline styles: ${Math.round(performance.now() - fastPathStart)}ms`,
      );
      devLog(
        `[heatmap-copy][${year}] fast-path svg decode: ${Math.round(performance.now() - fastPathStart)}ms`,
      );

      const canvasWidth = Math.max(1, Math.ceil(rowRect.width));
      const canvasHeight = Math.max(1, Math.ceil(rowRect.height));
      const exportScale = Math.max(
        1,
        Math.min(3, window.devicePixelRatio || 1),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(canvasWidth * exportScale);
      canvas.height = Math.round(canvasHeight * exportScale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.scale(exportScale, exportScale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const labelNode = yearNode.querySelector('[data-year-label="true"]');
      if (labelNode) {
        const labelRect = labelNode.getBoundingClientRect();
        const labelStyle = window.getComputedStyle(labelNode);
        ctx.fillStyle = labelStyle.color;
        ctx.font = `${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`;
        ctx.textBaseline = "top";
        ctx.fillText(
          String(year),
          Math.max(0, Math.round(labelRect.left - rowRect.left)),
          Math.max(0, Math.round(labelRect.top - rowRect.top)),
        );
      }

      const svgX = Math.max(0, svgRect.left - rowRect.left);
      const svgY = Math.max(0, svgRect.top - rowRect.top);
      ctx.drawImage(svgImage, svgX, svgY, svgRect.width, svgRect.height);

      const blobPromise = new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      await writePngToClipboard(blobPromise);
      devLog(
        `[heatmap-copy][${year}] fast-path total: ${Math.round(performance.now() - fastPathStart)}ms`,
      );
      return true;
    },
    [buildStyledSvgImage, writePngToClipboard],
  );

  const copyFullCardFastToClipboard = useCallback(async () => {
    if (!shareRef.current) {
      devLog("[heatmap-copy][full] fast-path skipped: missing shareRef");
      return false;
    }
    if (viewMode !== "daily") {
      devLog(`[heatmap-copy][full] fast-path skipped: viewMode=${viewMode}`);
      return false;
    }
    if (!intervals?.length) {
      devLog("[heatmap-copy][full] fast-path skipped: no intervals");
      return false;
    }
    const fastStart = performance.now();
    devLog("[heatmap-copy][full] fast-path start");
    const cardNode = shareRef.current;
    const cardRect = cardNode.getBoundingClientRect();
    if (cardRect.width <= 0 || cardRect.height <= 0) {
      devLog("[heatmap-copy][full] fast-path skipped: invalid card bounds");
      return false;
    }

    // Keep full-card base at 1:1 to avoid subtle text/ring distortion from raster resampling.
    const captureScale = 1;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(cardRect.width * captureScale);
    exportCanvas.height = Math.round(cardRect.height * captureScale);
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      devLog("[heatmap-copy][full] fast-path skipped: no canvas context");
      return false;
    }
    ctx.scale(captureScale, captureScale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cardRect.width, cardRect.height);

    const headerStart = performance.now();
    const headerNode = cardNode.querySelector('[data-share-section="header"]');
    if (headerNode) {
      const titleNode = headerNode.querySelector('[data-share-title="true"]');
      const descriptionNode = headerNode.querySelector(
        '[data-share-description="true"]',
      );
      if (!titleNode) devLog("[heatmap-copy][full] header title node missing");
      if (!descriptionNode)
        devLog("[heatmap-copy][full] header description node missing");
      drawTextNodeToContext(ctx, titleNode, cardRect, {
        fontWeight: 700,
        fontSize: "28px",
        color: "#111827",
      });
      drawTextNodeToContext(ctx, descriptionNode, cardRect, {
        fontWeight: 400,
        fontSize: "12px",
        color: "#6b7280",
      });
    }
    devLog(
      `[heatmap-copy][full] header text draw: ${Math.round(performance.now() - headerStart)}ms`,
    );

    const circlesStart = performance.now();
    const consistencyNode = cardNode.querySelector(
      '[data-share-section="consistency"]',
    );
    if (consistencyNode) {
      const circleWraps = consistencyNode.querySelectorAll("svg");
      for (const svgNode of circleWraps) {
        const { image: svgImage, rect } = await buildStyledSvgImage(svgNode);
        ctx.drawImage(
          svgImage,
          Math.max(0, rect.left - cardRect.left),
          Math.max(0, rect.top - cardRect.top),
          rect.width,
          rect.height,
        );
      }

      const labelNodes = consistencyNode.querySelectorAll("svg + span");
      for (const labelNode of labelNodes) {
        drawTextNodeToContext(ctx, labelNode, cardRect, {
          fontWeight: 400,
          fontSize: "9px",
          color: "#6b7280",
        });
      }
    }
    devLog(
      `[heatmap-copy][full] consistency draw: ${Math.round(performance.now() - circlesStart)}ms`,
    );

    for (const interval of intervals) {
      const year = new Date(interval.startDate).getFullYear();
      const yearNode = yearRowRefs.current[year];
      if (!yearNode) continue;
      const yearStart = performance.now();
      const rendered = await drawYearRowToContext(
        ctx,
        yearNode,
        year,
        cardRect,
      );
      if (!rendered) {
        devLog(
          `[heatmap-copy][full] fast-path failed: year ${year} render failed`,
        );
        return false;
      }
      devLog(
        `[heatmap-copy][full] year ${year} draw: ${Math.round(performance.now() - yearStart)}ms`,
      );
    }

    const brandingStart = performance.now();
    const brandingNode = cardNode.querySelector(
      '[data-share-section="branding"]',
    );
    if (brandingNode) {
      const brandRect = brandingNode.getBoundingClientRect();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.max(0, brandRect.top - cardRect.top));
      ctx.lineTo(cardRect.width, Math.max(0, brandRect.top - cardRect.top));
      ctx.stroke();

      const brandingTextNode = brandingNode.querySelector("p");
      drawTextNodeToContext(ctx, brandingTextNode, cardRect, {
        fontWeight: 400,
        fontSize: "12px",
        color: "#6b7280",
      });
    }
    devLog(
      `[heatmap-copy][full] branding draw: ${Math.round(performance.now() - brandingStart)}ms`,
    );

    const blobPromise = new Promise((resolve) =>
      exportCanvas.toBlob(resolve, "image/png"),
    );
    await writePngToClipboard(blobPromise);
    devLog(
      `[heatmap-copy][full] fast-path total: ${Math.round(performance.now() - fastStart)}ms`,
    );
    return true;
  }, [
    buildStyledSvgImage,
    drawTextNodeToContext,
    drawYearRowToContext,
    intervals,
    viewMode,
    writePngToClipboard,
  ]);

  // if (!parsedData || parsedData.length === 0) { return null; }

  const handleShare = async () => {
    const startTime = performance.now();
    setIsSharing(true);
    // Wait a couple of frames so capture-mode layout/animation state has settled before sampling bounds.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    try {
      if (shareRef.current) {
        devLog("[heatmap-copy][full] share start");
        const usedFastPath = await copyFullCardFastToClipboard();
        if (!usedFastPath) {
          devLog("[heatmap-copy][full] using html2canvas fallback");
          const fallbackStart = performance.now();
          // Keep copied image deterministic via `data-capture="light"` CSS contract.
          await copyNodeToClipboard(
            shareRef.current,
            (element) => element.id === "ignoreCopy",
          );
          devLog(
            `[heatmap-copy][full] fallback total: ${Math.round(performance.now() - fallbackStart)}ms`,
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

  const handleShareYear = useCallback(
    async (year) => {
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
        const usedFastPath = await copyYearRowFastToClipboard(yearNode, year);
        if (!usedFastPath) {
          const fallbackStart = performance.now();
          await copyNodeToClipboard(
            yearNode,
            (element) => element.dataset.shareIgnore === "true",
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
    },
    [copyNodeToClipboard, copyYearRowFastToClipboard],
  );

  return (
    <>
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
                          style={{ width: WEEKLY_YEAR_W }}
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
                (showWeeklyToggle || showMonthlyToggle) && (
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
                  className={
                    isSharing
                      ? ""
                      : dashboardStage === "starter_sample" ||
                          dashboardStage === "first_real_week" ||
                          dashboardStage === "first_month"
                        ? ""
                        : "max-h-[52vh] overflow-y-auto pr-1"
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
                            style={{ width: WEEKLY_YEAR_W }}
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
                                    onCopy={() => handleShareYear(year)}
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
                            <MemoizedHeatmap
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
                <WeeklyHeatmapMatrix
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  isSharing={isSharing}
                />
              )}
              {!isFirstMonthFocusState && effectiveViewMode === "monthly" && (
                <MonthlyHeatmapMatrix
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
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
              {canShareHeatmaps && (
                <div className="flex justify-end">
                  <ShareCopyButton
                    label="Copy image"
                    tooltip="Share heatmaps to clipboard"
                    onClick={handleShare}
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
    </>
  );
}

function StarterLongGameState({ parsedData, sessionCount = 0 }) {
  const litDayIndexes = useMemo(() => {
    const nonGoalDates = Array.isArray(parsedData)
      ? Array.from(
          new Set(
            parsedData
              .filter((entry) => !entry?.isGoal && entry?.date)
              .map((entry) => entry.date),
          ),
        ).sort()
      : [];
    const anchorDateStr =
      nonGoalDates[nonGoalDates.length - 1] || format(new Date(), "yyyy-MM-dd");
    const anchorDate = new Date(`${anchorDateStr}T00:00:00`);
    const dayOfWeek = anchorDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(anchorDate);
    startOfWeek.setDate(anchorDate.getDate() - mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dayIndexes = new Set();
    nonGoalDates.forEach((dateStr) => {
      const entryDate = new Date(`${dateStr}T00:00:00`);
      if (entryDate < startOfWeek || entryDate > endOfWeek) return;
      const mondayBasedIndex = (entryDate.getDay() + 6) % 7;
      dayIndexes.add(mondayBasedIndex);
    });

    if (dayIndexes.size === 0) {
      dayIndexes.add(sessionCount > 0 ? (anchorDate.getDay() + 6) % 7 : 0);
    }

    return dayIndexes;
  }, [parsedData, sessionCount]);
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="flex items-center justify-between gap-3">
          {days.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`h-5 w-5 rounded-full border ${
                  litDayIndexes.has(index)
                    ? "border-primary/40 bg-primary"
                    : "border-border/70 bg-muted/30"
                }`}
              />
              <span className="text-muted-foreground text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StarterLongGameNote
          title="Week 1"
          body="Each day you train lights another dot."
        />
        <StarterLongGameNote
          title="Month 1"
          body="A few solid weeks turn dots into a real pattern."
        />
        <StarterLongGameNote
          title="Long term"
          body="Weekly and monthly views unlock once you have more history."
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Right now the story is just one week wide. That is normal. Keep logging
        and the timeline grows with you.
      </p>
    </div>
  );
}

function StarterLongGameNote({ title, body }) {
  return (
    <div className="bg-background/80 rounded-lg border px-3 py-3">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
    </div>
  );
}

function FirstMonthLongGameState({ parsedData }) {
  const { weekdayLabels, weekRows, activeDays } = useMemo(() => {
    const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
    const nonGoalDates = Array.isArray(parsedData)
      ? Array.from(
          new Set(
            parsedData
              .filter((entry) => !entry?.isGoal && entry?.date)
              .map((entry) => entry.date),
          ),
        ).sort()
      : [];

    const anchorDateStr = nonGoalDates[0] || format(new Date(), "yyyy-MM-dd");
    const anchorDate = new Date(`${anchorDateStr}T00:00:00`);
    const dayOfWeek = anchorDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const firstWeekStart = new Date(anchorDate);
    firstWeekStart.setDate(anchorDate.getDate() - mondayOffset);
    firstWeekStart.setHours(0, 0, 0, 0);

    const activeDays = new Set();
    nonGoalDates.forEach((dateStr) => {
      const entryDate = new Date(`${dateStr}T00:00:00`);
      const diffDays = Math.floor(
        (entryDate.getTime() - firstWeekStart.getTime()) / 86400000,
      );
      if (diffDays < 0 || diffDays >= 35) return;
      activeDays.add(diffDays);
    });

    const weekRows = Array.from({ length: 5 }, (_, weekIndex) => ({
      label: `W${weekIndex + 1}`,
      days: Array.from(
        { length: 7 },
        (_, dayIndex) => weekIndex * 7 + dayIndex,
      ),
    }));

    return { weekdayLabels, weekRows, activeDays };
  }, [parsedData]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="grid grid-cols-[1.25rem_repeat(7,1.55rem)] justify-center gap-x-1.5 gap-y-1.5 sm:grid-cols-[1.5rem_repeat(7,1.75rem)] sm:gap-x-2 sm:gap-y-2">
          <div />
          {weekdayLabels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="text-muted-foreground text-center text-[10px] font-medium"
            >
              {label}
            </span>
          ))}
          {weekRows.map((week) => (
            <Fragment key={week.label}>
              <span className="text-muted-foreground self-center text-[10px] font-medium">
                {week.label}
              </span>
              {week.days.map((dayNumber) => (
                <div
                  key={`${week.label}-${dayNumber}`}
                  className={`h-6 w-6 rounded-[0.65rem] border transition-colors sm:h-7 sm:w-7 ${
                    activeDays.has(dayNumber)
                      ? "border-primary/18 bg-primary/70"
                      : "border-border/45 bg-muted/18"
                  }`}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StarterLongGameNote
          title="Week by week"
          body="The first month should start to look like a repeatable rhythm."
        />
        <StarterLongGameNote
          title="Build the pattern"
          body="A few training days each week are enough to make the grid come alive."
        />
        <StarterLongGameNote
          title="Long term"
          body="Richer daily, weekly, and monthly views unlock once you have more history."
        />
      </div>
    </div>
  );
}

// --- Support functions and components ---

const MAX_LIFTS_SHOWN = 6;

// --- Consistency Grades ---

const SHORT_TERM_LABELS = new Set(["Week", "Month", "3 Month"]);

function getConsistencyLabelAbbrev(label) {
  if (label === "Week") return "W";
  if (label === "Month") return "M";
  if (label === "Half Year") return "6M";
  if (label === "Year") return "Y";
  if (label === "24 Month") return "2Y";
  if (label === "Decade") return "10Y";

  const monthMatch = label.match(/^(\d+) Month$/);
  if (monthMatch) return `${monthMatch[1]}M`;

  const yearMatch = label.match(/^(\d+) Year$/);
  if (yearMatch) return `${yearMatch[1]}Y`;

  return label;
}

function splitIntoBalancedRows(items, maxItemsPerRow = 5) {
  const rowCount = Math.max(1, Math.ceil(items.length / maxItemsPerRow));
  const minItemsPerRow = Math.floor(items.length / rowCount);
  const extraItems = items.length % rowCount;
  const rows = [];
  let startIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSize = minItemsPerRow + (rowIndex < extraItems ? 1 : 0);
    rows.push(items.slice(startIndex, startIndex + rowSize));
    startIndex += rowSize;
  }

  return rows;
}

// Animated SVG ring showing a consistency grade letter and percentage fill for one time window.
// Short-term rings (W/M/3M) render with a thicker stroke and full opacity to emphasise recent form;
// long-term rings use a thinner stroke and 60% opacity so they recede without disappearing.
function GradeCircle({
  percentage,
  label,
  tooltip,
  size = 28,
  delay = 0,
  isVisible,
  isShortTerm = true,
  isCaptureMode = false,
}) {
  const { grade, color } = getGradeAndColor(percentage);
  const strokeWidth = isShortTerm ? 3.5 : 2.5;
  const targetOpacity = isCaptureMode ? 1 : isShortTerm ? 1 : 0.6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const abbrev = getConsistencyLabelAbbrev(label);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={
              isCaptureMode
                ? { opacity: targetOpacity, y: 0 }
                : { opacity: 0, y: -20 }
            }
            animate={
              isCaptureMode
                ? { opacity: targetOpacity, y: 0 }
                : isVisible
                  ? { opacity: targetOpacity, y: 0 }
                  : { opacity: 0, y: -20 }
            }
            transition={
              isCaptureMode
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: isVisible ? delay : 0,
                  }
            }
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="shrink-0"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/40"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={grade.length > 1 ? size * 0.32 : size * 0.39}
                fontWeight="600"
              >
                {grade}
              </text>
            </svg>
            <span className="text-muted-foreground text-[11px] leading-none">
              {abbrev}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Strips trailing consistency items whose grade is "." — meaning insufficient history for that
// window — so the rings row doesn't end in visually meaningless placeholder dots.
function trimTrailingDots(items) {
  let lastReal = items.length - 1;
  while (
    lastReal >= 0 &&
    getGradeAndColor(items[lastReal].percentage).grade === "."
  ) {
    lastReal--;
  }
  return items.slice(0, lastReal + 1);
}

// Renders a horizontal row of GradeCircle rings for every consistency window the user has enough
// data to fill. Trims trailing dot-grade periods before rendering, and spring-animates the rings
// in from above once the card's interval data is ready.
function ConsistencyGradesRow({
  parsedData,
  isVisible = false,
  isCaptureMode = false,
}) {
  const consistency = useMemo(() => {
    const raw = processConsistency(parsedData);
    return raw ? trimTrailingDots(raw) : null;
  }, [parsedData]);

  if (!consistency || consistency.length === 0) return null;

  const circleSize =
    consistency.length >= 11 ? 48 : consistency.length >= 7 ? 56 : 64;
  const rows = splitIntoBalancedRows(consistency);

  return (
    <div className="flex flex-col items-center gap-3">
      {rows.map((row, rowIndex) => (
        <div
          key={`consistency-row-${rowIndex}`}
          className="flex items-start justify-center gap-x-3 sm:gap-x-4"
        >
          {row.map((item, index) => {
            const sequenceIndex =
              rows
                .slice(0, rowIndex)
                .reduce((count, priorRow) => count + priorRow.length, 0) + index;

            return (
              <GradeCircle
                key={item.label}
                percentage={item.percentage}
                label={item.label}
                tooltip={item.tooltip}
                size={circleSize}
                delay={sequenceIndex * 0.05}
                isVisible={isVisible}
                isShortTerm={SHORT_TERM_LABELS.has(item.label)}
                isCaptureMode={isCaptureMode}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Heatmap card titles, staged by training history length.
// SSR always renders index 0 of stage1; client randomises after intervals load.

// New lifters get neutral and functional phrasing.
const HEATMAP_TITLES_STAGE1 = [
  "The Lifting Heatmap",
  "The Training Overview",
  "The Lifting Record",
  "The Training History",
  "The Strength Overview",
  "The Lifting Patterns",
  "The Consistency View",
  "The Activity History",
  "The Training Map",
  "The Full Picture",
];

// Medium term lifters get more identity based phrasing.
const HEATMAP_TITLES_STAGE2 = [
  "The Seasons of Training",
  "The Pattern of Consistency",
  "The Rhythm Taking Shape",
  "The Work Taking Shape",
  "The Years of Training",
  "The Momentum Over Time",
  "The Shape of Strength",
  "The Middle Miles",
  "The Consistency in Motion",
  "The Making of a Lifter",
];

// We intentionally get more poetic for long term lifters.
const HEATMAP_TITLES_STAGE3 = [
  "The Lifting Journey",
  "The Lifetime Under the Bar",
  "The Long Build",
  "The Years of Showing Up",
  "The Long Game",
  "The Year-by-Year Story",
  "The Work That Stayed",
  "The Proof of Consistency",
  "The Archive of Effort",
  "The Iron Remembers",
];

// Selects the title pool that matches the user's training history length.
// Stage 1 (<2 years): neutral/functional. Stage 2 (2–4 years): identity-based. Stage 3 (5+): poetic.
function getHeatmapTitles(yearsCount) {
  if (yearsCount >= 5) return HEATMAP_TITLES_STAGE3;
  if (yearsCount >= 2) return HEATMAP_TITLES_STAGE2;
  return HEATMAP_TITLES_STAGE1;
}

// Scans parsedData in a single pass to find the earliest and latest lift dates,
// returned as "yyyy-MM-dd" strings for use as heatmap interval boundaries.
function findStartEndDates(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return null; // Return null for an empty array or invalid input
  }

  // Initialize start and end dates with the date of the first item in the array
  let startDate = new Date(parsedData[0].date);
  let endDate = new Date(parsedData[0].date);

  // Iterate through the array to find the actual start and end dates
  parsedData.forEach((item) => {
    const currentDate = new Date(item.date);

    if (currentDate < startDate) {
      startDate = currentDate;
    }

    if (currentDate > endDate) {
      endDate = currentDate;
    }
  });

  return {
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  };
}

// Produces one Jan 1–Dec 31 interval per calendar year spanned by the user's data.
// Input strings are "yyyy-MM-dd". Each interval drives one Heatmap row in the daily view.
function generateYearRanges(startDateStr, endDateStr) {
  // Convert input date strings to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Get the year of the start and end dates
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Generate one range per calendar year
  const yearRanges = [];
  for (let year = startYear; year <= endYear; year++) {
    yearRanges.push({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  }

  return yearRanges;
}

function shiftDateStr(dateStr, dayDelta) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + dayDelta);
  return format(date, "yyyy-MM-dd");
}

function getDaysBetween(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function buildFocusedInterval({
  startDate,
  endDate,
  minWindowDays,
  maxWindowDays,
  label,
}) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const historySpanDays = getDaysBetween(startDate, endDate);

  if (historySpanDays < minWindowDays) {
    return {
      startDate: shiftDateStr(todayStr, -(minWindowDays - 1)),
      endDate: todayStr,
      isFocused: true,
      label,
    };
  }

  const desiredStart = shiftDateStr(todayStr, -(maxWindowDays - 1));
  return {
    startDate: startDate > desiredStart ? startDate : desiredStart,
    endDate: todayStr,
    isFocused: true,
    label,
  };
}

function getHeatmapIntervals({ startDate, endDate, dashboardStage }) {
  if (!startDate || !endDate) return [];

  if (dashboardStage === "starter_sample") {
    return [
      buildFocusedInterval({
        startDate,
        endDate,
        minWindowDays: 21,
        maxWindowDays: 42,
        label: "first weeks",
      }),
    ];
  }

  if (dashboardStage === "first_real_week") {
    return [
      buildFocusedInterval({
        startDate,
        endDate,
        minWindowDays: 28,
        maxWindowDays: 56,
        label: "early block",
      }),
    ];
  }

  if (dashboardStage === "first_month") {
    return [
      buildFocusedInterval({
        startDate,
        endDate,
        minWindowDays: 42,
        maxWindowDays: 84,
        label: "first months",
      }),
    ];
  }

  return generateYearRanges(startDate, endDate);
}

// Shared matrix layout constants (used by both weekly and monthly views)
const WEEKLY_GAP = 2; // px gap between cells
const MONTHLY_GAP = 5; // px gap between monthly cells (wider for breathing room)
const WEEKLY_YEAR_W = 48; // px for year label column

function buildWeeklyMonthLabels(year) {
  return MONTH_NAMES.map((label, monthIndex) => ({
    label,
    week: getCalendarYearWeekIndexFromWeekKey(
      year,
      getWeekKeyFromDateStr(
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      ),
    ),
  })).filter(
    ({ week }, index, labels) =>
      week >= 1 &&
      week <= 53 &&
      labels.findIndex((candidate) => candidate.week === week) === index,
  );
}

function getWeekStartDate(year, weekNum) {
  return format(
    parseYmdUtc(getCalendarYearWeekStartFromIndex(year, weekNum)),
    "MMM d",
  );
}

// Aggregates parsedData into { [year]: { [weekNum]: { sessions, count } } }.
// sessions = distinct training days in that week; count is capped at 3 for color mapping
// (0 = none, 1 = 1 day, 2 = 2 days, 3 = 3+ days). In demo mode returns randomised data.
function generateWeeklyHeatmapData(parsedData, startYear, endYear, isDemoMode) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let week = 1; week <= 53; week++) {
        const rand = Math.random();
        const count = rand < 0.25 ? 0 : rand < 0.42 ? 1 : rand < 0.6 ? 2 : 3;
        result[year][week] = { sessions: count, count };
      }
    }
    return result;
  }

  const weekMap = {};
  const dateToWeekKey = new Map();
  const yearWeekIndexCache = new Map();
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    let weekKey = dateToWeekKey.get(lift.date);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(lift.date);
      dateToWeekKey.set(lift.date, weekKey);
    }
    const yearWeekCacheKey = `${year}:${weekKey}`;
    let weekNum = yearWeekIndexCache.get(yearWeekCacheKey);
    if (weekNum === undefined) {
      weekNum = getCalendarYearWeekIndexFromWeekKey(year, weekKey);
      yearWeekIndexCache.set(yearWeekCacheKey, weekNum);
    }
    if (!weekMap[year]) weekMap[year] = {};
    if (!weekMap[year][weekNum])
      weekMap[year][weekNum] = { sessionDays: new Set() };
    weekMap[year][weekNum].sessionDays.add(lift.date);
  }

  const result = {};
  for (const [yearStr, weeks] of Object.entries(weekMap)) {
    result[yearStr] = {};
    for (const [weekStr, week] of Object.entries(weeks)) {
      const sessions = week.sessionDays.size;
      result[yearStr][weekStr] = { sessions, count: Math.min(sessions, 3) };
    }
  }
  return result;
}

// All-years weekly grid: one row per year, 53 cells per row (one per calendar week).
// Cell color encodes sessions that week: 1 day → level 1, 2 days → level 2, 3+ days → level 4.
// Colors use --heatmap-N CSS variables so all themes work. Future weeks render invisible.
function WeeklyHeatmapMatrix({ parsedData, startYear, endYear, isSharing }) {
  const { isDemoMode } = useUserLiftingData();
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

  const weeklyData = useMemo(
    () => generateWeeklyHeatmapData(parsedData, startYear, endYear, isDemoMode),
    [parsedData, startYear, endYear, isDemoMode],
  );

  const years = useMemo(() => {
    const nextYears = [];
    for (let y = startYear; y <= endYear; y++) nextYears.push(y);
    return nextYears;
  }, [startYear, endYear]);

  // Used to distinguish future weeks (no data yet) from past missed weeks
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentWeekNum = getCalendarYearWeekIndexFromWeekKey(
    currentYear,
    getWeekKeyFromDateStr(format(todayDate, "yyyy-MM-dd")),
  );
  const weeklyMonthLabels = useMemo(
    () => buildWeeklyMonthLabels(currentYear),
    [currentYear],
  );

  const handleMouseOver = useCallback((e, year, weekNum, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, weekNum, ...data });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  // 53-column grid that fills available width; gap between cells
  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(53, 1fr)",
    gap: WEEKLY_GAP,
    flex: 1,
  };

  return (
    <div className="relative w-full">
      {/* Month label header — same 53-col grid so columns align with cells */}
      <div className="border-border/15 mb-1 flex w-full items-end border-b pb-0.5">
        <div className="shrink-0" style={{ width: WEEKLY_YEAR_W }} />
        <div style={cellGridStyle}>
          {weeklyMonthLabels.map(({ label, week }) => (
            <span
              key={week}
              className="text-muted-foreground/80 overflow-visible text-[9px] tracking-[0.04em] whitespace-nowrap lg:text-[11px] 2xl:text-xs"
              style={{ gridColumn: week }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-[2px]">
        {years.map((year) => (
          <div
            key={year}
            className={`flex w-full items-center ${year === currentYear ? "bg-muted/25 -mx-1 rounded-md px-1 py-0.5" : ""}`}
          >
            <div
              className="shrink-0 pr-2 text-right text-xs lg:text-sm"
              style={{ width: WEEKLY_YEAR_W }}
            >
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={
                    year === currentYear
                      ? "text-foreground text-[13px] font-semibold tabular-nums lg:text-sm"
                      : "text-muted-foreground tabular-nums"
                  }
                >
                  {year}
                </span>
                {year === currentYear && (
                  <span className="text-muted-foreground/60 text-[9px] leading-none">
                    now
                  </span>
                )}
              </div>
            </div>
            <div style={cellGridStyle}>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((weekNum) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && weekNum > currentWeekNum);
                const data = weeklyData[year]?.[weekNum];
                const count = data?.count ?? 0;
                // Future weeks: invisible. Past empty: faint. Training: colored.
                // 3+ sessions uses --heatmap-4 (darkest) for distinct visual weight.
                const cellStyle = isFuture
                  ? { aspectRatio: "1" }
                  : count === 0
                    ? {
                        aspectRatio: "1",
                        backgroundColor: "var(--heatmap-0)",
                        opacity: 0.3,
                      }
                    : {
                        aspectRatio: "1",
                        backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
                      };
                return (
                  <div
                    key={weekNum}
                    className="rounded-sm"
                    style={cellStyle}
                    onMouseOver={
                      data && !isFuture
                        ? (e) => handleMouseOver(e, year, weekNum, data)
                        : undefined
                    }
                    onMouseLeave={
                      data && !isFuture ? handleMouseLeave : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-[10px]">
        <span className="font-medium">Sessions per week</span>
        <div className="flex items-center gap-3">
          {[
            { count: 1, label: "1" },
            { count: 2, label: "2" },
            { count: 3, label: "3+" },
          ].map(({ count, label }) => (
            <div key={count} className="flex items-center gap-1.5">
              <div
                className="shrink-0 rounded-sm"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredValue && !isSharing && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <WeeklyTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

// Tooltip body for a weekly cell: shows the week-start date and training day count for that week.
function WeeklyTooltipContent({ value }) {
  const { year, weekNum, sessions } = value;
  return (
    <div className="border-border/50 bg-background grid max-w-[16rem] min-w-[8rem] items-start gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        Week of {getWeekStartDate(year, weekNum)}, {year}
      </p>
      <p className="text-muted-foreground">
        {sessions === 0
          ? "No training sessions"
          : `${sessions} training ${sessions === 1 ? "day" : "days"}`}
      </p>
    </div>
  );
}

const MONTH_NAMES = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

function getMonthlyShade(level) {
  const clampedLevel = Math.max(1, Math.min(level, 6));
  const mixPercent = 18 + clampedLevel * 14;
  return `color-mix(in srgb, var(--heatmap-4) ${mixPercent}%, var(--heatmap-1))`;
}

function getMonthlyCellStyles(level, isFuture) {
  if (isFuture) {
    return {};
  }

  if (level === 0) {
    return {
      backgroundColor: "var(--heatmap-0)",
      opacity: 0.38,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
    };
  }

  return {
    backgroundColor: getMonthlyShade(level),
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 1px rgba(15,23,42,0.04)",
    filter: level >= 5 ? "saturate(0.96) brightness(1.02)" : "none",
  };
}

function buildMonthlyRelativeLevels(monthlyData, years) {
  const months = [];

  years.forEach((year) => {
    Object.entries(monthlyData[year] ?? {}).forEach(([month, data]) => {
      if ((data?.totalSessions ?? 0) > 0) {
        months.push({
          year,
          month: Number(month),
          totalSessions: data.totalSessions,
        });
      }
    });
  });

  if (months.length === 0) return {};

  const sorted = [...months].sort((a, b) => a.totalSessions - b.totalSessions);
  const relativeLevels = {};

  sorted.forEach((entry, index) => {
    const percentile =
      sorted.length === 1 ? 1 : index / Math.max(sorted.length - 1, 1);
    const level = 1 + Math.round(percentile * 5);
    if (!relativeLevels[entry.year]) relativeLevels[entry.year] = {};
    relativeLevels[entry.year][entry.month] = level;
  });

  return relativeLevels;
}

// Aggregates parsedData into { [year]: { [month]: { activeWeeks, count, weekBreakdown } } }.
// activeWeeks = distinct calendar weeks in that month with at least one session; count capped at 4.
// weekBreakdown is sorted chronologically and drives the per-week rows in the monthly tooltip.
// In demo mode returns randomised data with a realistic active-month distribution.
function generateMonthlyHeatmapData(
  parsedData,
  startYear,
  endYear,
  isDemoMode,
) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let month = 1; month <= 12; month++) {
        const rand = Math.random();
        const count =
          rand < 0.12
            ? 0
            : rand < 0.28
              ? 1
              : rand < 0.5
                ? 2
                : rand < 0.75
                  ? 3
                  : 4;
        const weekBreakdown = Array.from({ length: count }, () => ({
          sessions: Math.floor(Math.random() * 4) + 1,
        }));
        result[year][month] = {
          activeWeeks: count,
          count,
          totalSessions: weekBreakdown.reduce(
            (sum, week) => sum + week.sessions,
            0,
          ),
          weekBreakdown,
        };
      }
    }
    return result;
  }

  // Per week within each month, collect unique training days (dates)
  const monthMap = {};
  const dateToWeekKey = new Map();
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    const month = parseInt(lift.date.substring(5, 7));
    let weekKey = dateToWeekKey.get(lift.date);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(lift.date);
      dateToWeekKey.set(lift.date, weekKey);
    }
    if (!monthMap[year]) monthMap[year] = {};
    if (!monthMap[year][month]) monthMap[year][month] = {};
    if (!monthMap[year][month][weekKey]) monthMap[year][month][weekKey] = new Set();
    monthMap[year][month][weekKey].add(lift.date);
  }

  const result = {};
  for (const [yearStr, months] of Object.entries(monthMap)) {
    result[yearStr] = {};
    for (const [monthStr, weekData] of Object.entries(months)) {
      // Sort by week number so tooltip rows are chronological
      const weekBreakdown = Object.entries(weekData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, days]) => ({ weekKey, sessions: days.size }));
      const activeWeeks = weekBreakdown.length;
      result[yearStr][monthStr] = {
        activeWeeks,
        count: Math.min(activeWeeks, 4),
        totalSessions: weekBreakdown.reduce((sum, week) => sum + week.sessions, 0),
        weekBreakdown,
      };
    }
  }
  return result;
}

// All-years monthly grid: one row per year, 12 cells per row (one per month).
// Cell color encodes active weeks that month: 0 = blank, 1–3 = graduated intensity, 4+ = full.
// Future months render invisible; past months with zero activity render at low opacity.
function MonthlyHeatmapMatrix({ parsedData, startYear, endYear, isSharing }) {
  const { isDemoMode } = useUserLiftingData();
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

  const monthlyData = useMemo(
    () =>
      generateMonthlyHeatmapData(parsedData, startYear, endYear, isDemoMode),
    [parsedData, startYear, endYear, isDemoMode],
  );

  const years = useMemo(() => {
    const nextYears = [];
    for (let y = startYear; y <= endYear; y++) nextYears.push(y);
    return nextYears;
  }, [startYear, endYear]);
  const relativeLevels = useMemo(
    () => buildMonthlyRelativeLevels(monthlyData, years),
    [monthlyData, years],
  );

  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;

  const handleMouseOver = useCallback((e, year, month, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, month, ...(data ?? {}) });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: MONTHLY_GAP,
    flex: 1,
  };

  return (
    <div
      className={
        isSharing
          ? "relative w-full rounded-xl bg-white px-2 py-2"
          : "from-background to-muted/20 relative w-full rounded-xl bg-gradient-to-b px-2 py-2"
      }
    >
      {/* Month name header */}
      <div className="border-border/15 mb-1 flex w-full items-end border-b pb-0.5">
        <div className="shrink-0" style={{ width: WEEKLY_YEAR_W }} />
        <div style={cellGridStyle}>
          {MONTH_NAMES.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="text-muted-foreground/80 text-center text-[9px] tracking-[0.04em] lg:text-[11px] 2xl:text-xs"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-1">
        {years.map((year) => (
          <div
            key={year}
            className={`flex w-full items-center ${year === currentYear ? "bg-muted/25 -mx-1 rounded-md px-1 py-0.5" : ""}`}
          >
            <div
              className="shrink-0 pr-2 text-right text-xs lg:text-sm"
              style={{ width: WEEKLY_YEAR_W }}
            >
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={
                    year === currentYear
                      ? "text-foreground text-[13px] font-semibold tabular-nums lg:text-sm"
                      : "text-muted-foreground tabular-nums"
                  }
                >
                  {year}
                </span>
                {year === currentYear && (
                  <span className="text-muted-foreground/60 text-[9px] leading-none">
                    now
                  </span>
                )}
              </div>
            </div>
            <div style={cellGridStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && month > currentMonth);
                const data = monthlyData[year]?.[month];
                const relativeLevel =
                  data?.totalSessions > 0
                    ? relativeLevels[year]?.[month] ?? 1
                    : 0;
                const cellStyle = getMonthlyCellStyles(
                  relativeLevel,
                  isFuture,
                );
                return (
                  <div
                    key={month}
                    className={`rounded-[8px] transition-transform duration-150 ${!isFuture && relativeLevel > 0 ? "hover:scale-[1.03]" : ""}`}
                    style={{
                      height: 26,
                      ...cellStyle,
                    }}
                    onMouseOver={
                      !isFuture
                        ? (e) => handleMouseOver(e, year, month, data)
                        : undefined
                    }
                    onMouseLeave={!isFuture ? handleMouseLeave : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-[10px]">
        <span className="font-medium">Relative monthly activity</span>
        <div className="flex items-center gap-3">
          {[
            { level: 1, label: "Low" },
            { level: 3, label: "Mid" },
            { level: 6, label: "High" },
          ].map(({ level, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="shrink-0 rounded-[4px]"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: getMonthlyShade(level),
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredValue && !isSharing && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <MonthlyTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

// Maps a weekly session count to an emoji for monthly tooltip week rows.
function weekEmoji(sessions) {
  if (sessions >= 3) return "🏆";
  if (sessions === 2) return "💪";
  if (sessions === 1) return "✅";
  return "💩";
}

// Tooltip body for a monthly cell: shows month/year heading and a per-week session breakdown.
function MonthlyTooltipContent({ value }) {
  const { year, month, weekBreakdown } = value;
  return (
    <div className="border-border/50 bg-background grid max-w-[18rem] min-w-[10rem] items-start gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        {MONTH_NAMES[month - 1]} {year}
      </p>
      {weekBreakdown?.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {weekBreakdown.map(({ sessions, weekKey }, i) => (
            <p key={weekKey ?? i} className="text-muted-foreground">
              <span className="text-foreground font-semibold">
                Week of{" "}
                {weekKey ? format(parseYmdUtc(weekKey), "MMM d") : `Week ${i + 1}`}:
              </span>{" "}
              {sessions} {sessions === 1 ? "session" : "sessions"}{" "}
              {weekEmoji(sessions)}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No training sessions 💩</p>
      )}
    </div>
  );
}

// Single-year calendar heatmap (Jan–Dec) using react-calendar-heatmap.
// Cell color reflects session intensity and PR status via getHeatmapLevel.
// Hover triggers a fixed-position tooltip with full session and PR details for that day.
function Heatmap({
  parsedData,
  startDate,
  endDate,
  isSharing,
  showMonthLabels = true,
}) {
  const { isDemoMode } = useUserLiftingData();
  const router = useRouter();
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

  const heatmapData = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
    return generateHeatmapData(
      parsedData,
      startDate,
      endDate,
      isDemoMode, // This is a clue we have sample data and we will fake the heatmap to impress shallow people
    );
  }, [parsedData, startDate, endDate, isDemoMode]);

  const handleMouseOver = useCallback((e, value) => {
    if (!value || !value.sessionData) return;
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(140, Math.min(x, window.innerWidth - 140)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue(value);
  }, []);

  const handleClick = useCallback(
    (value) => {
      if (!value?.date) return;
      router.push({ pathname: "/log", query: { date: value.date } });
    },
    [router],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredValue(null);
  }, []);

  if (!heatmapData || !startDate || !endDate) {
    return <Skeleton className="h-24 flex-1" />;
  }

  return (
    <div className="relative px-1 py-1">
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={heatmapData}
        showMonthLabels={showMonthLabels}
        classForValue={(value) => {
          if (!value) return `color-heatmap-0`;
          return `color-heatmap-${value.count}`;
        }}
        titleForValue={() => null}
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        transformDayElement={(element, value, index) =>
          cloneElement(element, {
            rx: 3,
            ry: 3,
            style: value?.date ? { cursor: "pointer" } : undefined,
          })
        }
      />
      {hoveredValue && !isSharing && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <HeatmapTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

const MemoizedHeatmap = memo(Heatmap);

// Tooltip body for a daily heatmap cell: date, set/lift counts, PR badges (heaviest per lift type),
// and per-lift set breakdowns. Shows up to MAX_LIFTS_SHOWN lift types before truncating.
function HeatmapTooltipContent({ value }) {
  const { sessionData, date } = value;
  const { isMetric } = useAthleteBio();
  if (!sessionData) return null;

  const { totalSets, uniqueLifts, prs, liftsByType } = sessionData;
  const dateLabel = getReadableDateString(date, true);
  const liftTypes = Object.keys(liftsByType);
  const visibleLifts = liftTypes.slice(0, MAX_LIFTS_SHOWN);
  const hiddenCount = liftTypes.length - MAX_LIFTS_SHOWN;

  // Keep only the heaviest PR per lift type
  const bestPrs = Object.values(
    prs.reduce((acc, pr) => {
      if (!acc[pr.liftType] || pr.weight > acc[pr.liftType].weight) {
        acc[pr.liftType] = pr;
      }
      return acc;
    }, {}),
  );

  return (
    <div className="border-border/50 bg-background grid max-w-[20rem] min-w-[10rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <p className="text-muted-foreground">
        {totalSets} {totalSets === 1 ? "set" : "sets"} across {uniqueLifts}{" "}
        {uniqueLifts === 1 ? "lift" : "lifts"}
      </p>

      {bestPrs.length > 0 && (
        <div className="flex flex-col gap-1">
          {bestPrs.map((pr, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                PR
              </span>
              <LiftTypeIndicator liftType={pr.liftType} />
              <span className="text-muted-foreground">
                {pr.reps}@{getDisplayWeight(pr, isMetric).value}
                {getDisplayWeight(pr, isMetric).unit}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {visibleLifts.map((liftType) => (
          <div key={liftType}>
            <LiftTypeIndicator liftType={liftType} />
            <SessionRow
              lifts={liftsByType[liftType]}
              showDate={false}
              isMetric={isMetric}
            />
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="text-muted-foreground">
            +{hiddenCount} more {hiddenCount === 1 ? "lift" : "lifts"}
          </p>
        )}
      </div>
    </div>
  );
}

// Volume-based heatmap level:
// Level 0: No activity (no entry)
// Level 1: Light session (1-3 sets)
// Level 2: Moderate session (4-8 sets)
// Level 3: Heavy session (9+ sets) OR non-core lift PR
// Level 4: Core lift PR (strongest visual emphasis)
function getHeatmapLevel(totalSets, hasPR, hasCoreLiftPR) {
  if (hasCoreLiftPR) return 4;
  if (totalSets >= 9 || hasPR) return 3;
  if (totalSets >= 4) return 2;
  return 1;
}

// Builds the heatmap value array for one calendar year from parsedData.
// Single O(n) pass produces { date, count, sessionData } entries where count = getHeatmapLevel()
// and sessionData carries PR and set details for tooltip rendering.
// In demo mode returns randomised counts across the full date range to fill the grid attractively.
function generateHeatmapData(parsedData, startDate, endDate, isDemoMode) {
  // Generate a full interval of random data for demo mode because it looks good
  if (isDemoMode) {
    const demoHeatmapData = [];
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day

    // Function to get a random count based on specified probabilities
    const getRandomCount = () => {
      const rand = Math.random();
      if (rand < 0.6) return 0; // 60% chance of being 0
      if (rand < 0.75) return 1;
      if (rand < 0.88) return 2;
      if (rand < 0.96) return 3;
      return 4;
    };

    for (let currentTime = start; currentTime <= end; currentTime += oneDay) {
      const count = getRandomCount();
      demoHeatmapData.push({
        date: format(new Date(currentTime), "yyyy-MM-dd"),
        count: count,
        sessionData: null,
      });
    }

    return demoHeatmapData;
  }

  // Build per-day data in a single O(n) pass
  const dayMap = {};

  for (const lift of parsedData) {
    if (lift.date < startDate || lift.date > endDate) continue;
    if (lift.isGoal) continue;

    const dateStr = lift.date;
    if (!dayMap[dateStr]) {
      dayMap[dateStr] = {
        totalSets: 0,
        prs: [],
        liftsByType: {},
        hasPR: false,
        hasCoreLiftPR: false,
      };
    }

    const day = dayMap[dateStr];
    day.totalSets++;

    if (!day.liftsByType[lift.liftType]) {
      day.liftsByType[lift.liftType] = [];
    }
    day.liftsByType[lift.liftType].push({
      reps: lift.reps,
      weight: lift.weight,
      unitType: lift.unitType,
    });

    if (lift.isHistoricalPR) {
      day.hasPR = true;
      day.prs.push({
        liftType: lift.liftType,
        reps: lift.reps,
        weight: lift.weight,
        unitType: lift.unitType,
      });
      if (coreLiftTypes.includes(lift.liftType)) {
        day.hasCoreLiftPR = true;
      }
    }
  }

  const heatmapData = Object.entries(dayMap).map(([date, day]) => ({
    date,
    count: getHeatmapLevel(day.totalSets, day.hasPR, day.hasCoreLiftPR),
    sessionData: {
      totalSets: day.totalSets,
      uniqueLifts: Object.keys(day.liftsByType).length,
      prs: day.prs,
      liftsByType: day.liftsByType,
    },
  }));

  return heatmapData;
}
