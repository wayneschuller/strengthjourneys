import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useDevActivityMonitor } from "@/hooks/use-dev-activity-monitor";
import {
  getTopLiftStats,
  useAthleteBio,
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { hexToRgba } from "@/lib/color-tools";
import {
  getTop20Rank,
  getSetIdentityKey,
  getEffectiveSetForRanking,
  isWithinRollingYear,
  compareRankingEntries,
  getOptimisticRankingMeta,
  getRankingMeta,
} from "@/lib/pr-ranking";
import {
  CELEBRATION_KEYFRAMES,
  CELEBRATION_TIERS,
  NEXT_TIER,
  getTrainingAgeYears,
  getCelebrationTier,
  getCelebrationStyles,
  fireSetCelebrationConfetti,
} from "@/lib/celebration";
import { useIsClient, useReadLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";
import { cn } from "@/lib/utils";
import {
  LiftStrengthLevel,
  LiftTonnageRow,
} from "@/components/home-dashboard/session-exercise-block";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  getDisplayWeight,
  getCelebrationEmoji,
  PRIORITY_REP_SCHEMES,
  devLog,
  getAverageLiftSessionTonnageFromPrecomputed,
} from "@/lib/processing-utils";
import { getReadableDateString } from "@/lib/date-utils";
import { generateSessionSets } from "@/lib/warmups";
import {
  getLiftPercentiles,
  UNIVERSES,
} from "@/lib/strength-circles/universe-percentiles";
import {
  LIFT_TYPE_TO_PERCENTILE_KEY,
  LIFT_TYPE_TO_CALCULATOR_URL,
} from "@/lib/strength-circles/strength-score";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InspirationCard } from "@/components/log/inspiration-card";
import { DevActivityMonitorPanel } from "@/components/dev-activity-monitor";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  ClipboardPlus,
  PlayCircle,
  Trash2,
  Dumbbell,
  Check,
  Info,
  Loader2,
  X,
  Link2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  AddLiftButton,
  LiftSuggestions,
  LiftTechniqueAssist,
  SmartAddButtons,
} from "@/components/log/add-controls";
import {
  getSessionSidebarSummary,
  LogSessionSkeleton,
  SessionSidebarRail,
  SyncIndicator,
} from "@/components/log/session-summary";
import { getLiftAnchorId } from "@/components/log/utils";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// --- Big Four lifts with SVG icons ---

const BIG_FOUR = [
  {
    name: "Back Squat",
    icon: "/back_squat.svg",
    slug: "progress-guide/squat",
  },
  {
    name: "Bench Press",
    icon: "/bench_press.svg",
    slug: "progress-guide/bench-press",
  },
  {
    name: "Deadlift",
    icon: "/deadlift.svg",
    slug: "progress-guide/deadlift",
  },
  {
    name: "Strict Press",
    icon: "/strict_press.svg",
    slug: "progress-guide/strict-press",
  },
];

const COACHED_LIFTS = [
  {
    liftType: "Back Squat",
    slug: "progress-guide/squat",
    cues: [
      "Root your whole foot and brace hard before every rep.",
      "Sit between your hips while the bar stays balanced over mid-foot.",
      "Drive straight up out of the hole and finish tall.",
    ],
    videoUrl: "https://www.youtube.com/embed/jyopTyOjXb0", // "Gym Shorts (How To): The Squat" - Barbell Logic
  },
  {
    liftType: "Bench Press",
    slug: "progress-guide/bench-press",
    cues: [
      "Set your shoulder blades first, then keep the upper back pinned tight.",
      "Plant your feet and stay tight from the handoff to lockout.",
      "Touch the bar low on the chest and press back toward the shoulders.",
    ],
    videoUrl: "https://www.youtube.com/embed/t3f2L7NRRUY", // "Gym Shorts (How To):  Bench Press" - Barbell Logic
  },
  {
    liftType: "Deadlift",
    slug: "progress-guide/deadlift",
    cues: [
      "Start with the bar over mid-foot and bring your shins in only after you hinge down.",
      "Brace, squeeze the bar, and pull the slack out before the floor breaks.",
      "Keep the bar close up the legs and finish tall without leaning back.",
    ],
    videoUrl: "https://www.youtube.com/embed/3oMjoOm5O18", // "Gym Shorts (How To): The Deadlift" - Barbell Logic
  },
  {
    liftType: "Strict Press",
    slug: "progress-guide/strict-press",
    cues: [
      "Squeeze glutes and abs so the ribs stay down before the press starts.",
      "Stack wrists over elbows and begin with forearms close to vertical.",
      "Move your head back to clear the bar, then punch through to lockout.",
    ],
    videoUrl: "https://www.youtube.com/embed/AhGW3XFG3M8", // "Gym Shorts (How To): The Press" - Barbell Logic
  },
  {
    liftType: "Power Snatch",
    standardsRef: { liftType: "Strict Press", ratio: 0.85 },
    cues: [
      "Stay over the bar off the floor and keep the bar close as it passes the knees.",
      "Finish tall through the hips before you pull under.",
      "Punch fast into a stable overhead catch and stand under control.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=7Jn6uNdmbc0",
  },
  {
    liftType: "Romanian Deadlift",
    standardsRef: { liftType: "Deadlift", ratio: 0.7 },
    cues: [
      "Push the hips back and keep a soft bend in the knees.",
      "Let the bar trace the thighs and stay close to the legs the whole way down.",
      "Stop when the hamstrings are loaded, then drive the hips through to stand tall.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=amLSSb8cXok",
  },
  {
    liftType: "Power Clean",
    standardsRef: { liftType: "Deadlift", ratio: 0.6 },
    cues: [
      "Push through the floor smoothly and keep the bar close from mid-shin to hip.",
      "Finish the pull with violent leg and hip extension before the elbows turn over.",
      "Catch high on the shoulders with fast elbows and a solid front rack.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=mLoPwZx90SI",
  },
  {
    liftType: "Rack Pull",
    standardsRef: { liftType: "Deadlift", ratio: 1.1 },
    cues: [
      "Set the lats first and wedge into the bar before it leaves the pins.",
      "Keep the bar glued to the thighs and lock out by driving the hips through.",
      "Finish tall without leaning back or turning it into a backbend.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=0nJs6Cnfv3M",
  },
  {
    liftType: "Front Squat",
    standardsRef: { liftType: "Back Squat", ratio: 0.85 },
    cues: [
      "Keep the elbows high so the bar stays stacked on the shoulders.",
      "Brace hard and sit straight down between the hips instead of folding forward.",
      "Drive up with the chest tall and keep the rack position all the way through the rep.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=feGKhZ7unUg",
  },
  {
    liftType: "Barbell Row",
    standardsRef: { liftType: "Bench Press", ratio: 0.8 },
    cues: [
      "Set the back tight before the first rep and hold the torso angle steady.",
      "Pull the bar into the lower chest or upper stomach without jerking the hips.",
      "Lower the bar under control and re-brace before the next rep.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=qbES7k4HDf8",
  },
];

const DEFAULT_ADD_LIFT_CHIPS = COACHED_LIFTS.filter(
  (item) => !BIG_FOUR.some((lift) => lift.name === item.liftType),
).map((item) => ({ name: item.liftType, icon: null }));

const isDev = process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const isClient = useIsClient();
  const prefersReducedMotion = useReducedMotion();
  const {
    parsedData,
    sheetInfo,
    mutate,
    isLoading,
    isValidating,
    isError,
    fetchFailed,
    rawRows,
    dataSyncedAt,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    sessionTonnageLookup,
    isDemoMode,
    isImportedData,
    hasUserData,
  } = useUserLiftingData();
  const { isMetric, toggleIsMetric } = useAthleteBio();
  const { addEntry: addLogEntry, clearEntries } = useDevActivityMonitor();
  const { toast } = useToast();
  const persistedSheetInfo = useMemo(() => {
    if (!isClient) return null;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHEET_INFO);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [isClient]);
  const hasLinkedSheet = hasUserData && !isImportedData;

  useEffect(() => {
    clearEntries();

    return () => {
      clearEntries();
    };
  }, [clearEntries]);

  // --- SWR lifecycle logging ---
  const prevValidatingRef = useRef(isValidating);
  const revalidateStartRef = useRef(null);
  useEffect(() => {
    const was = prevValidatingRef.current;
    prevValidatingRef.current = isValidating;
    if (isValidating && !was) {
      revalidateStartRef.current = performance.now();
      addLogEntry({
        type: "sync",
        label: "SWR revalidating",
        detail: "Fetching fresh sheet data for the log page.",
      });
    }
    if (!isValidating && was) {
      const elapsed = revalidateStartRef.current
        ? Math.round(performance.now() - revalidateStartRef.current)
        : null;
      const suffix = elapsed != null ? ` · ${elapsed}ms` : "";
      if (isError || fetchFailed) {
        addLogEntry({
          type: "swr-error",
          label: "SWR revalidation failed",
          detail: `The latest sheet fetch failed. error=${isError} fetchFailed=${fetchFailed}${suffix}`,
        });
      } else {
        addLogEntry({
          type: "swr-ok",
          label: "SWR revalidation done",
          detail: `${rawRows ?? "?"} raw rows fetched from the sheet${suffix}`,
        });
      }
    }
  }, [isValidating, isError, fetchFailed, rawRows, addLogEntry]);

  const prevParsedLenRef = useRef(parsedData?.length ?? null);
  useEffect(() => {
    const prevLen = prevParsedLenRef.current;
    const newLen = parsedData?.length ?? null;
    prevParsedLenRef.current = newLen;
    if (newLen == null) return;
    if (prevLen == null) {
      addLogEntry({
        type: "sync",
        label: "parsedData ready",
        detail: `The client parser built ${newLen} lift rows from the sheet response.`,
      });
    } else if (newLen !== prevLen) {
      addLogEntry({
        type: "sync",
        label: "parsedData updated",
        detail: `Parsed lift rows changed from ${prevLen} to ${newLen}.`,
      });
    }
  }, [parsedData?.length, addLogEntry]);

  useEffect(() => {
    if (dataSyncedAt) {
      addLogEntry({
        type: "swr-ok",
        label: "dataSyncedAt",
        detail: `Latest sync marker: ${new Date(dataSyncedAt).toLocaleTimeString()}`,
      });
    }
  }, [dataSyncedAt, addLogEntry]);

  // Use local time — new Date().toISOString() is UTC, which causes off-by-one in AU/Asia/Pacific
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const [sessionDate, setSessionDate] = useState(todayIso);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const [isStructuralSaving, setIsStructuralSaving] = useState(false);
  // Row deletes reindex the visible list. A very fast double-click can hit the
  // intended row first, then hit the next row after the list collapses. Keep
  // the per-set trash buttons disabled for a short beat after delete completion
  // so pointer follow-through cannot immediately delete the shifted row.
  const [isDeleteCooldownActive, setIsDeleteCooldownActive] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Optimistic pending sets: { [liftType]: [pendingSetObj, ...] }
  // _pending: true  → in-flight (show spinner)
  // _pending: false → confirmed (rowIndex known, waiting for parsedData to catch up)
  const [pendingSets, setPendingSets] = useState({});
  const pendingSetsRef = useRef({});
  const queuedEditOpsRef = useRef([]);
  const queuedStructuralActionRef = useRef(null);
  const [deletedRowIndices, setDeletedRowIndices] = useState(new Set());
  const autoStartedLiftRef = useRef("");
  const devActivityMonitorVisible =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.DEV_ACTIVITY_MONITOR_VISIBLE, {
      initializeWithValue: false,
    }) ?? false;
  const showActivityMonitor = isDev && devActivityMonitorVisible;

  // Structural mutation guard: prevents concurrent row-shifting API calls
  // (addSet, addLift, deleteSet) that could race on stale row indices.
  // Non-structural updates (PATCH to edit reps/weight/notes) target a fixed
  // rowIndex and never shift other rows, so they bypass this guard.
  // Keep the ref as the source of truth for race protection, and mirror it to
  // state so structural controls can visibly disable while row indices settle.
  const structuralSavingRef = useRef(false);
  const savedTimerRef = useRef(null);
  const deleteCooldownTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (deleteCooldownTimerRef.current)
        clearTimeout(deleteCooldownTimerRef.current);
    };
  }, []);

  // Wrapper that keeps pendingSetsRef synchronously in sync.
  // Using the setState callback form means the updater runs synchronously inside
  // React's reconciler, so the ref is always current before the next render.
  const setPendingSetsSync = useCallback((updater) => {
    setPendingSets((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pendingSetsRef.current = next;
      return next;
    });
  }, []);

  const queueStructuralAction = useCallback(
    (action) => {
      queuedStructuralActionRef.current = action;
      addLogEntry({
        type: "sync",
        label: "Queued structural action",
        detail:
          action.kind === "addSet"
            ? `Will add the next ${action.liftType} set as soon as the current row-shifting write finishes.`
            : `Will add the ${action.liftType} lift block as soon as the current row-shifting write finishes.`,
      });
    },
    [addLogEntry],
  );

  const recordDevSyncTrace = useCallback(
    (entry) => {
      if (!isDev) return;
      addLogEntry({
        type: "trace",
        sessionDate,
        ...entry,
        label: entry.label ?? entry.op,
      });
    },
    [addLogEntry, sessionDate],
  );

  // Sync date from URL param after hydration
  useEffect(() => {
    if (router.query.date && typeof router.query.date === "string") {
      setSessionDate(router.query.date);
    }
  }, [router.query.date]);

  const navigateToDate = useCallback(
    (date) => {
      setSessionDate(date);
      setShowDeleteConfirm(false);
      setPendingSetsSync({});
      setDeletedRowIndices(new Set());
      router.replace(
        { pathname: "/log", query: date !== todayIso ? { date } : {} },
        undefined,
        { shallow: true },
      );
    },
    [router, todayIso, setPendingSetsSync],
  );

  const handleDatePickerSelect = useCallback(
    (date) => {
      if (!date) return;
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      navigateToDate(iso);
      setDatePickerOpen(false);
    },
    [navigateToDate],
  );

  // All unique session dates from parsedData (ascending)
  const sessionDates = useMemo(() => {
    if (!parsedData) return [];
    const seen = new Set();
    const dates = [];
    for (const entry of parsedData) {
      if (!entry.isGoal && !seen.has(entry.date)) {
        seen.add(entry.date);
        dates.push(entry.date);
      }
    }
    return dates;
  }, [parsedData]);

  // In preview mode, if no date was requested and today has no session data,
  // auto-navigate to the most recent session so the user sees actual data
  // instead of an empty state.  Skip when a date query param is present —
  // the user (or heatmap link) explicitly asked for that date.
  const hasAutoNavigatedRef = useRef(false);
  useEffect(() => {
    if (hasAutoNavigatedRef.current) return;
    // Auto-navigate for imported data or demo mode when today has no session
    if (!isImportedData && !isDemoMode) return;
    if (sessionDates.length === 0) return;
    if (router.query.date) return;
    if (sessionDates.includes(sessionDate)) return;
    // Navigate to the most recent session date
    const latestDate = sessionDates[sessionDates.length - 1];
    hasAutoNavigatedRef.current = true;
    navigateToDate(latestDate);
  }, [isImportedData, isDemoMode, sessionDates, sessionDate, navigateToDate, router.query.date]);

  // Session dates as Date objects for the calendar picker modifier highlights
  const sessionDateObjects = useMemo(
    () => sessionDates.map((d) => new Date(d + "T00:00:00")),
    [sessionDates],
  );

  // The currently viewed date as a Date object for the calendar picker
  const selectedDateObj = useMemo(
    () => new Date(sessionDate + "T00:00:00"),
    [sessionDate],
  );

  // Current session entries grouped by lift type (real confirmed data)
  // Excludes optimistically deleted rows so they vanish from the UI immediately.
  const sessionLifts = useMemo(() => {
    if (!parsedData) return {};
    const entries = parsedData.filter(
      (e) =>
        e.date === sessionDate &&
        !e.isGoal &&
        !deletedRowIndices.has(e.rowIndex),
    );
    const grouped = {};
    for (const entry of entries) {
      if (!grouped[entry.liftType]) grouped[entry.liftType] = [];
      grouped[entry.liftType].push(entry);
    }
    return grouped;
  }, [parsedData, sessionDate, deletedRowIndices]);

  // When parsedData catches up, remove confirmed (non-pending) rows from pendingSets
  // to avoid doubling once the real data arrives.
  useEffect(() => {
    const realRowIndices = new Set(
      Object.values(sessionLifts).flatMap((sets) =>
        sets.map((s) => s.rowIndex).filter(Boolean),
      ),
    );
    setPendingSetsSync((prev) => {
      let changed = false;
      const next = {};
      for (const [lt, sets] of Object.entries(prev)) {
        // Keep rows that are still in-flight OR whose rowIndex isn't in real data yet
        const remaining = sets.filter(
          (s) =>
            !deletedRowIndices.has(s.rowIndex) &&
            (s._pending || !realRowIndices.has(s.rowIndex)),
        );
        if (remaining.length !== sets.length) changed = true;
        if (remaining.length) next[lt] = remaining;
      }
      return changed ? next : prev;
    });
  }, [sessionLifts, deletedRowIndices, setPendingSetsSync]);

  // Merge real data with optimistic pending sets.
  // Deduplication: skip confirmed-pending rows whose rowIndex is already in sessionLifts.
  const sessionLiftsWithPending = useMemo(() => {
    const realRowIndices = new Set(
      Object.values(sessionLifts).flatMap((sets) =>
        sets.map((s) => s.rowIndex).filter(Boolean),
      ),
    );
    const merged = { ...sessionLifts };
    for (const [lt, sets] of Object.entries(pendingSets)) {
      const unique = sets.filter(
        (s) =>
          !deletedRowIndices.has(s.rowIndex) &&
          (s._pending || !realRowIndices.has(s.rowIndex)),
      );
      if (unique.length) {
        merged[lt] = [...(merged[lt] ?? []), ...unique];
      }
    }
    return merged;
  }, [sessionLifts, pendingSets, deletedRowIndices]);

  const hasSession = Object.keys(sessionLiftsWithPending).length > 0;
  const usedSessionUrls = useMemo(
    () =>
      new Set(
        Object.values(sessionLiftsWithPending)
          .flat()
          .map((s) => s.URL?.trim())
          .filter(Boolean),
      ),
    [sessionLiftsWithPending],
  );
  const perLiftTonnageStats = useMemo(() => {
    if (!sessionDate || !sessionTonnageLookup) return null;

    return Object.fromEntries(
      Object.entries(sessionLiftsWithPending).map(([liftType, sets]) => {
        const nativeUnitType = sets?.[0]?.unitType ?? "lb";
        const currentLiftTonnage = sets.reduce(
          (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
          0,
        );
        const setCount = sets.length;
        const { average: avgLiftTonnage, sessionCount } =
          getAverageLiftSessionTonnageFromPrecomputed(
            sessionTonnageLookup.sessionTonnageByDateAndLift,
            sessionTonnageLookup.allSessionDates,
            sessionDate,
            liftType,
            nativeUnitType,
          );

        return [
          liftType,
          {
            currentLiftTonnage,
            avgLiftTonnage,
            sessionCount,
            setCount,
            shouldShowComparison:
              setCount >= 4 ||
              (avgLiftTonnage > 0 &&
                currentLiftTonnage >= avgLiftTonnage * 0.4),
            pctDiff:
              avgLiftTonnage > 0
                ? ((currentLiftTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
                : null,
            unitType: nativeUnitType,
          },
        ];
      }),
    );
  }, [sessionDate, sessionLiftsWithPending, sessionTonnageLookup]);
  const isToday = sessionDate === todayIso;
  const effectiveSsid = sheetInfo?.ssid ?? persistedSheetInfo?.ssid ?? null;
  const { dashboardStage, sessionCount } = useMemo(
    () =>
      getDashboardStage({
        parsedData,
        rawRows,
        sheetInfo: sheetInfo ?? persistedSheetInfo,
      }),
    [parsedData, rawRows, sheetInfo, persistedSheetInfo],
  );
  const showSessionBootstrap =
    !isClient ||
    authStatus === "loading" ||
    (authStatus === "authenticated" &&
      !!effectiveSsid &&
      (isLoading || parsedData === null));

  const prevSessionDate = useMemo(() => {
    const earlier = sessionDates.filter((d) => d < sessionDate);
    return earlier.length ? earlier[earlier.length - 1] : null;
  }, [sessionDates, sessionDate]);

  const nextSessionDate = useMemo(() => {
    const later = sessionDates.filter((d) => d > sessionDate);
    if (later.length) return later[0];
    // No future session, but if we're viewing a past date, allow navigating to today
    if (sessionDate < todayIso) return todayIso;
    return null;
  }, [sessionDates, sessionDate, todayIso]);
  const sessionSidebarSummary = useMemo(
    () =>
      getSessionSidebarSummary(
        sessionLiftsWithPending,
        perLiftTonnageStats,
        isMetric ? "kg" : "lb",
      ),
    [sessionLiftsWithPending, perLiftTonnageStats, isMetric],
  );
  const addLiftChips = useMemo(() => {
    const seen = new Set();
    const freq = {};
    if (parsedData) {
      for (const entry of parsedData) {
        if (!entry.isGoal) {
          freq[entry.liftType] = (freq[entry.liftType] ?? 0) + 1;
        }
      }
    }
    const frequentExtras = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ name, icon: null }));
    return [...BIG_FOUR, ...DEFAULT_ADD_LIFT_CHIPS, ...frequentExtras].filter(
      ({ name }) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      },
    );
  }, [parsedData]);

  // --- Unit mismatch nudge ---
  // If 100% of the user's sheet data is in one unit but their SJ preference is
  // the opposite, show a one-time toast so they can switch back easily.
  const unitNudgeShown = useRef(false);
  useEffect(() => {
    if (!parsedData?.length || unitNudgeShown.current) return;
    const realEntries = parsedData.filter((e) => !e.isGoal && e.unitType);
    if (!realEntries.length) return;
    const kgCount = realEntries.filter((e) => e.unitType === "kg").length;
    const allKg = kgCount === realEntries.length;
    const allLb = kgCount === 0;
    const sheetUnit = allKg ? "kg" : allLb ? "lb" : null;
    if (!sheetUnit) return; // mixed units — no nudge
    const prefUnit = isMetric ? "kg" : "lb";
    if (sheetUnit === prefUnit) return; // no mismatch
    unitNudgeShown.current = true;
    toast({
      title: `Your spreadsheet is 100% ${sheetUnit}`,
      description: `New sets will be logged in ${prefUnit}. Switch to ${sheetUnit}?`,
      duration: 10000,
      action: (
        <ToastAction
          altText={`Switch to ${sheetUnit}`}
          onClick={() => toggleIsMetric()}
        >
          Use {sheetUnit}
        </ToastAction>
      ),
    });
  }, [parsedData, isMetric, toast, toggleIsMetric]);

  // Revalidate SWR data when the user leaves the log page so the dashboard
  // picks up any sets/lifts added during the session. Individual writes
  // deliberately skip mutate() to avoid mid-session flicker (see addSet).
  useEffect(() => {
    return () => {
      addLogEntry({
        type: "sync",
        label: "Log page closed",
        detail:
          "Calling mutate() so the dashboard picks up any sheet writes from this session.",
      });
      mutate();
    };
  }, [mutate, addLogEntry]);

  // --- Sync helpers ---
  // Sync strategy note:
  // These client calls are intentionally operation-oriented, not pure REST.
  // The dangerous thing in this UI is not "updating a resource", it is
  // mutating a sparse Google Sheet where row position is unstable during
  // insert/delete flows. So the client talks to explicit sheet operations:
  // - edit-cell
  // - edit-row
  // - insert-row
  // - delete-row
  //
  // Structural ops (addSet/addLift/deleteSet) still gate on structuralSavingRef.
  // Non-structural edits are queued behind that gate when needed so they do not
  // blindly write against a row index while a local row-shifting operation is
  // still in flight.

  function markSaving() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSyncState("saving");
  }

  function markSaved() {
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
    flushQueuedSync();
  }

  function markError() {
    setSyncState("error");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 3000);
    flushQueuedSync();
  }

  function markStructuralSaving() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    structuralSavingRef.current = true;
    setIsStructuralSaving(true);
    setSyncState("saving");
    addLogEntry({
      type: "sync",
      label: "Index-shift guard enabled",
      detail:
        "A structural sheet write is in flight, so fixed-row edits will queue until row positions settle.",
    });
  }

  function markStructuralSaved() {
    structuralSavingRef.current = false;
    setIsStructuralSaving(false);
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
    addLogEntry({
      type: "sync",
      label: "Structural write finished",
      detail:
        "Row positions can be trusted again, so any queued edits may resume.",
    });
    // Flush any queued sync that was waiting for the structural op to finish
    flushQueuedSync();
  }

  function markStructuralError() {
    structuralSavingRef.current = false;
    setIsStructuralSaving(false);
    setSyncState("error");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 3000);
    addLogEntry({
      type: "warning",
      label: "Structural write failed",
      detail:
        "The row-shifting operation did not complete cleanly. Queued edits will be rechecked before they resume.",
    });
    // Still attempt to flush — the structural op failed but queued edits
    // to already-confirmed rows are independent and should still land.
    flushQueuedSync();
  }

  function startDeleteCooldown() {
    if (deleteCooldownTimerRef.current)
      clearTimeout(deleteCooldownTimerRef.current);
    setIsDeleteCooldownActive(true);
    deleteCooldownTimerRef.current = setTimeout(() => {
      setIsDeleteCooldownActive(false);
      deleteCooldownTimerRef.current = null;
    }, 700);
  }

  const updatePendingSet = useCallback(
    (tempId, fields, queuedSync) => {
      let updatedSet = null;
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        for (const [lt, sets] of Object.entries(prev)) {
          next[lt] = sets.map((s) => {
            if (s._tempId !== tempId) return s;
            changed = true;
            updatedSet = {
              ...s,
              reps: fields.reps,
              weight: fields.weight,
              unitType: fields.unitType ?? s.unitType,
              notes: fields.notes ?? "",
              URL: fields.url ?? "",
              _queuedSync: queuedSync,
            };
            return updatedSet;
          });
        }
        return changed ? next : prev;
      });
      return updatedSet;
    },
    [setPendingSetsSync],
  );

  const clearPendingQueuedSync = useCallback(
    (tempId, syncedFields = null) => {
      if (!tempId) return;
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        for (const [lt, sets] of Object.entries(prev)) {
          next[lt] = sets.map((s) => {
            if (s._tempId !== tempId) return s;
            if (!s._queuedSync && !syncedFields) return s;
            changed = true;
            return {
              ...s,
              _queuedSync: false,
              _serverSnapshot: syncedFields
                ? buildSheetSnapshotFromFields(syncedFields, s)
                : s._serverSnapshot,
            };
          });
        }
        return changed ? next : prev;
      });
    },
    [setPendingSetsSync],
  );

  // Promote the first still-pending row for a liftType to confirmed with a real rowIndex.
  const promoteFirstPending = useCallback(
    (liftType, rowIndex) => {
      setPendingSetsSync((prev) => {
        if (!prev[liftType]) return prev;
        let promoted = false;
        const next = prev[liftType].map((s) => {
          if (!promoted && s._pending) {
            promoted = true;
            return { ...s, _pending: false, rowIndex };
          }
          return s;
        });
        return { ...prev, [liftType]: next };
      });
    },
    [setPendingSetsSync],
  );

  const persistSetCellUpdate = useCallback(
    async (rowIndex, field, beforeSnapshot, value) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      const t0 = performance.now();
      recordDevSyncTrace({
        op: "edit-cell",
        phase: "request",
        rowIndex,
        field,
        beforeSnapshot,
        value,
      });
      try {
        const res = await fetch("/api/sheet/edit-cell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex,
            field,
            value,
            before: beforeSnapshot,
          }),
        });
        if (!res.ok) {
          const apiError = await readApiError(res, "Update failed");
          recordDevSyncTrace({
            op: "edit-cell",
            phase: "response",
            rowIndex,
            field,
            ok: false,
            code: apiError.code,
            message: apiError.message,
            actual: apiError.actual,
          });
          if (apiError.code === "PRECONDITION_FAILED") {
            console.error("[sheet/edit-cell] preflight verification failed", {
              rowIndex,
              field,
              beforeSnapshot,
              actual: apiError.actual,
              message: apiError.message,
            });
            addLogEntry({
              type: "warning",
              label: "Edit blocked by index-shift protection",
              detail: apiError.message,
            });
            toast({
              title: "Sheet changed before the edit landed",
              description:
                "This edit was blocked to avoid writing to the wrong row. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            markError();
            return;
          }
          throw new Error(apiError.message || "Update failed");
        }
        recordDevSyncTrace({
          op: "edit-cell",
          phase: "response",
          rowIndex,
          field,
          ok: true,
        });
        markSaved();
      } catch (err) {
        console.error("[sheet/edit-cell] updateSet failed:", err);
        recordDevSyncTrace({
          op: "edit-cell",
          phase: "response",
          rowIndex,
          field,
          ok: false,
          message: err?.message || "Update failed",
        });
        markError();
      }
      logSheetTimings(
        "updateSet",
        [{ name: "POST /api/sheet/edit-cell", ms: performance.now() - t0 }],
        performance.now() - t0,
        addLogEntry,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSaved/markError are stable local sync helpers
    [sheetInfo?.ssid, addLogEntry, toast, recordDevSyncTrace],
  );

  const persistSetRowUpdate = useCallback(
    async (rowIndex, beforeSnapshot, afterSnapshot, tempId = null) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      const t0 = performance.now();
      recordDevSyncTrace({
        op: "edit-row",
        phase: "request",
        rowIndex,
        beforeSnapshot,
        afterSnapshot,
      });
      try {
        const res = await fetch("/api/sheet/edit-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex,
            before: beforeSnapshot,
            after: afterSnapshot,
          }),
        });
        if (!res.ok) {
          const apiError = await readApiError(res, "Update failed");
          recordDevSyncTrace({
            op: "edit-row",
            phase: "response",
            rowIndex,
            ok: false,
            code: apiError.code,
            message: apiError.message,
            actual: apiError.actual,
          });
          if (apiError.code === "PRECONDITION_FAILED") {
            console.error("[sheet/edit-row] preflight verification failed", {
              rowIndex,
              beforeSnapshot,
              afterSnapshot,
              actual: apiError.actual,
              message: apiError.message,
            });
            addLogEntry({
              type: "warning",
              label: "Edit blocked by index-shift protection",
              detail: apiError.message,
            });
            toast({
              title: "Sheet changed before the edit landed",
              description:
                "This edit was blocked to avoid writing to the wrong row. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            markError();
            return;
          }
          throw new Error(apiError.message || "Update failed");
        }
        recordDevSyncTrace({
          op: "edit-row",
          phase: "response",
          rowIndex,
          ok: true,
        });
        clearPendingQueuedSync(tempId, snapshotToEditableFields(afterSnapshot));
        markSaved();
      } catch (err) {
        console.error("[sheet/edit-row] updateSet failed:", err);
        recordDevSyncTrace({
          op: "edit-row",
          phase: "response",
          rowIndex,
          ok: false,
          message: err?.message || "Update failed",
        });
        markError();
      }
      logSheetTimings(
        "updateSet",
        [{ name: "POST /api/sheet/edit-row", ms: performance.now() - t0 }],
        performance.now() - t0,
        addLogEntry,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSaved/markError are stable local sync helpers
    [
      sheetInfo?.ssid,
      clearPendingQueuedSync,
      addLogEntry,
      toast,
      recordDevSyncTrace,
    ],
  );

  const drainQueuedEditOp = useCallback(() => {
    if (structuralSavingRef.current) return;
    const queuedOp = queuedEditOpsRef.current.shift();
    if (!queuedOp) return;
    addLogEntry({
      type: "sync",
      label: "Queued edit resumed",
      detail: `Replaying the queued ${queuedOp.kind} edit now that row ${queuedOp.rowIndex} is safe to target again.`,
    });
    if (queuedOp.kind === "cell") {
      void persistSetCellUpdate(
        queuedOp.rowIndex,
        queuedOp.field,
        queuedOp.beforeSnapshot,
        queuedOp.value,
      );
      return;
    }
    void persistSetRowUpdate(
      queuedOp.rowIndex,
      queuedOp.beforeSnapshot,
      queuedOp.afterSnapshot,
      queuedOp.tempId ?? null,
    );
  }, [addLogEntry, persistSetCellUpdate, persistSetRowUpdate]);

  // Drain queued sync: find the first pending set that has a real rowIndex
  // and a queued edit, then fire the verified row update. Called from the
  // effect below AND
  // from markStructuralSaved/Error so edits that were blocked during a
  // structural op are never permanently lost.
  function flushQueuedSync() {
    if (structuralSavingRef.current) return;
    const queuedSet = Object.values(pendingSetsRef.current)
      .flat()
      .find((s) => !s._pending && s.rowIndex && s._queuedSync);
    if (queuedSet) {
      addLogEntry({
        type: "sync",
        label: "Queued optimistic row edit resumed",
        detail: `The optimistic set now has real row ${queuedSet.rowIndex}, so its queued row update can be sent.`,
      });
      void persistSetRowUpdate(
        queuedSet.rowIndex,
        queuedSet._serverSnapshot ??
          buildSheetSnapshotFromFields(
            getEditableSetFields(queuedSet),
            queuedSet,
          ),
        buildSheetSnapshotFromFields(
          getEditableSetFields(queuedSet),
          queuedSet,
        ),
        queuedSet._tempId,
      );
      return;
    }
    drainQueuedEditOp();
  }

  // Also trigger on pendingSets changes (e.g. when a row gets promoted and
  // its queued edit can now fire).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- flushQueuedSync reads refs, doesn't need to be a dep
  useEffect(() => {
    flushQueuedSync();
  }, [pendingSets, persistSetRowUpdate, drainQueuedEditOp]);

  // --- API calls ---

  // updateSet: fire-and-forget — no await mutate(), SWR will sync on next focus.
  // Pending optimistic rows can be edited before the insert call returns; those
  // edits are queued on the temp row and flushed once it gets a real rowIndex.
  const updateSet = useCallback(
    async (setRef, update) => {
      if (!sheetInfo?.ssid) return;

      const pendingSet = setRef.tempId
        ? Object.values(pendingSetsRef.current)
            .flat()
            .find((s) => s._tempId === setRef.tempId)
        : null;
      const rowIndex = pendingSet?.rowIndex ?? setRef.rowIndex;
      const nextFields = update.nextFields;

      if (pendingSet) {
        updatePendingSet(
          setRef.tempId,
          nextFields,
          !rowIndex || structuralSavingRef.current,
        );
      }

      if (!rowIndex) {
        return;
      }

      if (pendingSet) {
        if (!structuralSavingRef.current) {
          void persistSetRowUpdate(
            rowIndex,
            pendingSet._serverSnapshot ??
              buildSheetSnapshotFromFields(
                getEditableSetFields(pendingSet),
                pendingSet,
              ),
            buildSheetSnapshotFromFields(nextFields, pendingSet),
            setRef.tempId ?? null,
          );
        }
        return;
      }

      const beforeSnapshot = buildSheetSnapshotFromFields(
        update.beforeFields,
        setRef.set,
      );
      if (structuralSavingRef.current) {
        addLogEntry({
          type: "sync",
          label: "Queued fixed-row edit",
          detail: `Held the ${update.field} edit for row ${rowIndex} until the structural write stops shifting rows.`,
        });
        queuedEditOpsRef.current.push({
          kind: "cell",
          rowIndex,
          field: update.field,
          value: getCellValueForField(update.field, nextFields),
          beforeSnapshot,
        });
        return;
      }

      void persistSetCellUpdate(
        rowIndex,
        update.field,
        beforeSnapshot,
        getCellValueForField(update.field, nextFields),
      );
    },
    [
      sheetInfo?.ssid,
      updatePendingSet,
      persistSetCellUpdate,
      persistSetRowUpdate,
      addLogEntry,
    ],
  );

  // deleteSet: removes a single set row from the sheet.
  // The API now decides promotion from the raw target row + raw next row.
  // This lets delete stay correct for both sparse sheets and sheets where the
  // user manually repeats Date / Lift Type more often than the app would.
  const deleteSet = useCallback(
    async (set) => {
      if (!sheetInfo?.ssid || !set.rowIndex) return;
      if (structuralSavingRef.current) return;
      markStructuralSaving();

      let removedPendingRows = [];

      // Optimistically hide the row immediately
      addLogEntry({
        type: "ui",
        label: "deleteSet",
        detail: `You deleted ${set.liftType} ${set.reps}×${set.weight}${set.unitType ?? ""} from row ${set.rowIndex}.`,
      });
      setDeletedRowIndices((prev) => new Set([...prev, set.rowIndex]));
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        removedPendingRows = [];
        for (const [lt, sets] of Object.entries(prev)) {
          const remaining = sets.filter((pendingSet) => {
            const shouldRemove = pendingSet.rowIndex === set.rowIndex;
            if (shouldRemove) {
              changed = true;
              removedPendingRows.push(pendingSet);
            }
            return !shouldRemove;
          });
          if (remaining.length) next[lt] = remaining;
          if (remaining.length !== sets.length) changed = true;
        }
        return changed ? next : prev;
      });
      const timings = [];
      const t0 = performance.now();
      const beforeSnapshot = buildSheetSnapshotFromFields(
        getEditableSetFields(set),
        set,
      );
      recordDevSyncTrace({
        op: "delete-row",
        phase: "request",
        rowIndex: set.rowIndex,
        beforeSnapshot,
      });
      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/delete-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex: set.rowIndex,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/delete-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          recordDevSyncTrace({
            op: "delete-row",
            phase: "response",
            rowIndex: set.rowIndex,
            ok: false,
            code: data?.code || null,
            message: data?.error || "Delete failed",
            actual: data?.actual || null,
          });
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/delete-row] preflight verification failed", {
              rowIndex: set.rowIndex,
              before: buildSheetSnapshotFromFields(
                getEditableSetFields(set),
                set,
              ),
              actual: data?.actual ?? null,
              message: data?.error || "Delete failed",
            });
            addLogEntry({
              type: "warning",
              label: "Delete blocked by index-shift protection",
              detail: data?.error || "Delete failed",
            });
            setDeletedRowIndices((prev) => {
              const next = new Set(prev);
              next.delete(set.rowIndex);
              return next;
            });
            if (removedPendingRows.length) {
              setPendingSetsSync((prev) => {
                const next = { ...prev };
                removedPendingRows.forEach((pendingSet) => {
                  const key = pendingSet.liftType;
                  next[key] = [...(next[key] ?? []), pendingSet];
                });
                return next;
              });
            }
            toast({
              title: "Delete blocked to protect the sheet",
              description:
                "The target row no longer matched what the log expected. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            markStructuralError();
            return;
          }
          throw new Error(data.error || "Delete failed");
        }
        recordDevSyncTrace({
          op: "delete-row",
          phase: "response",
          rowIndex: set.rowIndex,
          ok: true,
        });

        // The deletedRowIndices filter keeps the row hidden in the UI while the
        // background revalidation refreshes canonical row indices. Keep the
        // row-shift guard active until that refresh lands so queued edits/adds
        // do not resume against stale positions.
        await mutate();
        // Clear the hide-flag now that parsedData has settled. If we leave the
        // rowIndex in deletedRowIndices indefinitely, a future insert that gets
        // assigned the same rowIndex (sheets renumber after deletion) will be
        // immediately hidden by the cleanup effect and sessionLiftsWithPending.
        setDeletedRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(set.rowIndex);
          return next;
        });
        startDeleteCooldown();
        markStructuralSaved();
      } catch (err) {
        console.error("[sheet/delete-row] deleteSet failed:", err);
        recordDevSyncTrace({
          op: "delete-row",
          phase: "response",
          rowIndex: set.rowIndex,
          ok: false,
          message: err?.message || "Delete failed",
        });
        // Restore the row on failure
        setDeletedRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(set.rowIndex);
          return next;
        });
        if (removedPendingRows.length) {
          setPendingSetsSync((prev) => {
            const next = { ...prev };
            removedPendingRows.forEach((pendingSet) => {
              const key = pendingSet.liftType;
              next[key] = [...(next[key] ?? []), pendingSet];
            });
            return next;
          });
        }
        markStructuralError();
      }
      logSheetTimings(
        "deleteSet",
        timings,
        performance.now() - t0,
        addLogEntry,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [
      sheetInfo?.ssid,
      toast,
      addLogEntry,
      recordDevSyncTrace,
      setPendingSetsSync,
      mutate,
    ],
  );

  // Add a new set to an existing lift block.
  // Optimistic: row appears immediately with spinner, promoted to confirmed on success.
  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid || !parsedData) return;
      if (structuralSavingRef.current) {
        queueStructuralAction({
          kind: "addSet",
          liftType,
          prevSet: prevSet ?? null,
        });
        return;
      }

      const unitType = prevSet?.unitType ?? (isMetric ? "kg" : "lb");
      const reps = prevSet?.reps ?? 5;
      const weight = prevSet?.weight ?? (isMetric ? 20 : 45);

      // Compute insertion position BEFORE adding to pending, so we can include
      // confirmed-pending rows (promoted on previous successful adds) in the calculation.
      const confirmedPendingRows = (
        pendingSetsRef.current[liftType] ?? []
      ).filter((s) => !s._pending && s.rowIndex);
      const parsedRows = parsedData.filter(
        (e) =>
          e.date === sessionDate &&
          e.liftType === liftType &&
          !e.isGoal &&
          e.rowIndex,
      );
      const predecessorRow = [...parsedRows, ...confirmedPendingRows].reduce(
        (latest, row) =>
          !latest || row.rowIndex > latest.rowIndex ? row : latest,
        null,
      );
      const insertAfterRowIndex = predecessorRow?.rowIndex ?? null;
      const beforeSnapshot = buildSheetSnapshotFromSetLike(predecessorRow);

      // Stable temp key so the SetRow component keeps the same React key through
      // the in-flight → confirmed transition (avoiding a remount/flash).
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Auto-timestamp: 24h clock in the notes column (e.g. "14:35 ")
      const notes =
        prevSet && Object.prototype.hasOwnProperty.call(prevSet, "notes")
          ? (prevSet.notes ?? "")
          : getAutoTimestampNotes();

      // Show optimistic row immediately (in-flight)
      addLogEntry({
        type: "ui",
        label: "addSet",
        detail: `You added ${reps}×${weight}${unitType} to ${liftType}. The new row will be inserted after row ${insertAfterRowIndex ?? "the session header"}.`,
      });
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          {
            date: sessionDate,
            liftType,
            reps,
            weight,
            unitType,
            notes,
            rowIndex: null,
            isGoal: false,
            isHistoricalPR: false,
            _pending: true,
            _tempId: tempId,
            _serverSnapshot: buildSheetSnapshotFromFields(
              { reps, weight, unitType, notes, url: "" },
              { date: sessionDate, liftType },
            ),
          },
        ],
      }));
      const timings = [];
      const t0 = performance.now();
      markStructuralSaving();
      recordDevSyncTrace({
        op: "insert-row",
        phase: "request",
        rowIndex: insertAfterRowIndex,
        insertAfterRowIndex,
        rows: [["", "", String(reps), `${weight}${unitType}`, notes, ""]],
        before: beforeSnapshot,
      });

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/insert-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [["", "", String(reps), `${weight}${unitType}`, notes, ""]],
            insertAfterRowIndex,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/insert-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/insert-row] preflight verification failed", {
              rowIndex: insertAfterRowIndex,
              beforeSnapshot,
              actual: data?.actual ?? null,
              message: data?.error || "Add set failed",
            });
            // If indices drifted, immediately revalidate so a retry can succeed.
            // Keep this lightweight: we already removed the optimistic in-flight row below.
            void mutate();
          }
          throw new Error(data.error || "Add set failed");
        }
        recordDevSyncTrace({
          op: "insert-row",
          phase: "response",
          rowIndex: data?.firstRowIndex ?? null,
          ok: true,
          firstRowIndex: data?.firstRowIndex ?? null,
        });
        const { firstRowIndex } = data;
        // Promote pending → confirmed with the real rowIndex so the optimistic
        // row dedupes cleanly when parsedData catches up.
        promoteFirstPending(liftType, firstRowIndex);
        // Release the structural guard immediately — the promoted row already has
        // the correct rowIndex, so queued follow-ups can compute positions safely.
        // Fire revalidation in the background (no await) to avoid a race where a
        // concurrent focus-triggered SWR fetch overwrites fresh data with stale
        // data and removes the confirmed-pending row from both pendingSets and
        // sessionLifts.
        markStructuralSaved();
        void mutate();
      } catch (err) {
        console.error("[sheet/insert-row] addSet failed:", err);
        recordDevSyncTrace({
          op: "insert-row",
          phase: "response",
          rowIndex: insertAfterRowIndex,
          ok: false,
          message: err?.message || "Add set failed",
        });
        // Remove the failed pending row
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType])
            next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markStructuralError();
      }
      logSheetTimings("addSet", timings, performance.now() - t0, addLogEntry);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [
      sheetInfo?.ssid,
      parsedData,
      sessionDate,
      isMetric,
      setPendingSetsSync,
      promoteFirstPending,
      addLogEntry,
      recordDevSyncTrace,
      queueStructuralAction,
      mutate,
    ],
  );

  // Add a brand-new lift type to the session.
  // Border is only drawn for the very first row of a brand-new session date.
  const addLift = useCallback(
    async (liftType) => {
      if (!sheetInfo?.ssid || !parsedData) return;
      if (structuralSavingRef.current) {
        queueStructuralAction({ kind: "addLift", liftType });
        return;
      }

      const existingSets = sessionLiftsWithPending[liftType] ?? [];
      if (existingSets.length > 0) {
        const lastExistingSet =
          [...existingSets].reverse().find((set) => !set._pending) ??
          existingSets[existingSets.length - 1];
        await addSet(liftType, lastExistingSet ?? null);
        return;
      }

      const unitType = isMetric ? "kg" : "lb";
      const weight = isMetric ? 20 : 45;
      const reps = 5;

      // Read pending state BEFORE updating it, so hasPendingForDate accurately
      // reflects whether any prior lift has already been added to this session.
      const currentPending = pendingSetsRef.current;
      const hasPendingForDate = Object.values(currentPending).some((sets) =>
        sets.some((s) => s.date === sessionDate),
      );

      const sessionRows = parsedData.filter(
        (e) => e.date === sessionDate && !e.isGoal && e.rowIndex,
      );

      // Also include confirmed-pending row indices for correct insertion position
      const confirmedPendingSessionRows = Object.values(currentPending)
        .flat()
        .filter((s) => s.date === sessionDate && !s._pending && s.rowIndex)
        .map((s) => s);
      const allSessionRows = [...sessionRows, ...confirmedPendingSessionRows];

      const hasExistingSession = allSessionRows.length > 0 || hasPendingForDate;

      let predecessorRow = null;
      let topExistingRow = null;

      if (hasExistingSession) {
        // Existing session: insert after the last row of this session
        predecessorRow = allSessionRows.reduce(
          (latest, row) =>
            !latest || row.rowIndex > latest.rowIndex ? row : latest,
          null,
        );
      } else {
        // New session: find correct chronological insertion point.
        // Sheet is newest-first (low rowIndex = newer). For a historical
        // date, insert after the last row whose date is still newer.
        const allRows = [
          ...parsedData.filter((e) => e.rowIndex && !e.isGoal),
          ...Object.values(currentPending)
            .flat()
            .filter((s) => !s._pending && s.rowIndex),
        ];
        const newerRows = allRows.filter((e) => e.date > sessionDate);
        if (newerRows.length > 0) {
          predecessorRow = newerRows.reduce(
            (best, row) => (!best || row.rowIndex > best.rowIndex ? row : best),
            null,
          );
        }
        // Fallback: topExistingRow for beforeSnapshot when inserting at top
        topExistingRow = allRows.reduce(
          (top, row) => (!top || row.rowIndex < top.rowIndex ? row : top),
          null,
        );
      }

      const insertAfterRowIndex = predecessorRow?.rowIndex ?? null;
      const beforeSnapshot = buildSheetSnapshotFromSetLike(
        predecessorRow ?? topExistingRow,
      );

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Auto-timestamp: 24h clock in the notes column (e.g. "14:35 ")
      const notes = getAutoTimestampNotes();

      // Show optimistic lift block immediately (in-flight)
      addLogEntry({
        type: "ui",
        label: "addLift",
        detail: `You added a new ${liftType} block with ${reps}×${weight}${unitType}. It will be inserted after row ${insertAfterRowIndex ?? "the previous sheet content"} as ${hasExistingSession ? "part of the current session" : "a brand-new session"}.`,
      });
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          {
            date: sessionDate,
            liftType,
            reps,
            weight,
            unitType,
            notes,
            rowIndex: null,
            isGoal: false,
            isHistoricalPR: false,
            _pending: true,
            _tempId: tempId,
            _serverSnapshot: buildSheetSnapshotFromFields(
              { reps, weight, unitType, notes, url: "" },
              { date: sessionDate, liftType },
            ),
          },
        ],
      }));
      const timings = [];
      const t0 = performance.now();
      markStructuralSaving();

      const row = [
        hasExistingSession ? "" : sessionDate,
        liftType,
        String(reps),
        `${weight}${unitType}`,
        notes,
        "",
      ];
      recordDevSyncTrace({
        op: "insert-row",
        phase: "request",
        rowIndex: insertAfterRowIndex,
        insertAfterRowIndex,
        rows: [row],
        newSession: !hasExistingSession,
        before: beforeSnapshot,
      });

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/insert-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [row],
            insertAfterRowIndex,
            newSession: !hasExistingSession,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/insert-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/insert-row] preflight verification failed", {
              rowIndex: insertAfterRowIndex,
              beforeSnapshot,
              actual: data?.actual ?? null,
              message: data?.error || "Failed",
            });
            void mutate();
          }
          throw new Error(data.error || "Failed");
        }
        recordDevSyncTrace({
          op: "insert-row",
          phase: "response",
          rowIndex: data?.firstRowIndex ?? null,
          ok: true,
          firstRowIndex: data?.firstRowIndex ?? null,
        });
        const { firstRowIndex } = data;
        promoteFirstPending(liftType, firstRowIndex);
        markStructuralSaved();
        void mutate();
      } catch (err) {
        console.error("[sheet/insert-row] addLift failed:", err);
        recordDevSyncTrace({
          op: "insert-row",
          phase: "response",
          rowIndex: insertAfterRowIndex,
          ok: false,
          message: err?.message || "Failed",
        });
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType])
            next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markStructuralError();
      }
      logSheetTimings("addLift", timings, performance.now() - t0, addLogEntry);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [
      sheetInfo?.ssid,
      parsedData,
      sessionDate,
      isMetric,
      setPendingSetsSync,
      promoteFirstPending,
      addLogEntry,
      recordDevSyncTrace,
      sessionLiftsWithPending,
      addSet,
      queueStructuralAction,
      mutate,
    ],
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid) return;
    if (!Array.isArray(parsedData)) return;
    if (isLoading || isValidating || isError || fetchFailed) return;
    if (showSessionBootstrap) return;

    const startLift =
      typeof router.query.startLift === "string"
        ? router.query.startLift.trim()
        : "";
    if (!startLift) return;

    const requestKey = `${sessionDate}:${startLift}`;
    if (autoStartedLiftRef.current === requestKey) return;
    autoStartedLiftRef.current = requestKey;

    const liftHash = getLiftAnchorId(startLift);
    const nextUrl = {
      pathname: "/log",
      query: sessionDate !== todayIso ? { date: sessionDate } : {},
      hash: liftHash,
    };
    const hasLiftInSession = Boolean(
      sessionLiftsWithPending[startLift]?.length,
    );

    if (hasSession && hasLiftInSession) {
      router.replace(nextUrl, undefined, { shallow: true });
      return;
    }

    void addLift(startLift).finally(() => {
      router.replace(nextUrl, undefined, { shallow: true });
    });
  }, [
    addLift,
    authStatus,
    fetchFailed,
    hasSession,
    isError,
    isLoading,
    isValidating,
    parsedData,
    router,
    sessionDate,
    sheetInfo?.ssid,
    sessionLiftsWithPending,
    showSessionBootstrap,
    todayIso,
  ]);

  useEffect(() => {
    // Structural actions (insert/delete row ranges) cannot safely run in
    // parallel because row indices shift. Rather than dropping a fast follow-up
    // click, keep the latest requested add action here and replay it once the
    // current structural op settles.
    if (structuralSavingRef.current) return;
    if (syncState !== "saved" && syncState !== "error") return;

    const queuedAction = queuedStructuralActionRef.current;
    if (!queuedAction) return;

    queuedStructuralActionRef.current = null;
    addLogEntry({
      type: "sync",
      label: "Queued structural action resumed",
      detail:
        queuedAction.kind === "addSet"
          ? `Resuming the queued ${queuedAction.liftType} set add after the previous structural write finished.`
          : `Resuming the queued ${queuedAction.liftType} lift-block add after the previous structural write finished.`,
    });

    if (queuedAction.kind === "addSet") {
      void addSet(queuedAction.liftType, queuedAction.prevSet ?? null);
      return;
    }

    void addLift(queuedAction.liftType);
  }, [syncState, addSet, addLift, addLogEntry]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const anchorEl = document.getElementById(hash);
    if (!anchorEl) return;

    anchorEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [router.asPath, sessionLiftsWithPending]);

  const deleteSession = useCallback(async () => {
    if (!sheetInfo?.ssid || !parsedData || structuralSavingRef.current) return;
    markStructuralSaving();

    const sessionRows = parsedData
      .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    if (!sessionRows.length) return;

    const minRow = Math.min(...sessionRows);
    const maxRow = Math.max(...sessionRows);

    const otherRows = parsedData
      .filter((e) => e.date !== sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    const rowsAfter = otherRows.filter((r) => r > maxRow);
    const nearestAfter = rowsAfter.length ? Math.min(...rowsAfter) : null;
    const endRow = nearestAfter ? nearestAfter - 1 : maxRow;

    addLogEntry({
      type: "ui",
      label: "deleteSession",
      detail: `You deleted the ${sessionDate} session, which spans rows ${minRow}-${endRow} (${endRow - minRow + 1} rows).`,
    });
    const timings = [];
    const t0 = performance.now();
    recordDevSyncTrace({
      op: "delete-session",
      phase: "request",
      startRowIndex: minRow,
      endRowIndex: endRow,
      expectedDate: sessionDate,
      rowIndex: minRow,
    });

    try {
      const tApi = performance.now();
      const res = await fetch("/api/sheet/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: sheetInfo.ssid,
          startRowIndex: minRow,
          endRowIndex: endRow,
          expectedDate: sessionDate,
        }),
      });
      timings.push({
        name: "DELETE /api/sheet/delete",
        ms: performance.now() - tApi,
      });
      const data = await res.json();
      if (!res.ok) {
        recordDevSyncTrace({
          op: "delete-session",
          phase: "response",
          startRowIndex: minRow,
          endRowIndex: endRow,
          rowIndex: minRow,
          ok: false,
          code: data?.code || null,
          message: data?.error || "Delete failed",
        });
        if (data.warning) {
          addLogEntry({
            type: "warning",
            label: "Session delete warning",
            detail: data.warning,
          });
        }
        throw new Error(data.error || "Delete failed");
      }
      recordDevSyncTrace({
        op: "delete-session",
        phase: "response",
        startRowIndex: minRow,
        endRowIndex: endRow,
        rowIndex: minRow,
        ok: true,
      });
      addLogEntry({
        type: "sync",
        label: "Full revalidation requested",
        detail:
          "Calling mutate() after the session delete so the in-memory log matches the sheet immediately.",
      });
      await mutate();
      markStructuralSaved();
      setShowDeleteConfirm(false);
      const remainingDates = sessionDates.filter((d) => d !== sessionDate);
      if (remainingDates.length) {
        navigateToDate(remainingDates[remainingDates.length - 1]);
      } else {
        navigateToDate(todayIso);
      }
    } catch (err) {
      console.error("[sheet/delete] deleteSession failed:", err);
      recordDevSyncTrace({
        op: "delete-session",
        phase: "response",
        startRowIndex: minRow,
        endRowIndex: endRow,
        rowIndex: minRow,
        ok: false,
        message: err?.message || "Delete failed",
      });
      markStructuralError();
    }
    logSheetTimings(
      "deleteSession",
      timings,
      performance.now() - t0,
      addLogEntry,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
  }, [
    sheetInfo?.ssid,
    parsedData,
    sessionDate,
    sessionDates,
    todayIso,
    mutate,
    navigateToDate,
    addLogEntry,
  ]);

  // --- Render ---

  // Preview mode: imported data, demo data, or unauthenticated.
  // In preview mode the full session browser renders but all write UI is hidden.
  const previewMode = !hasLinkedSheet;

  const liftCardTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: "easeOut" };
  const liftCardInitial = prefersReducedMotion
    ? { opacity: 1, height: "auto" }
    : { opacity: 0, y: 12, scale: 0.985, height: 0 };
  const liftCardAnimate = prefersReducedMotion
    ? { opacity: 1, height: "auto" }
    : { opacity: 1, y: 0, scale: 1, height: "auto" };
  const liftCardExit = prefersReducedMotion
    ? { opacity: 0, height: 0 }
    : { opacity: 0, y: -8, scale: 0.985, height: 0 };
  const secondaryQuoteCard = (
    <InspirationCard
      key={sessionDate}
      seedKey={sessionDate}
      title={isToday ? "For today" : "Training note"}
      variant="rail"
      delayedReveal
      revealDelayMs={1500}
    />
  );

  return (
    <div className="mx-auto max-w-[116rem] px-3 pb-24 sm:px-4">
      <Head>
        <link rel="canonical" href="https://www.strengthjourneys.xyz/log" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: CELEBRATION_KEYFRAMES }} />
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_minmax(0,1fr)] xl:gap-16 2xl:gap-20">
        <aside className="hidden xl:block">
          <div className="sticky top-20 mr-auto w-full max-w-[9rem] space-y-4 pt-3 2xl:max-w-[10rem]">
            {secondaryQuoteCard}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="w-full max-w-[56rem]">
            <div className="border-border/40 bg-background/95 sticky top-0 z-[5] flex items-center gap-2 border-b py-3 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={!prevSessionDate}
                onClick={() => navigateToDate(prevSessionDate)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="relative flex-1 text-center">
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="hover:bg-muted/40 group mx-auto inline-flex flex-col items-center rounded-md px-3 py-1 transition-colors"
                      aria-label="Pick a date"
                    >
                      <span className="inline-flex items-center gap-1.5 text-lg leading-tight font-semibold">
                        <Calendar className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                        <span className="decoration-muted-foreground/50 group-hover:decoration-foreground/50 underline decoration-dotted underline-offset-4">
                          {isToday
                            ? "Today"
                            : getReadableDateString(sessionDate, true)}
                        </span>
                      </span>
                      {isToday ? (
                        <span className="text-muted-foreground text-xs">
                          {getReadableDateString(sessionDate, true)}
                        </span>
                      ) : null}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <CalendarWidget
                      mode="single"
                      selected={selectedDateObj}
                      onSelect={handleDatePickerSelect}
                      disabled={{ after: new Date() }}
                      modifiers={{ hasSession: sessionDateObjects }}
                      modifiersClassNames={{
                        hasSession: "bg-primary/15 font-semibold text-primary",
                      }}
                      defaultMonth={selectedDateObj}
                    />
                    {!isToday && (
                      <div className="border-border border-t px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            navigateToDate(todayIso);
                            setDatePickerOpen(false);
                          }}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Back to today
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {!previewMode && <SyncIndicator state={syncState} />}

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={!nextSessionDate}
                onClick={() => navigateToDate(nextSessionDate)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {showSessionBootstrap && <LogSessionSkeleton />}

            {!showSessionBootstrap && !isLoading && !hasSession && (
              <div className="mt-6 flex flex-col items-center gap-6">
                {previewMode ? (
                  <div className="space-y-1 text-center">
                    <h2 className="text-xl font-semibold">
                      No session on this date
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Use the arrows to browse other training days.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-center">
                      <h2 className="text-xl font-semibold">
                        {isToday
                          ? "Start today's session"
                          : "Start a session for this date"}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        Pick a lift to begin.
                      </p>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
                      {BIG_FOUR.map(({ name, icon }) => (
                        <button
                          key={name}
                          title={`Start with ${name}`}
                          onClick={() => addLift(name)}
                          className="border-border bg-card hover:border-primary hover:bg-muted/40 flex flex-col items-center gap-4 rounded-xl border px-4 py-6 shadow-sm transition-colors active:scale-95 md:gap-5 md:py-8"
                        >
                          <Image
                            src={icon}
                            alt={name}
                            width={80}
                            height={80}
                            className="h-20 w-20 md:h-28 md:w-28"
                          />
                          <span className="text-sm leading-tight font-medium">
                            {name}
                          </span>
                        </button>
                      ))}
                    </div>

                    <AddLiftButton
                      parsedData={parsedData}
                      onAddLift={addLift}
                      chips={addLiftChips}
                      label="Add other lift type"
                      disabled={isStructuralSaving}
                    />
                  </>
                )}
              </div>
            )}

            {!showSessionBootstrap && hasSession && (
              <div className="space-y-5">
                <AnimatePresence initial={false}>
                  {Object.entries(sessionLiftsWithPending).map(
                    ([liftType, sets]) => (
                      <motion.div
                        key={`${sessionDate}-${liftType}`}
                        id={getLiftAnchorId(liftType)}
                        layout
                        initial={liftCardInitial}
                        animate={liftCardAnimate}
                        exit={liftCardExit}
                        transition={liftCardTransition}
                        className="scroll-mt-24 overflow-y-hidden md:mx-[-1rem] lg:mx-[-1.5rem]"
                      >
                        <LiftBlock
                          liftType={liftType}
                          sets={sets}
                          parsedData={parsedData}
                          sessionDate={sessionDate}
                          isMetric={isMetric}
                          topLiftsByTypeAndReps={topLiftsByTypeAndReps}
                          topLiftsByTypeAndRepsLast12Months={
                            topLiftsByTypeAndRepsLast12Months
                          }
                          tonnageStats={perLiftTonnageStats?.[liftType] ?? null}
                          dashboardStage={dashboardStage}
                          sessionCount={sessionCount}
                          isPastSession={!isToday}
                          isStructuralSaving={isStructuralSaving}
                          isDeleteCooldownActive={isDeleteCooldownActive}
                          previewMode={previewMode}
                          onUpdateSet={previewMode ? undefined : updateSet}
                          onDeleteSet={previewMode ? undefined : deleteSet}
                          onAddSet={previewMode ? undefined : (prevSet) => addSet(liftType, prevSet)}
                          onNavigateToDate={previewMode ? undefined : navigateToDate}
                          usedSessionUrls={usedSessionUrls}
                        />
                      </motion.div>
                    ),
                  )}
                </AnimatePresence>

                {!previewMode && (
                  <>
                    <AddLiftButton
                      parsedData={parsedData}
                      onAddLift={addLift}
                      chips={addLiftChips}
                      disabled={isStructuralSaving}
                    />

                    <div className="flex justify-center pt-2">
                      {!showDeleteConfirm ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive gap-2"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete this session
                        </Button>
                      ) : (
                        <div className="border-destructive/30 bg-destructive/5 flex items-center gap-3 rounded-lg border px-4 py-3">
                          <p className="text-muted-foreground text-sm">
                            {isStructuralSaving
                              ? "Finish the current sheet change, then delete this session."
                              : `Delete all rows for ${sessionDate}?`}
                          </p>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={deleteSession}
                            disabled={isStructuralSaving}
                          >
                            {isStructuralSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Waiting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {showActivityMonitor && (
              <div className="border-border/40 mt-8 border-t pt-6">
                <DevActivityMonitorPanel className="max-h-[70vh]" />
              </div>
            )}

            <div className="mt-10 hidden lg:block xl:hidden">
              <div className="max-w-[11rem]">{secondaryQuoteCard}</div>
            </div>
          </div>
        </main>

        <aside className="hidden xl:block" aria-hidden="true" />
      </div>
    </div>
  );
}

function isEarlyStrengthJourneyStage(dashboardStage) {
  return (
    dashboardStage === "starter_sample" ||
    dashboardStage === "first_real_week" ||
    dashboardStage === "first_month"
  );
}

function getDaysBetweenDates(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function getJourneyTechniqueAssist({
  liftType,
  dashboardStage,
  priorLiftDates = [],
  sessionDate,
}) {
  const match = COACHED_LIFTS.find((item) => item.liftType === liftType);
  if (!match) return null;

  const defaultCues = match.cues ?? [];
  const videoAssist = match.videoUrl
    ? {
        slug: match.slug ?? null,
        videoUrl: match.videoUrl,
        prompt: `Need a quick ${liftType} form check?`,
      }
    : null;
  const mostRecentLiftDate = priorLiftDates.length
    ? priorLiftDates[priorLiftDates.length - 1]
    : null;
  const isLiftReintroduction =
    !!mostRecentLiftDate &&
    !!sessionDate &&
    getDaysBetweenDates(mostRecentLiftDate, sessionDate) > 42;
  const shouldShowFullAssist =
    isEarlyStrengthJourneyStage(dashboardStage) ||
    !mostRecentLiftDate ||
    isLiftReintroduction;
  const cues = shouldShowFullAssist ? defaultCues : [];

  if (!cues.length && !videoAssist) return null;

  return {
    cues,
    videoAssist,
  };
}

function getFirstTimeEmptyButtons({
  liftType,
  barWeight,
  minIncrement,
  unitType,
}) {
  const lightJumpWeight =
    liftType === "Deadlift"
      ? barWeight + minIncrement * 2
      : barWeight + minIncrement;

  if (liftType === "Deadlift") {
    return [
      {
        label: `5@${barWeight}${unitType}`,
        sublabel: "bar only",
        reps: 5,
        weight: barWeight,
        unitType,
        variant: "primary",
      },
      {
        label: `5@${barWeight + minIncrement}${unitType}`,
        sublabel: "small jump",
        reps: 5,
        weight: barWeight + minIncrement,
        unitType,
        variant: "secondary",
      },
      {
        label: `5@${lightJumpWeight}${unitType}`,
        sublabel: "light starter",
        reps: 5,
        weight: lightJumpWeight,
        unitType,
        variant: "outline",
      },
    ];
  }

  return [
    {
      label: `10@${barWeight}${unitType}`,
      sublabel: "empty bar",
      reps: 10,
      weight: barWeight,
      unitType,
      variant: "primary",
    },
    {
      label: `5@${barWeight}${unitType}`,
      sublabel: "groove reps",
      reps: 5,
      weight: barWeight,
      unitType,
      variant: "secondary",
    },
    {
      label: `5@${lightJumpWeight}${unitType}`,
      sublabel: "light starter",
      reps: 5,
      weight: lightJumpWeight,
      unitType,
      variant: "outline",
    },
  ];
}

function getFirstTimeTargetWeight({
  standards,
  liftType,
  barWeight,
  minIncrement,
}) {
  let physicallyActiveWeight = standards?.[liftType]?.physicallyActive;

  if (!physicallyActiveWeight || physicallyActiveWeight <= 0) {
    const ref = COACHED_LIFTS.find(
      (l) => l.liftType === liftType,
    )?.standardsRef;
    if (ref) {
      const base = standards?.[ref.liftType]?.physicallyActive;
      if (base > 0) physicallyActiveWeight = base * ref.ratio;
    }
  }

  if (!physicallyActiveWeight || physicallyActiveWeight <= 0) return null;

  return Math.max(
    barWeight,
    Math.ceil(physicallyActiveWeight / minIncrement) * minIncrement,
  );
}

function getFirstTimeProgressionButtons({
  progression,
  realSets,
  isMetric,
  unitType,
  minIncrement,
}) {
  if (!progression?.length) return [];

  const loggedSets = realSets.filter((set) => set.weight > 0);
  const loggedWeights = loggedSets.map(
    (set) => getDisplayWeight(set, isMetric).value,
  );
  let nextWarmupIdx = 0;

  if (loggedWeights.length > 0) {
    const maxLogged = Math.max(...loggedWeights);
    nextWarmupIdx = progression.findIndex((set) => set.weight > maxLogged);
    if (nextWarmupIdx === -1) nextWarmupIdx = progression.length;
  }

  const buttons = [];
  const seen = new Set();
  const pushButton = ({ reps, weight, sublabel, variant }) => {
    const key = `${reps}-${weight}`;
    if (seen.has(key)) return;
    seen.add(key);
    buttons.push({
      label: `${reps}@${weight}${unitType}`,
      sublabel,
      reps,
      weight,
      unitType,
      variant,
    });
  };

  if (nextWarmupIdx < progression.length) {
    const nextSet = progression[nextWarmupIdx];
    const followingSet = progression[nextWarmupIdx + 1];
    const topSet = progression[progression.length - 1];

    pushButton({
      reps: nextSet.reps,
      weight: nextSet.weight,
      sublabel: nextSet.isTopSet ? "today's target" : "next warmup",
      variant: "primary",
    });

    if (followingSet && !followingSet.isTopSet) {
      pushButton({
        reps: followingSet.reps,
        weight: followingSet.weight,
        sublabel: "then this",
        variant: "secondary",
      });
    }

    if (!nextSet.isTopSet) {
      pushButton({
        reps: topSet.reps,
        weight: topSet.weight,
        sublabel: "today's target",
        variant: "outline",
      });
    }

    return buttons;
  }

  const lastLoggedSet = loggedSets[loggedSets.length - 1];
  if (!lastLoggedSet) return [];

  const lastLoggedWeight = getDisplayWeight(lastLoggedSet, isMetric).value;
  const lastLoggedReps = lastLoggedSet.reps ?? 5;

  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight,
    sublabel: "repeat",
    variant: "secondary",
  });
  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight + minIncrement,
    sublabel: "small jump",
    variant: "primary",
  });
  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight + minIncrement * 2,
    sublabel: "if it felt easy",
    variant: "outline",
  });

  return buttons;
}

function getInSessionCoachingCopy({
  mode,
  dashboardStage,
  liftType,
  minIncrement,
  unitType,
  hasReachedTarget = false,
  workSetCount = 0,
}) {
  const earlyStage = isEarlyStrengthJourneyStage(dashboardStage);

  if (mode === "firstLiftEmpty") {
    return earlyStage
      ? {
          eyebrow: "First lift",
          title: `First time logging ${liftType}?`,
          body: "Start with an empty bar and work up to a moderate weight.",
          effortCue:
            "Keep the weight easy enough that technique stays clean. You should finish with 2-3 reps left if needed.",
        }
      : {
          eyebrow: "New lift",
          title: `${liftType} starts lighter than you think`,
          body: "Use the first set to find the groove, not to impress the logbook.",
          effortCue: "Add only small jumps while the reps stay crisp.",
        };
  }

  if (mode === "firstLiftInProgress") {
    if (hasReachedTarget) {
      if (liftType === "Deadlift") {
        return {
          eyebrow: null,
          title: null,
          body: "Great, that's your top work set.",
          effortCue:
            "Deadlift usually wants just one heavy set of 5. Stop here, or go a little heavier if that felt too easy.",
        };
      }

      if (workSetCount >= 3) {
        return {
          eyebrow: null,
          title: null,
          body: `You can stop doing ${liftType} now.`,
          effortCue:
            "Feel free to go do some curls in the squat rack or hit your local fast food franchise.",
        };
      }

      if (workSetCount === 2) {
        return {
          eyebrow: null,
          title: null,
          body: "Nice, now just do 1 more set of 5 at this weight.",
          effortCue: "Keep it tidy and call the lift there for today.",
        };
      }

      return {
        eyebrow: null,
        title: null,
        body: "Great, that's your first work set.",
        effortCue: "Now aim for 2 more sets of 5 at this same weight.",
      };
    }

    return earlyStage
      ? {
          eyebrow: null,
          title: null,
          body: "Keep adding weight while the reps stay clean and confident.",
          effortCue: "Stop when it feels heavy, not grindy or impossible.",
        }
      : {
          eyebrow: null,
          title: null,
          body: "Keep adding weight while the reps stay clean and confident.",
          effortCue: "Stop when it feels heavy, not grindy or impossible.",
        };
  }

  return null;
}

function getNonBigFourThreeByFiveCoaching(liftType) {
  return {
    eyebrow: null,
    title: null,
    body: `${liftType} usually goes well as 3x5.`,
    effortCue:
      "If these sets felt solid, you've probably done enough for today.",
  };
}

// Color-coded timing log for sheet API calls.
// Single-step calls print one line; multi-step calls print a grouped breakdown + total.
// Also pushes an entry to the optional addLogEntry callback for the UI activity panel.
function logSheetTimings(label, timings, totalMs, addLogEntry) {
  if (!isDev) return;
  const total = Math.round(totalMs);
  const color = total < 500 ? "#22c55e" : total < 1500 ? "#f59e0b" : "#ef4444";

  if (timings.length <= 1) {
    console.log(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
  } else {
    const nameWidth = Math.max(...timings.map((t) => t.name.length));
    console.groupCollapsed(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    timings.forEach((t) => {
      const ms = Math.round(t.ms);
      const c = ms < 500 ? "#22c55e" : ms < 1500 ? "#f59e0b" : "#ef4444";
      console.log(
        `  %c${t.name.padEnd(nameWidth)}%c  %c${String(ms).padStart(5)}ms`,
        "font-weight:bold",
        "color:inherit",
        `color:${c};font-weight:bold`,
      );
    });
    const divider = "─".repeat(nameWidth + 10);
    console.log(`  ${divider}`);
    console.log(
      `  %c${"Total".padEnd(nameWidth)}%c  %c${String(total).padStart(5)}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    console.groupEnd();
  }

  if (addLogEntry) {
    const detail =
      timings.length > 1
        ? timings.map((t) => `${t.name} ${Math.round(t.ms)}ms`).join(" → ")
        : "";
    addLogEntry({ type: "timing", label, total, detail, color });
  }
}

function getAutoTimestampNotes() {
  return `${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} `;
}

function getEditableSetFields(set) {
  return {
    reps: set.reps,
    weight: set.weight,
    unitType: set.unitType ?? "",
    notes: set.notes ?? "",
    url: set.URL ?? "",
  };
}

function buildSheetSnapshotFromFields(fields, identity = {}) {
  return {
    date: identity.date ?? "",
    // Verified sheet writes must match the original sheet label, not the
    // normalized app label, so aliased rows (for example "OHP") stay editable.
    liftType: identity.rawLiftType ?? identity.liftType ?? "",
    reps: fields.reps != null ? String(fields.reps) : "",
    weight:
      fields.weight != null ? `${fields.weight}${fields.unitType ?? ""}` : "",
    notes: fields.notes ?? "",
    url: fields.url ?? "",
  };
}

function buildSheetSnapshotFromSetLike(set) {
  if (!set) return null;
  if (set._serverSnapshot) return set._serverSnapshot;
  const fields = getEditableSetFields(set);
  return {
    date: set.date ?? "",
    // Use rawLiftType to match exact sheet label (e.g. "OHP") not normalized form
    liftType: set.rawLiftType ?? set.liftType ?? "",
    reps: fields.reps != null ? String(fields.reps) : "",
    // Use rawWeight (original sheet string) to avoid unit-suffix mismatch:
    // old data has "100" in the sheet; normalized weight + unitType gives "100lb", causing 409.
    weight:
      set.rawWeight != null
        ? set.rawWeight
        : fields.weight != null
          ? `${fields.weight}${fields.unitType ?? ""}`
          : "",
    notes: fields.notes ?? "",
    url: fields.url ?? "",
  };
}

function snapshotToEditableFields(snapshot) {
  const weightValue =
    typeof snapshot?.weight === "string"
      ? parseFloat(snapshot.weight)
      : snapshot?.weight;
  const unitMatch =
    typeof snapshot?.weight === "string"
      ? snapshot.weight.match(/[a-zA-Z]+$/)
      : null;
  return {
    reps: snapshot?.reps != null ? Number(snapshot.reps) : "",
    weight: Number.isNaN(weightValue) ? "" : weightValue,
    unitType: unitMatch?.[0] ?? "",
    notes: snapshot?.notes ?? "",
    url: snapshot?.url ?? "",
  };
}

function getCellValueForField(field, fields) {
  if (field === "reps") return fields.reps != null ? String(fields.reps) : "";
  if (field === "weight")
    return fields.weight != null
      ? `${fields.weight}${fields.unitType ?? ""}`
      : "";
  if (field === "notes") return fields.notes ?? "";
  if (field === "url") return fields.url ?? "";
  return "";
}

async function readApiError(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  return {
    message: payload?.error || fallbackMessage,
    code: payload?.code || null,
    actual: payload?.actual || null,
  };
}



// --- Strength bar for log page ---

function LogStrengthBar({
  liftType,
  e1rmValue,
  standards,
  age,
  sessionDate,
  bodyWeight,
  sex,
  isMetric,
}) {
  const standard =
    sessionDate && age && bodyWeight != null && sex != null
      ? getStandardForLiftDate(
          age,
          sessionDate,
          bodyWeight,
          sex,
          liftType,
          isMetric ?? false,
        )
      : standards?.[liftType];

  if (!standard?.elite || !e1rmValue) return null;

  const rating = getStrengthRatingForE1RM(e1rmValue, standard);
  if (!rating) return null;

  const emoji = STRENGTH_LEVEL_EMOJI[rating] ?? "";
  const { physicallyActive, elite } = standard;
  const range = elite - physicallyActive;
  const pct =
    range > 0
      ? Math.min(
          98,
          Math.max(2, ((e1rmValue - physicallyActive) / range) * 100),
        )
      : 50;

  const nextTierInfo = NEXT_TIER[rating];
  const nextTierValue = nextTierInfo ? standard[nextTierInfo.key] : null;
  const diff = nextTierValue ? Math.ceil(nextTierValue - e1rmValue) : null;
  const unit = isMetric ? "kg" : "lb";

  // Tier divider positions
  const tiers = [standard.beginner, standard.intermediate, standard.advanced]
    .map((val) => ((val - physicallyActive) / range) * 100)
    .filter((p) => p > 0 && p < 100);

  const LIFT_STRENGTH_SLUGS = {
    "Back Squat": "squat",
    "Bench Press": "bench-press",
    "Deadlift": "deadlift",
    "Strict Press": "strict-press",
  };
  const strengthHref = LIFT_STRENGTH_SLUGS[liftType]
    ? `/strength-levels/${LIFT_STRENGTH_SLUGS[liftType]}`
    : "/strength-levels";

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Link
          href={strengthHref}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[10px] font-medium transition-colors"
        >
          {emoji} {rating}
        </Link>
        <div className="relative flex-1">
          <div
            className="h-2 w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, #EAB308, #86EFAC, #166534)",
            }}
          />
          {tiers.map((p, i) => (
            <div
              key={i}
              className="absolute top-0 h-2 w-px"
              style={{
                left: `${p}%`,
                backgroundColor: "var(--background)",
                opacity: 0.7,
              }}
            />
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="bg-foreground ring-background absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-1 transition-[left] duration-300"
                style={{ left: `${pct}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">{liftType}</p>
              <p>
                {emoji} {rating} · E1RM {Math.round(e1rmValue)}
                {unit}
              </p>
              {nextTierInfo && diff > 0 ? (
                <p className="text-muted-foreground">
                  {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""}{" "}
                  {nextTierInfo.name} — {diff}
                  {unit} away
                </p>
              ) : nextTierInfo && diff <= 0 ? (
                <p className="text-muted-foreground">
                  {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""}{" "}
                  {nextTierInfo.name} — you&apos;re there!
                </p>
              ) : (
                <p className="text-muted-foreground">Top of the chart!</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

function LogLiftPercentileLine({
  liftType,
  e1rmValue,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const percentileKey = LIFT_TYPE_TO_PERCENTILE_KEY[liftType];
  const calculatorUrl = LIFT_TYPE_TO_CALCULATOR_URL[liftType] ?? "/calculator";

  const bestUniverse = useMemo(() => {
    if (!percentileKey || !e1rmValue || !age || bodyWeight == null || !sex) {
      return null;
    }

    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    const e1rmKg = isMetric ? e1rmValue : e1rmValue / 2.2046;
    const allPercentiles = getLiftPercentiles(
      age,
      bodyWeightKg,
      sex === "female" ? "female" : "male",
      percentileKey,
      e1rmKg,
    );
    if (!allPercentiles) return null;

    // Pick the most elite (rightmost) universe where percentile >= 60
    const labels = {
      "General Population": "the general population",
      "Gym-Goers": "gym-goers",
      "Barbell Lifters": "barbell lifters",
      "Powerlifting Culture": "the powerlifting community",
    };

    let best = null;
    for (const universe of UNIVERSES) {
      const pct = allPercentiles[universe];
      if (pct != null && pct >= 60) {
        best = { universe, percentile: pct, label: labels[universe] };
      }
    }
    return best;
  }, [age, bodyWeight, e1rmValue, isMetric, percentileKey, sex]);

  if (!bestUniverse) return null;

  return (
    <div className="text-xs text-muted-foreground">
      <Link href={calculatorUrl} className="transition-colors hover:text-foreground">
        Stronger than {bestUniverse.percentile}% of {bestUniverse.label}
      </Link>
    </div>
  );
}

// --- Lift block ---

function LiftBlock({
  liftType,
  sets,
  parsedData,
  sessionDate,
  isMetric,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
  tonnageStats,
  dashboardStage,
  sessionCount = 0,
  isPastSession,
  isStructuralSaving = false,
  isDeleteCooldownActive = false,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
  onNavigateToDate,
  previewMode = false,
  usedSessionUrls,
}) {
  const { hasUserData, isDemoMode, isImportedData } = useUserLiftingData();
  const { age, bodyWeight, sex, standards } = useAthleteBio();
  const { getColor } = useLiftColors();
  const prefersReducedMotion = useReducedMotion();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  // Only use confirmed (non-pending) sets for last-set reference
  const realSets = sets.filter((s) => !s._pending);
  const lastRealSet = realSets[realSets.length - 1];
  const bigFourEntry = BIG_FOUR.find((b) => b.name === liftType);
  const liftColor = getColor(liftType);
  const liftBlockRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const activeCelebrationTimerRef = useRef(null);
  const initialCelebrationPassRef = useRef(true);
  const previousCelebrationKeysRef = useRef(new Map());
  const [isCelebrationShaking, setIsCelebrationShaking] = useState(false);
  const [activeCelebrationKey, setActiveCelebrationKey] = useState(null);
  const [optimisticFieldsByKey, setOptimisticFieldsByKey] = useState({});
  const [customDraftSeed, setCustomDraftSeed] = useState(0);
  const [customDraftConfig, setCustomDraftConfig] = useState(null);
  const [initialPassiveRowKeys] = useState(
    () =>
      new Set(
        sets.map((set, index) => getSetIdentityKey(set, `initial-${index}`)),
      ),
  );
  const [initialPassiveRowOrder] = useState(
    () =>
      new Map(
        sets.map((set, index) => [
          getSetIdentityKey(set, `initial-${index}`),
          index,
        ]),
      ),
  );
  const trainingAgeYears = useMemo(
    () => getTrainingAgeYears(parsedData, sessionDate),
    [parsedData, sessionDate],
  );

  const handleOptimisticFieldsChange = useCallback((rowKey, fields) => {
    if (!rowKey) return;
    setOptimisticFieldsByKey((prev) => {
      if (!fields) {
        if (!(rowKey in prev)) return prev;
        const next = { ...prev };
        delete next[rowKey];
        return next;
      }

      const current = prev[rowKey];
      if (
        current &&
        current.reps === fields.reps &&
        current.weight === fields.weight &&
        current.unitType === fields.unitType &&
        current.notes === fields.notes &&
        current.url === fields.url
      ) {
        return prev;
      }

      return {
        ...prev,
        [rowKey]: fields,
      };
    });
  }, []);

  // Show a one-time hint for new users (first ~20 sessions)
  const showSuggestionHint = useMemo(() => {
    if (!parsedData) return false;
    const dates = new Set();
    for (const e of parsedData) {
      if (!e.isGoal) dates.add(e.date);
    }
    return dates.size <= 20;
  }, [parsedData]);

  const closeCustomSetDraft = useCallback(() => {
    setCustomDraftConfig(null);
  }, []);

  const optimisticSetsForStrength = useMemo(
    () =>
      sets.map((set, index) =>
        getEffectiveSetForRanking(
          set,
          optimisticFieldsByKey[getSetIdentityKey(set, `set-${index}`)],
        ),
      ),
    [sets, optimisticFieldsByKey],
  );

  // Recompute tonnage stats using optimistic reps/weight so the tonnage
  // row updates instantly as the user edits inline.
  const optimisticTonnageStats = useMemo(() => {
    if (!tonnageStats) return null;
    const optimisticTonnage = optimisticSetsForStrength.reduce(
      (sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0),
      0,
    );
    if (optimisticTonnage === tonnageStats.currentLiftTonnage) return tonnageStats;
    const { avgLiftTonnage } = tonnageStats;
    return {
      ...tonnageStats,
      currentLiftTonnage: optimisticTonnage,
      pctDiff:
        avgLiftTonnage > 0
          ? ((optimisticTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
          : null,
      shouldShowComparison:
        optimisticSetsForStrength.length >= 4 ||
        (avgLiftTonnage > 0 && optimisticTonnage >= avgLiftTonnage * 0.4),
    };
  }, [tonnageStats, optimisticSetsForStrength]);

  const openCustomSetDraft = useCallback(() => {
    setCustomDraftSeed((prev) => prev + 1);
    setCustomDraftConfig({
      unitType: lastRealSet?.unitType ?? (isMetric ? "kg" : "lb"),
      notes: getAutoTimestampNotes(),
    });
  }, [isMetric, lastRealSet?.unitType]);

  const handleSuggestedAddSet = useCallback(
    async (setFields) => {
      setCustomDraftConfig(null);
      await onAddSet(setFields);
    },
    [onAddSet],
  );

  const handleCustomDraftCommit = useCallback(
    async (setFields) => {
      setCustomDraftConfig(null);
      await onAddSet(setFields);
    },
    [onAddSet],
  );

  // Read warmup settings from localStorage (shared with warmup calculator page)
  const storedBarType =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, {
      initializeWithValue: false,
    }) ?? "standard";
  const storedPlatePreference =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_PLATE_PREFERENCE, {
      initializeWithValue: false,
    }) ?? "blue";

  const inSessionCoachState = useMemo(() => {
    if (!parsedData) return null;

    const unitType = isMetric ? "kg" : "lb";
    const barWeight =
      storedBarType === "womens" ? (isMetric ? 15 : 35) : isMetric ? 20 : 45;
    const minIncrement = isMetric ? 2.5 : 5;
    const priorLiftDates = Array.from(
      new Set(
        parsedData
          .filter(
            (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
          )
          .map((e) => e.date)
          .filter(Boolean),
      ),
    ).sort();
    const journeyTechniqueAssist = getJourneyTechniqueAssist({
      liftType,
      dashboardStage,
      priorLiftDates,
      sessionDate,
    });
    const completedSetCount = realSets.filter(
      (set) => (set.reps ?? 0) > 0 && (set.weight ?? 0) > 0,
    ).length;
    const inSessionFallbackCoaching =
      !journeyTechniqueAssist && completedSetCount >= 3
        ? getNonBigFourThreeByFiveCoaching(liftType)
        : null;
    const firstTimeTargetWeight = getFirstTimeTargetWeight({
      standards,
      liftType,
      barWeight,
      minIncrement,
    });
    const firstTimeProgression = firstTimeTargetWeight
      ? generateSessionSets(
          firstTimeTargetWeight,
          5,
          barWeight,
          isMetric,
          storedPlatePreference,
        )
      : null;

    // Find last session's sets for this lift (same logic as LiftSuggestions)
    const prior = parsedData.filter(
      (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
    );
    if (!prior.length) {
      const firstTimeButtons = firstTimeProgression
        ? getFirstTimeProgressionButtons({
            progression: firstTimeProgression,
            realSets,
            isMetric,
            unitType,
            minIncrement,
          })
        : null;

      if (realSets.length === 0) {
        return {
          mode: "firstLiftEmpty",
          buttons: firstTimeButtons?.length
            ? firstTimeButtons
            : getFirstTimeEmptyButtons({
                liftType,
                barWeight,
                minIncrement,
                unitType,
              }),
          inSessionCoaching: getInSessionCoachingCopy({
            mode: "firstLiftEmpty",
            dashboardStage,
            liftType,
            minIncrement,
            unitType,
          }),
          journeyTechniqueAssist: journeyTechniqueAssist
            ? {
                ...journeyTechniqueAssist,
                videoAssist: journeyTechniqueAssist.videoAssist
                  ? {
                      ...journeyTechniqueAssist.videoAssist,
                      defaultOpen: false,
                    }
                  : null,
              }
            : null,
        };
      }

      const lastLoggedWeight = lastRealSet
        ? getDisplayWeight(lastRealSet, isMetric).value
        : barWeight;
      const lastLoggedReps = lastRealSet?.reps ?? 5;
      const nextWeight = lastLoggedWeight + minIncrement;
      const secondJumpWeight = lastLoggedWeight + minIncrement * 2;
      const isBarOnlyIntro =
        lastLoggedWeight <= barWeight && lastLoggedReps >= 8;
      const hasReachedFirstTimeTarget = firstTimeTargetWeight
        ? realSets.some((set) => {
            if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
            return (
              getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight
            );
          })
        : false;
      const firstTimeWorkSetCount = firstTimeTargetWeight
        ? realSets.filter((set) => {
            if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
            return (
              getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight
            );
          }).length
        : 0;

      return {
        mode: "firstLiftInProgress",
        buttons: firstTimeButtons?.length
          ? firstTimeButtons
          : [
              {
                label: `${isBarOnlyIntro ? 5 : lastLoggedReps}@${nextWeight}${unitType}`,
                sublabel: isBarOnlyIntro
                  ? "first loaded set"
                  : `+${minIncrement}${unitType}`,
                reps: isBarOnlyIntro ? 5 : lastLoggedReps,
                weight: nextWeight,
                unitType,
                variant: "primary",
              },
              {
                label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
                sublabel: "repeat",
                reps: lastLoggedReps,
                weight: lastLoggedWeight,
                unitType,
                variant: "secondary",
              },
              {
                label: `${lastLoggedReps}@${secondJumpWeight}${unitType}`,
                sublabel: `+${minIncrement * 2}${unitType}`,
                reps: lastLoggedReps,
                weight: secondJumpWeight,
                unitType,
                variant: "outline",
              },
            ],
        inSessionCoaching:
          inSessionFallbackCoaching ??
          getInSessionCoachingCopy({
            mode: "firstLiftInProgress",
            dashboardStage,
            liftType,
            minIncrement,
            unitType,
            hasReachedTarget: hasReachedFirstTimeTarget,
            workSetCount: firstTimeWorkSetCount,
          }),
        journeyTechniqueAssist,
      };
    }

    const lastDate = prior[prior.length - 1].date;
    const lastSets = prior.filter((e) => e.date === lastDate);

    // Find the top set from last session (heaviest weight)
    let topSet = lastSets[0];
    for (const s of lastSets) {
      // Convert to user's current unit for comparison
      const { value } = getDisplayWeight(s, isMetric);
      const { value: topValue } = getDisplayWeight(topSet, isMetric);
      if (value > topValue) topSet = s;
    }

    const { value: lastTopWeight } = getDisplayWeight(topSet, isMetric);
    const topReps = topSet.reps;
    if (!lastTopWeight || lastTopWeight <= 0) return null;

    // Assume progressive overload: target is last session's top + one increment
    const topWeight = lastTopWeight + minIncrement;

    // Generate the full warmup progression using shared algorithm
    const progression = generateSessionSets(
      topWeight,
      topReps,
      barWeight,
      isMetric,
      storedPlatePreference,
    );

    // Build a "replay" progression from the user's actual last session sets.
    // Lower warmups (below 80% of last top) stay at the same weight.
    // Upper warmups (at or above 80%) shift by the increment delta.
    const incrementDelta = topWeight - lastTopWeight; // usually minIncrement
    const upperThreshold = lastTopWeight * 0.8;
    const seenReplayWeights = new Set();
    const replayProgression = [];
    for (const s of lastSets) {
      const { value: w } = getDisplayWeight(s, isMetric);
      if (w <= 0) continue;
      const isUpper = w >= upperThreshold;
      const replayWeight = isUpper
        ? Math.round((w + incrementDelta) / minIncrement) * minIncrement
        : w;
      // Deduplicate: only keep the first occurrence at each weight
      if (seenReplayWeights.has(replayWeight)) continue;
      seenReplayWeights.add(replayWeight);
      const isTop = replayWeight >= topWeight;
      replayProgression.push({
        weight: isTop ? topWeight : replayWeight,
        reps: isTop ? topReps : s.reps,
        isTopSet: isTop,
      });
    }
    // Sort ascending and ensure the top set is last
    replayProgression.sort((a, b) => a.weight - b.weight);

    // Determine where the lifter is based on already-logged sets
    const loggedWeights = realSets
      .filter((s) => s.weight > 0)
      .map((s) => {
        const { value } = getDisplayWeight(s, isMetric);
        return value;
      });

    // Find the next warmup set they haven't done yet (algorithmic)
    let nextWarmupIdx = 0;
    if (loggedWeights.length > 0) {
      const maxLogged = Math.max(...loggedWeights);
      nextWarmupIdx = progression.findIndex((s) => s.weight > maxLogged);
      if (nextWarmupIdx === -1) nextWarmupIdx = progression.length;
    }

    // Find the next replay set they haven't done yet
    let nextReplayIdx = 0;
    if (loggedWeights.length > 0) {
      const maxLogged = Math.max(...loggedWeights);
      nextReplayIdx = replayProgression.findIndex((s) => s.weight > maxLogged);
      if (nextReplayIdx === -1) nextReplayIdx = replayProgression.length;
    }

    const atOrPastTop = nextWarmupIdx >= progression.length;
    const replayAtOrPastTop = nextReplayIdx >= replayProgression.length;
    const maxLogged = loggedWeights.length > 0 ? Math.max(...loggedWeights) : 0;
    const lastLoggedSets = realSets.filter((s) => s.weight > 0);
    const lastLoggedWeight =
      lastLoggedSets.length > 0
        ? getDisplayWeight(lastLoggedSets[lastLoggedSets.length - 1], isMetric)
            .value
        : 0;
    const lastLoggedReps =
      lastLoggedSets[lastLoggedSets.length - 1]?.reps ?? topReps;
    const nextSet = !atOrPastTop ? progression[nextWarmupIdx] : null;
    const nextReplaySet =
      !replayAtOrPastTop ? replayProgression[nextReplayIdx] : null;
    const nearMissTopGapRatio =
      nextSet?.isTopSet && nextSet.weight > 0 && lastLoggedWeight > 0
        ? (nextSet.weight - lastLoggedWeight) / nextSet.weight
        : null;
    const treatNearMissAsTopSet =
      nextSet?.isTopSet &&
      lastLoggedWeight < nextSet.weight &&
      nearMissTopGapRatio !== null &&
      nearMissTopGapRatio > 0 &&
      nearMissTopGapRatio <= 0.03;
    // Consider past top if BOTH tracks agree (or one is exhausted)
    const effectiveAtOrPastTop =
      (atOrPastTop || treatNearMissAsTopSet) && replayAtOrPastTop;

    // Detect drop set mode: last logged weight is below the session's peak
    const inDropSetMode = effectiveAtOrPastTop && lastLoggedWeight < maxLogged;

    // Helper: check if a suggested set would be a PR (use best/default pick)
    const getSuggestionRankingMeta = (reps, weight) => {
      const meta = getRankingMeta({
        liftType,
        reps,
        weight,
        isMetric,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      });
      return meta?.best ?? null;
    };

    const buttons = [];

    if (!effectiveAtOrPastTop) {
      // Warmup phase: offer replay (what you did last time) and algorithmic suggestions
      // Pick the replay suggestion as primary when available
      const addButton = (set, sublabel, variant) => {
        if (!set) return;
        // Deduplicate: skip if we already have a button at this weight
        if (buttons.some((b) => b.weight === set.weight)) return;
        const rankingMeta = getSuggestionRankingMeta(set.reps, set.weight);
        buttons.push({
          label: `${set.reps}@${set.weight}${unitType}`,
          sublabel: set.isTopSet ? "top set" : sublabel,
          rankingMessage: rankingMeta?.message ?? null,
          rankingScope: rankingMeta?.scope ?? null,
          reps: set.reps,
          weight: set.weight,
          unitType,
          variant: set.isTopSet ? "primary" : variant,
        });
      };

      // Primary: replay suggestion (based on what the user actually did last time)
      if (nextReplaySet) {
        addButton(nextReplaySet, "warmup", "secondary");
      }

      // Secondary: algorithmic suggestion (standard warmup calculator)
      if (nextSet) {
        addButton(nextSet, "warmup", "outline");
      }

      // Always offer the top set as an option (skip-ahead or the only option)
      const topProgSet = progression[progression.length - 1];
      addButton(topProgSet, "top set", "outline");
    } else if (inDropSetMode) {
      // Drop set mode: weight is descending — only offer repeat at current drop weight
      const dropRankingMeta = getSuggestionRankingMeta(
        lastLoggedReps,
        lastLoggedWeight,
      );
      buttons.push({
        label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
        sublabel: "drop set",
        rankingMessage: dropRankingMeta?.message ?? null,
        rankingScope: dropRankingMeta?.scope ?? null,
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        unitType,
        variant: "secondary",
      });
    } else {
      // Working phase: suggest repeat, increment, and drop set
      const repeatRankingMeta = getSuggestionRankingMeta(
        lastLoggedReps,
        lastLoggedWeight,
      );
      buttons.push({
        label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
        sublabel: "repeat",
        rankingMessage: repeatRankingMeta?.message ?? null,
        rankingScope: repeatRankingMeta?.scope ?? null,
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        unitType,
        variant: "secondary",
      });
      const incrWeight = lastLoggedWeight + minIncrement;
      const incrRankingMeta = getSuggestionRankingMeta(
        lastLoggedReps,
        incrWeight,
      );
      buttons.push({
        label: `${lastLoggedReps}@${incrWeight}${unitType}`,
        sublabel: `+${minIncrement}`,
        rankingMessage: incrRankingMeta?.message ?? null,
        rankingScope: incrRankingMeta?.scope ?? null,
        reps: lastLoggedReps,
        weight: incrWeight,
        unitType,
        variant: "outline",
      });
      // Drop set: ~80% of current weight, rounded to nearest increment
      const dropWeight =
        Math.round((lastLoggedWeight * 0.8) / minIncrement) * minIncrement;
      if (dropWeight >= barWeight && dropWeight < lastLoggedWeight) {
        const dropRankingMeta = getSuggestionRankingMeta(
          lastLoggedReps,
          dropWeight,
        );
        buttons.push({
          label: `${lastLoggedReps}@${dropWeight}${unitType}`,
          sublabel: "drop set",
          rankingMessage: dropRankingMeta?.message ?? null,
          rankingScope: dropRankingMeta?.scope ?? null,
          reps: lastLoggedReps,
          weight: dropWeight,
          unitType,
          variant: "outline",
        });
      }
    }

    return {
      mode: "history",
      buttons,
      inSessionCoaching: inSessionFallbackCoaching,
      journeyTechniqueAssist,
    };
  }, [
    parsedData,
    isMetric,
    storedBarType,
    storedPlatePreference,
    liftType,
    sessionDate,
    realSets,
    lastRealSet,
    dashboardStage,
    standards,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  ]);

  // Find the set index with the heaviest e1RM for the strength badge
  const canShowStrength = (hasUserData || isDemoMode || isImportedData) && hasBioData;
  const { bestE1rmIndex, bestE1rmValue } = useMemo(() => {
    if (!canShowStrength) return { bestE1rmIndex: -1, bestE1rmValue: 0 };
    let bestIdx = -1;
    let bestVal = 0;
    optimisticSetsForStrength.forEach((s, i) => {
      const reps = s.reps ?? 0;
      const weight = s.weight ?? 0;
      if (reps > 0 && weight > 0) {
        const e1rm = estimateE1RM(reps, weight, e1rmFormula);
        if (e1rm > bestVal) {
          bestVal = e1rm;
          bestIdx = i;
        }
      }
    });
    return { bestE1rmIndex: bestIdx, bestE1rmValue: bestVal };
  }, [optimisticSetsForStrength, canShowStrength, e1rmFormula]);

  const prMeta = useMemo(() => {
    return sets.map((s) => {
      const effectiveSet = getEffectiveSetForRanking(
        s,
        optimisticFieldsByKey[getSetIdentityKey(s)],
      );
      const rankingMeta = getOptimisticRankingMeta({
        set: effectiveSet,
        sets,
        optimisticFieldsByKey,
        isMetric,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      });
      if (s._pending || !effectiveSet.reps || !effectiveSet.weight) {
        return {
          status: null,
          message: null,
          scope: null,
          celebration: {
            tier: "none",
            score: CELEBRATION_TIERS.none,
            reason: null,
          },
          celebrationKey: null,
        };
      }

      const active = rankingMeta?.best ?? null;
      const celebration = getCelebrationTier({
        rankingMeta,
        reps: effectiveSet.reps,
        trainingAgeYears,
      });
      const celebrationKey =
        celebration.tier !== "none"
          ? [
              s.rowIndex ??
                s._tempId ??
                `${liftType}-${effectiveSet.reps}-${effectiveSet.weight}`,
              celebration.tier,
              active?.scope ?? "lifetime",
              active?.rank ?? "na",
            ].join(":")
          : null;

      if (s.isHistoricalPR) {
        return {
          status: "lifetime",
          message: active?.message ?? null,
          scope: active?.scope ?? "lifetime",
          celebration,
          celebrationKey,
        };
      }

      if (active) {
        return {
          status: active.scope,
          message: active.message,
          scope: active.scope,
          celebration,
          celebrationKey,
        };
      }
      return {
        status: null,
        message: null,
        scope: null,
        celebration,
        celebrationKey,
      };
    });
  }, [
    sets,
    liftType,
    isMetric,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    trainingAgeYears,
    optimisticFieldsByKey,
  ]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (activeCelebrationTimerRef.current)
        clearTimeout(activeCelebrationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentKeys = new Map(
      sets.map((set, index) => [
        set.rowIndex ?? set._tempId ?? `pending-${index}`,
        prMeta[index]?.celebrationKey ?? null,
      ]),
    );

    if (initialCelebrationPassRef.current || isPastSession) {
      initialCelebrationPassRef.current = false;
      previousCelebrationKeysRef.current = currentKeys;
      return;
    }

    const newlyQualified = sets
      .map((set, index) => {
        const rowKey = set.rowIndex ?? set._tempId ?? `pending-${index}`;
        const meta = prMeta[index];
        const previousKey = previousCelebrationKeysRef.current.get(rowKey);

        if (!meta?.celebrationKey || meta.celebrationKey === previousKey) {
          return null;
        }

        return {
          rowKey,
          celebration: meta.celebration,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.celebration.score - a.celebration.score);

    previousCelebrationKeysRef.current = currentKeys;

    if (!newlyQualified.length) return;

    const winner = newlyQualified[0];
    setActiveCelebrationKey(winner.rowKey);
    if (activeCelebrationTimerRef.current)
      clearTimeout(activeCelebrationTimerRef.current);
    activeCelebrationTimerRef.current = setTimeout(() => {
      setActiveCelebrationKey(null);
    }, 2200);

    if (prefersReducedMotion) return;

    fireSetCelebrationConfetti(winner.celebration.tier, liftBlockRef.current);

    if (winner.celebration.tier === "confettiLargeShake") {
      setIsCelebrationShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => {
        setIsCelebrationShaking(false);
      }, 600);
    }
  }, [sets, prMeta, isPastSession, prefersReducedMotion]);

  const shouldShowTonnage = useMemo(() => {
    if (!tonnageStats) return false;
    if (sessionCount >= 10) return true;
    if (!hasBioData || !topLiftsByTypeAndReps?.[liftType]) return false;

    const { strengthRating } = getTopLiftStats(
      topLiftsByTypeAndReps[liftType],
      liftType,
      standards,
      e1rmFormula,
    );

    return (
      strengthRating === "Intermediate" ||
      strengthRating === "Advanced" ||
      strengthRating === "Elite"
    );
  }, [
    tonnageStats,
    sessionCount,
    hasBioData,
    topLiftsByTypeAndReps,
    liftType,
    standards,
    e1rmFormula,
  ]);

  const desktopIconInsetClass = "md:pl-28 lg:pl-32";
  const desktopIconOffsetClass = "md:ml-28 lg:ml-32";

  return (
    <div
      ref={liftBlockRef}
      className="bg-card relative overflow-hidden rounded-xl border shadow-md"
      style={{
        backgroundImage: `linear-gradient(135deg, ${hexToRgba(liftColor, 0.12)} 0%, ${hexToRgba(liftColor, 0.06)} 18%, rgba(255, 255, 255, 0) 42%)`,
        animation: isCelebrationShaking
          ? "log-pr-shake 0.6s ease-in-out"
          : undefined,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
        style={{ backgroundColor: liftColor }}
      />
      {/* Desktop: large icon in left gutter */}
      {bigFourEntry && (
        <div className="absolute top-4 left-4 hidden md:block">
          <Link href={getLiftDetailUrl(liftType)}>
            <Image
              src={bigFourEntry.icon}
              alt=""
              width={104}
              height={104}
              className="opacity-80 transition-opacity hover:opacity-100"
            />
          </Link>
        </div>
      )}

      {/* Header: icon + lift name + last session */}
      <div className={`flex gap-3 px-4 pt-4 ${desktopIconInsetClass}`}>
        {bigFourEntry && (
          <Link
            href={getLiftDetailUrl(liftType)}
            className="shrink-0 self-start md:hidden"
          >
            <Image src={bigFourEntry.icon} alt="" width={52} height={52} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="pb-1">
            <Link
              href={getLiftDetailUrl(liftType)}
              className="text-foreground flex items-center gap-2 text-base font-semibold hover:underline"
              style={{ textDecorationColor: liftColor }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: liftColor }}
              />
              {liftType}
            </Link>
          </div>
          <LiftSuggestions
            liftType={liftType}
            sessionDate={sessionDate}
            parsedData={parsedData}
            isMetric={isMetric}
            onNavigateToDate={onNavigateToDate}
          />
        </div>
      </div>

      <LiftTechniqueAssist
        techniqueAssist={inSessionCoachState?.journeyTechniqueAssist}
        hasBigFourIcon
      />

      {/* Set rows — border-t inset on desktop to clear the icon gutter */}
      <div
        className={`divide-border/40 border-border/40 mx-4 mt-1 divide-y border-t ${desktopIconOffsetClass}`}
      >
        {sets.map((set, idx) => {
          const rowIdentityKey = getSetIdentityKey(set, `pending-${idx}`);
          const effectiveSet = optimisticSetsForStrength[idx] ?? set;
          const shouldPassiveAnimate =
            !prefersReducedMotion && initialPassiveRowKeys.has(rowIdentityKey);
          const passiveDelay = shouldPassiveAnimate
            ? Math.min(
                (initialPassiveRowOrder.get(rowIdentityKey) ?? idx) * 0.06,
                0.3,
              )
            : 0;

          return (
            <SetRow
              key={set._tempId ?? set.rowIndex ?? `pending-${idx}`}
              set={set}
              isMetric={isMetric}
              prMeta={prMeta[idx]}
              celebration={prMeta[idx]?.celebration ?? null}
              isActiveCelebration={
                activeCelebrationKey ===
                (set.rowIndex ?? set._tempId ?? `pending-${idx}`)
              }
              shouldPassiveAnimate={shouldPassiveAnimate}
              passiveDelay={passiveDelay}
              onOptimisticFieldsChange={handleOptimisticFieldsChange}
              onUpdate={(update) =>
                onUpdateSet(
                  {
                    rowIndex: set.rowIndex,
                    tempId: set._tempId ?? null,
                    set,
                  },
                  update,
                )
              }
              onDelete={
                set._pending || !set.rowIndex ? null : () => onDeleteSet(set)
              }
              isDeleteDisabled={isStructuralSaving || isDeleteCooldownActive}
              usedSessionUrls={usedSessionUrls}
              strengthBadge={
                idx === bestE1rmIndex ? (
                  <LiftStrengthLevel
                    liftType={liftType}
                    workouts={optimisticSetsForStrength}
                    standards={standards}
                    e1rmFormula={e1rmFormula}
                    sessionDate={sessionDate}
                    age={age}
                    bodyWeight={bodyWeight}
                    sex={sex}
                    isMetric={isMetric}
                    asBadge
                    badgeClassName="h-8 rounded-full px-3 text-xs font-semibold"
                  />
                ) : null
              }
            />
          );
        })}
        {!previewMode && customDraftConfig && (
          <CustomSetDraftRow
            key={`custom-${liftType}-${customDraftSeed}`}
            unitType={customDraftConfig.unitType}
            defaultNotes={customDraftConfig.notes}
            onCommit={handleCustomDraftCommit}
            onCancel={closeCustomSetDraft}
            disabled={isStructuralSaving}
          />
        )}
      </div>
      {canShowStrength && bestE1rmValue > 0 && (
        <div className={`mx-4 mt-3 ${desktopIconOffsetClass}`}>
          <LogStrengthBar
            liftType={liftType}
            e1rmValue={bestE1rmValue}
            standards={standards}
            age={age}
            sessionDate={sessionDate}
            bodyWeight={bodyWeight}
            sex={sex}
            isMetric={isMetric}
          />
        </div>
      )}
      {canShowStrength && bestE1rmValue > 0 && (
        <div className={`mx-4 mt-2 ${desktopIconOffsetClass}`}>
          <LogLiftPercentileLine
            liftType={liftType}
            e1rmValue={bestE1rmValue}
            age={age}
            bodyWeight={bodyWeight}
            sex={sex}
            isMetric={isMetric}
          />
        </div>
      )}
      {shouldShowTonnage && (
        <div className={`mx-4 mt-3 ${desktopIconOffsetClass}`}>
          <LiftTonnageRow
            liftType={liftType}
            stats={optimisticTonnageStats}
            isMetric={isMetric}
          />
        </div>
      )}

      {/* Add-set buttons — card footer (hidden in preview mode) */}
      {!previewMode && (
        <SmartAddButtons
          inSessionCoachState={inSessionCoachState}
          lastRealSet={lastRealSet}
          liftType={liftType}
          onAddSet={handleSuggestedAddSet}
          onStartCustomSet={openCustomSetDraft}
          showHint={showSuggestionHint}
          hasBigFourIcon
          isPastSession={isPastSession}
          disabled={isStructuralSaving}
        />
      )}
    </div>
  );
}

function UnitLabel({ unitType, mismatch }) {
  if (!mismatch) {
    return (
      <span className="text-muted-foreground ml-0.5 text-sm font-medium">
        {unitType}
      </span>
    );
  }
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground ml-0.5 inline-flex items-center gap-0.5 text-sm font-medium">
            {unitType}
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-52 text-center">
          Showing {unitType} — the original unit in your spreadsheet
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getLogPRBadgeHref(liftType) {
  return getLiftDetailUrl(liftType, "#lift-prs");
}

function getLogPRBadgeTooltip(liftType) {
  if (!liftType) return "Open lift details";
  return `Open ${liftType} details`;
}

/**
 * Every visible PR marker gets a small entrance burst and shimmer. This is the
 * baseline celebration treatment; stronger milestones add border, confetti, and
 * shake on top.
 */
function CelebrationReveal({ animationKey, className, children }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={animationKey}
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: 8,
              scale: 0.88,
              filter: "brightness(0.9)",
            }
      }
      animate={
        prefersReducedMotion
          ? undefined
          : {
              opacity: [0, 1, 1],
              y: [8, -2, 0],
              scale: [0.88, 1.12, 1],
              filter: ["brightness(0.9)", "brightness(1.34)", "brightness(1)"],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 0.62,
              delay: 0.12,
              ease: [0.2, 0.9, 0.25, 1],
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CustomSetDraftRow({
  unitType,
  defaultNotes,
  onCommit,
  onCancel,
  disabled = false,
}) {
  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);
  const notesInputRef = useRef(null);
  const [draftReps, setDraftReps] = useState("");
  const [draftWeight, setDraftWeight] = useState("");
  const [draftNotes, setDraftNotes] = useState(defaultNotes ?? "");
  const shouldPlaceNotesCaretRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    repsInputRef.current?.focus();
    repsInputRef.current?.select?.();
  }, [disabled]);

  const parsedReps = Number.parseInt(draftReps, 10);
  const parsedWeight = Number.parseFloat(draftWeight);
  const hasValidReps = Number.isInteger(parsedReps) && parsedReps > 0;
  const hasValidWeight = Number.isFinite(parsedWeight) && parsedWeight > 0;
  const canSubmit = !disabled && hasValidReps && hasValidWeight;

  const moveToWeight = useCallback(() => {
    if (!hasValidReps || disabled) return;
    weightInputRef.current?.focus();
    weightInputRef.current?.select?.();
  }, [disabled, hasValidReps]);

  const moveToNotes = useCallback(() => {
    if (!hasValidWeight || disabled) return;
    shouldPlaceNotesCaretRef.current = true;
    const notesInput = notesInputRef.current;
    if (!notesInput) return;
    notesInput.focus();
    const caretPosition = (defaultNotes ?? "").length;
    notesInput.setSelectionRange(caretPosition, caretPosition);
  }, [defaultNotes, disabled, hasValidWeight]);

  const handleNotesFocus = useCallback(() => {
    if (!shouldPlaceNotesCaretRef.current) return;
    shouldPlaceNotesCaretRef.current = false;
    const notesInput = notesInputRef.current;
    if (!notesInput) return;
    const caretPosition = (defaultNotes ?? "").length;
    notesInput.setSelectionRange(caretPosition, caretPosition);
  }, [defaultNotes]);

  const commitDraft = useCallback(() => {
    if (!canSubmit) return;
    onCommit({
      reps: parsedReps,
      weight: parsedWeight,
      unitType,
      notes: draftNotes,
    });
  }, [canSubmit, draftNotes, onCommit, parsedReps, parsedWeight, unitType]);

  return (
    <div className="border-primary/35 bg-primary/5 rounded-lg border border-dashed px-2 py-3">
      <div className="flex items-start gap-4">
        <div className="flex items-center">
          <input
            ref={repsInputRef}
            type="number"
            inputMode="numeric"
            className="border-primary w-10 rounded border px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
            value={draftReps}
            disabled={disabled}
            placeholder="5"
            onChange={(e) => setDraftReps(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                moveToWeight();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <span className="text-muted-foreground mx-0.5 text-base">@</span>
          <input
            ref={weightInputRef}
            type="number"
            inputMode="decimal"
            step="any"
            className="border-primary w-20 rounded border px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
            value={draftWeight}
            disabled={disabled}
            placeholder={unitType === "kg" ? "20" : "45"}
            onChange={(e) => setDraftWeight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                moveToNotes();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <UnitLabel unitType={unitType} mismatch={false} />
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={notesInputRef}
            type="text"
            className="border-input text-muted-foreground focus:border-primary w-full border-b bg-transparent py-0.5 text-xs italic focus:outline-none"
            value={draftNotes}
            disabled={disabled}
            placeholder="notes..."
            onFocus={handleNotesFocus}
            onChange={(e) => setDraftNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>

        <div className="hidden w-[12.5rem] shrink-0 items-start justify-end gap-1 md:flex">
          <button
            type="button"
            disabled={disabled}
            className="text-muted-foreground/45 hover:text-foreground rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            aria-label="Cancel custom set"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground/35 rounded p-1 transition-colors disabled:cursor-not-allowed"
            onClick={commitDraft}
            aria-label="Add custom set"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 md:hidden">
        <button
          type="button"
          disabled={disabled}
          className="text-muted-foreground/45 hover:text-foreground rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCancel}
          aria-label="Cancel custom set"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          className="text-primary hover:text-primary/80 disabled:text-muted-foreground/35 rounded p-1 transition-colors disabled:cursor-not-allowed"
          onClick={commitDraft}
          aria-label="Add custom set"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// --- Set row (click-to-edit) ---
// Layout: [reps] @ [weight][unit]  [notes flex-1]  [PR]

function SetRow({
  set,
  isMetric,
  prMeta,
  celebration,
  isActiveCelebration,
  shouldPassiveAnimate,
  passiveDelay = 0,
  onOptimisticFieldsChange,
  onUpdate,
  onDelete,
  isDeleteDisabled = false,
  strengthBadge,
  usedSessionUrls,
}) {
  const isLocked = Boolean(set._pending);
  const isReadOnly = !onUpdate;
  const [editingReps, setEditingReps] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftReps, setDraftReps] = useState(String(set.reps ?? ""));
  const [draftWeight, setDraftWeight] = useState(String(set.weight ?? ""));
  const [draftNotes, setDraftNotes] = useState(set.notes ?? "");
  const [draftUrl, setDraftUrl] = useState(set.URL ?? "");
  const urlInputRef = useRef(null);
  const prefUnit = isMetric ? "kg" : "lb";
  const unitMismatch = set.unitType && set.unitType !== prefUnit;

  // Optimistic display: holds committed value until parsedData catches up
  const [pendingReps, setPendingReps] = useState(null);
  const [pendingWeight, setPendingWeight] = useState(null);
  const [pendingNotes, setPendingNotes] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const latestFieldsRef = useRef(getEditableSetFields(set));

  // Debounced update: coalesce rapid changes (spinner arrows, keyboard arrows)
  // into a single API call. Each commit merges into latestFieldsRef so a quick
  // reps-then-weight edit still sends the final combined snapshot.
  const updateTimerRef = useRef(null);
  const scheduleUpdate = useCallback(
    (update) => {
      latestFieldsRef.current = update.nextFields;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        updateTimerRef.current = null;
        onUpdate(update);
      }, 800);
    },
    [onUpdate],
  );
  const flushUpdate = useCallback(
    (update) => {
      latestFieldsRef.current = update.nextFields;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      onUpdate(update);
    },
    [onUpdate],
  );
  // Flush any pending debounced update on unmount
  useEffect(
    () => () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    },
    [],
  );

  // Keep drafts in sync if SWR refreshes parsedData
  // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
  useEffect(() => {
    setDraftReps(String(set.reps ?? ""));
  }, [set.reps]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
  useEffect(() => {
    setDraftWeight(String(set.weight ?? ""));
  }, [set.weight]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
  useEffect(() => {
    setDraftNotes(set.notes ?? "");
  }, [set.notes]);
  useEffect(() => { setDraftUrl(set.URL ?? ""); }, [set.URL]);

  // Clear pending once parsedData reflects the committed value
  useEffect(() => {
    if (pendingReps !== null && set.reps === pendingReps) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingReps(null);
    }
  }, [set.reps, pendingReps]);
  useEffect(() => {
    if (pendingWeight !== null && set.weight === pendingWeight) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingWeight(null);
    }
  }, [set.weight, pendingWeight]);
  useEffect(() => {
    if (pendingNotes !== null && (set.notes ?? "") === pendingNotes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingNotes(null);
    }
  }, [set.notes, pendingNotes]);
  useEffect(() => {
    if (pendingUrl !== null && (set.URL ?? "") === pendingUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingUrl(null);
    }
  }, [set.URL, pendingUrl]);
  useEffect(() => {
    latestFieldsRef.current = {
      reps: pendingReps ?? set.reps,
      weight: pendingWeight ?? set.weight,
      unitType: set.unitType ?? "",
      notes: pendingNotes ?? set.notes ?? "",
      url: pendingUrl ?? set.URL ?? "",
    };
  }, [
    set.reps,
    set.weight,
    set.unitType,
    set.notes,
    set.URL,
    pendingReps,
    pendingWeight,
    pendingNotes,
    pendingUrl,
  ]);

  const displayReps = pendingReps !== null ? pendingReps : set.reps;
  const displayWeight = pendingWeight !== null ? pendingWeight : set.weight;
  const displayNotes = pendingNotes !== null ? pendingNotes : (set.notes ?? "");
  const displayUrl = pendingUrl !== null ? pendingUrl : (set.URL ?? "");
  const prToneClass =
    prMeta?.status === "lifetime"
      ? "text-amber-600"
      : prMeta?.status === "yearly"
        ? "text-blue-500"
        : "text-muted-foreground/45";
  const rankingSummary = prMeta?.message ?? null;
  const celebrationStyles = getCelebrationStyles({
    ...celebration,
    scope: prMeta?.scope ?? null,
  });
  const rowKey = getSetIdentityKey(set);
  const optimisticFields = useMemo(() => {
    const hasOptimisticOverride =
      pendingReps !== null || pendingWeight !== null || pendingNotes !== null || pendingUrl !== null;

    if (!hasOptimisticOverride) return null;

    return {
      reps: pendingReps ?? set.reps,
      weight: pendingWeight ?? set.weight,
      unitType: set.unitType ?? "",
      notes: pendingNotes ?? set.notes ?? "",
      url: pendingUrl ?? set.URL ?? "",
    };
  }, [
    pendingReps,
    pendingWeight,
    pendingNotes,
    pendingUrl,
    set.reps,
    set.weight,
    set.unitType,
    set.notes,
    set.URL,
  ]);

  useEffect(() => {
    if (!onOptimisticFieldsChange) return undefined;
    onOptimisticFieldsChange(rowKey, optimisticFields);
    return () => onOptimisticFieldsChange(rowKey, null);
  }, [rowKey, optimisticFields, onOptimisticFieldsChange]);

  function commitReps() {
    if (isLocked) return;
    setEditingReps(false);
    const parsed = parseInt(draftReps, 10);
    if (!isNaN(parsed) && parsed !== latestFieldsRef.current.reps) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, reps: parsed };
      setPendingReps(parsed);
      scheduleUpdate({
        field: "reps",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitWeight() {
    if (isLocked) return;
    setEditingWeight(false);
    const num = parseFloat(draftWeight);
    if (!isNaN(num) && num !== latestFieldsRef.current.weight) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, weight: num };
      setPendingWeight(num);
      scheduleUpdate({
        field: "weight",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitNotes() {
    if (isLocked) return;
    const trimmed = draftNotes.trim();
    if (trimmed !== (latestFieldsRef.current.notes ?? "").trim()) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, notes: trimmed };
      setPendingNotes(trimmed);
      flushUpdate({
        field: "notes",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitUrl() {
    if (isLocked) return;
    const trimmed = draftUrl.trim();
    if (trimmed !== (latestFieldsRef.current.url ?? "").trim()) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, url: trimmed };
      setPendingUrl(trimmed);
      flushUpdate({
        field: "url",
        beforeFields,
        nextFields,
      });
    }
  }

  function closeNotesEdit() {
    setEditingNotes(false);
    commitNotes();
    commitUrl();
  }

  function openNotesEdit() {
    setEditingNotes(true);
    // Try to pre-fill URL from clipboard if the field is currently empty
    // and the URL hasn't already been assigned to another set this session.
    if (!draftUrl && navigator?.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const trimmed = text?.trim() ?? "";
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          if (!usedSessionUrls?.has(trimmed)) {
            setDraftUrl(trimmed);
          }
        }
      }).catch(() => {});
    }
  }

  const hasBadges = !set._pending && Boolean(strengthBadge);
  const metaBadgeClassName = "h-8 rounded-full px-3 text-xs font-semibold";
  const prBadgeHref = getLogPRBadgeHref(set.liftType);
  const prBadgeTooltip = getLogPRBadgeTooltip(set.liftType);

  return (
    <motion.div
      className={cn("group py-3", celebrationStyles.rowClassName)}
      initial={shouldPassiveAnimate ? { opacity: 0, y: 12 } : false}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isActiveCelebration
          ? [
              "0 0 0 rgba(0,0,0,0)",
              prMeta?.scope === "lifetime"
                ? "0 0 0 2px rgba(251,191,36,0.35), 0 18px 40px -22px rgba(245,158,11,0.8)"
                : "0 0 0 2px rgba(96,165,250,0.28), 0 18px 40px -22px rgba(59,130,246,0.75)",
              "0 0 0 rgba(0,0,0,0)",
            ]
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{
        opacity: shouldPassiveAnimate
          ? { duration: 0.28, delay: passiveDelay, ease: "easeOut" }
          : { duration: 0.18, ease: "easeOut" },
        y: shouldPassiveAnimate
          ? { duration: 0.32, delay: passiveDelay, ease: "easeOut" }
          : { duration: 0.18, ease: "easeOut" },
        boxShadow: { duration: 0.6, ease: "easeOut" },
      }}
    >
      {/* Main row: reps@weight + notes + desktop meta rail */}
      <div className="flex items-center gap-4">
        {/* Reps @ Weight unit — tight visual unit.
            Reps right-aligned in w-7 (enough for 1–2 digits), weight auto-width.
            min-w keeps notes aligned across rows with different weight widths. */}
        <div className="flex min-w-[7.5rem] items-center">
          <div className="w-7">
            {editingReps && !isReadOnly ? (
              <input
                type="number"
                className="border-primary w-10 rounded border px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
                value={draftReps}
                disabled={isLocked}
                onChange={(e) => setDraftReps(e.target.value)}
                onBlur={commitReps}
                onKeyDown={(e) => e.key === "Enter" && commitReps()}
                autoFocus
              />
            ) : isLocked || isReadOnly ? (
              <div className="text-foreground/80 w-full py-0.5 text-right text-xl font-semibold tabular-nums">
                {displayReps}
              </div>
            ) : (
              <button
                className="hover:bg-muted/60 w-full rounded py-0.5 text-right text-xl font-semibold tabular-nums"
                onClick={() => setEditingReps(true)}
              >
                {displayReps}
              </button>
            )}
          </div>
          <span className="text-muted-foreground mx-0.5 text-base">@</span>
          {editingWeight && !isReadOnly ? (
            <input
              type="number"
              step="any"
              className="border-primary w-20 rounded border px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
              value={draftWeight}
              disabled={isLocked}
              onChange={(e) => setDraftWeight(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              autoFocus
            />
          ) : isLocked || isReadOnly ? (
            <div className="text-foreground/80 py-0.5 text-left text-xl font-semibold tabular-nums">
              {displayWeight}
            </div>
          ) : (
            <button
              className="hover:bg-muted/60 rounded py-0.5 text-left text-xl font-semibold tabular-nums"
              onClick={() => setEditingWeight(true)}
            >
              {displayWeight}
            </button>
          )}
          <UnitLabel unitType={set.unitType} mismatch={unitMismatch} />
        </div>

        {/* Notes + URL — flex-1, tap to edit */}
        <div className="min-w-0 flex-1 md:max-w-[calc(100%-18rem)]">
          {editingNotes && !isReadOnly ? (
            <div className="space-y-1">
              <input
                type="text"
                className="border-input text-muted-foreground focus:border-primary w-full border-b bg-transparent py-0.5 text-xs focus:outline-none"
                value={draftNotes}
                disabled={isLocked}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={(e) => {
                  commitNotes();
                  // Only close if focus isn't moving to the URL input
                  if (e.relatedTarget !== urlInputRef.current) {
                    setEditingNotes(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    urlInputRef.current?.focus();
                  } else if (e.key === "Escape") {
                    closeNotesEdit();
                  }
                }}
                placeholder="notes..."
                autoFocus
              />
              <div className="flex items-center gap-1">
                <Link2 className="text-muted-foreground/40 h-3 w-3 shrink-0" />
                <input
                  ref={urlInputRef}
                  type="url"
                  className="border-input text-muted-foreground focus:border-primary min-w-0 flex-1 border-b bg-transparent py-0.5 text-xs focus:outline-none"
                  value={draftUrl}
                  disabled={isLocked}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onBlur={() => { commitUrl(); setEditingNotes(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      closeNotesEdit();
                    }
                  }}
                  placeholder="video link..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {isLocked || isReadOnly ? (
                <div className="text-muted-foreground/50 w-full text-left text-xs italic">
                  {displayNotes || (isReadOnly ? "" : "notes...")}
                </div>
              ) : (
                <button
                  className="text-muted-foreground/50 hover:text-muted-foreground w-full text-left text-xs italic"
                  onClick={openNotesEdit}
                >
                  {displayNotes || "notes..."}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Video link — only shown when URL is populated */}
        {displayUrl && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/50 hover:text-foreground shrink-0 rounded p-1 transition-colors"
                  aria-label="Watch video"
                >
                  <PlayCircle className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Watch video</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="hidden w-[17rem] shrink-0 items-center justify-end gap-2 md:flex">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
          ) : (
            <>
              <div className="ml-auto flex items-center gap-2">
                {strengthBadge && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">{strengthBadge}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>View detailed strength levels</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {rankingSummary && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={prBadgeHref} className="inline-flex">
                          <CelebrationReveal
                            animationKey={`desktop-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${rankingSummary}`}
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                metaBadgeClassName,
                                "max-w-[10.5rem]",
                                prToneClass,
                              )}
                            >
                              <span className="truncate">{rankingSummary}</span>
                            </Badge>
                          </CelebrationReveal>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{prBadgeTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/30 hover:text-destructive disabled:text-muted-foreground/20 disabled:hover:text-muted-foreground/20 rounded p-1 transition-colors disabled:cursor-not-allowed md:opacity-0 md:group-hover:opacity-100 disabled:md:opacity-35"
                        onClick={onDelete}
                        disabled={isDeleteDisabled}
                        aria-label="Delete set"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Delete set</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile: badges + ranking + trash on second row */}
      {(hasBadges || rankingSummary || onDelete || set._pending) && (
        <div className="mt-1 flex items-center gap-2 pl-7 md:hidden">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
          ) : (
            <>
              {strengthBadge && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">{strengthBadge}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>View detailed strength levels</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {rankingSummary && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={prBadgeHref} className="inline-flex">
                        <CelebrationReveal
                          animationKey={`mobile-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${rankingSummary}`}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              metaBadgeClassName,
                              "max-w-[11rem]",
                              prToneClass,
                            )}
                          >
                            <span className="truncate">{rankingSummary}</span>
                          </Badge>
                        </CelebrationReveal>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{prBadgeTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex-1" />
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/30 hover:text-destructive disabled:text-muted-foreground/20 disabled:hover:text-muted-foreground/20 rounded p-1 transition-colors disabled:cursor-not-allowed"
                        onClick={onDelete}
                        disabled={isDeleteDisabled}
                        aria-label="Delete set"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Delete set</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

LogSessionPage.pageTitle = "Log";
LogSessionPage.pageDescription =
  "Log your lifting session and track your progress.";
