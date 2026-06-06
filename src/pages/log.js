/**
 * Main lifting session log experience. Orchestrates date browsing, sheet sync,
 * optimistic writes, coaching suggestions, and session rendering.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useIsClient } from "usehooks-ts";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { CELEBRATION_KEYFRAMES } from "@/lib/celebration";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { InspirationCard } from "@/components/log/inspiration-card";
import { AddLiftButton } from "@/components/log/add-controls";
import { LogSessionSkeleton } from "@/components/log/session-summary";
import { getLiftAnchorId } from "@/components/log/utils";
import { BIG_FOUR_LIFT_META } from "@/lib/big-four-lifts";
import {
  getNextSessionDate,
  getPerLiftTonnageStats,
  getPrevSessionDate,
  getSessionDates,
  getUsedSessionUrls,
} from "@/lib/log-session-selectors";
import { DEFAULT_ADD_LIFT_CHIPS } from "@/components/log/coached-lifts";
import { useLogSheetSync } from "@/components/log/use-log-sheet-sync";
import { LiftBlock } from "@/components/log/lift-block";
import { DeleteSessionControls } from "@/components/log/delete-session-controls";
import { EmptySessionState } from "@/components/log/empty-session-state";
import { LogDateNav } from "@/components/log/log-date-nav";

const BIG_FOUR = BIG_FOUR_LIFT_META.map(
  ({ liftType, iconSrc, progressGuidePath }) => ({
    name: liftType,
    icon: iconSrc,
    slug: progressGuidePath.replace(/^\//, ""),
  }),
);

const LOG_PAGE_TITLE = "Workout Log and Session Tracker | Strength Journeys";
const LOG_PAGE_DESCRIPTION =
  "Log barbell sets, browse sessions by date, use smart warm-up suggestions, and connect Google Sheets for a free strength training log with PR context.";
const LOG_PAGE_CANONICAL_URL = "https://www.strengthjourneys.xyz/log";
const LOG_PAGE_OG_IMAGE_URL =
  "https://www.strengthjourneys.xyz/202409-og-image.png";
const LOG_PAGE_KEYWORDS =
  "workout log, strength training log, barbell log, lifting tracker, workout tracker, Google Sheets workout log, PR tracker, warmup suggestions, strength journeys";
const LOG_PAGE_STATIC_CONTENT = {
  heading: "Workout log for barbell sessions",
  intro:
    "Strength Journeys turns a lifter's training history into a session-by-session log: sets, reps, weight, notes, video links, PR context, and warm-up suggestions stay connected to the same data source.",
  highlights: [
    "Browse sessions by date and see each lift as a focused training block.",
    "Use prior sessions to suggest practical next sets and warm-up jumps.",
    "Keep the source of truth portable with Google Sheets instead of a locked-in database.",
  ],
  lifts: BIG_FOUR.map(({ name, slug }) => ({
    name,
    href: `/${slug}`,
  })),
  faq: [
    {
      question: "Can I try the workout log before linking a sheet?",
      answer:
        "Yes. First-time visitors can browse the log with demo lifting data before connecting their own Google Sheet.",
    },
    {
      question: "What can I record for each set?",
      answer:
        "Each set supports reps, weight, unit, notes, and an optional video URL, with PR and strength-level context shown beside the session.",
    },
    {
      question: "Does Strength Journeys replace my spreadsheet?",
      answer:
        "No. The linked Google Sheet remains the portable source of truth while Strength Journeys provides the log, analysis, and coaching context on top.",
    },
  ],
};
const LOG_PAGE_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Strength Journeys Workout Log",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: LOG_PAGE_CANONICAL_URL,
    description: LOG_PAGE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: LOG_PAGE_STATIC_CONTENT.highlights,
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LOG_PAGE_STATIC_CONTENT.faq.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  },
];

export default function LogSessionPage({
  staticContent = LOG_PAGE_STATIC_CONTENT,
}) {
  // Route-level orchestration lives here: user data, URL date state, optimistic
  // sheet writes, and the static SEO block all meet in this page component.
  // Keep row mutation details in useLogSheetSync and rendering details in
  // src/components/log so this file remains a readable page surface.
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
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    sessionTonnageLookup,
    isDemoMode,
    isImportedData,
    hasUserData,
  } = useUserLiftingData();
  const { isMetric, toggleIsMetric } = useAthleteBio();
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

  // Use local time — new Date().toISOString() is UTC, which causes off-by-one in AU/Asia/Pacific
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const [sessionDate, setSessionDate] = useState(todayIso);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [acceptedSessionUrls, setAcceptedSessionUrls] = useState(
    () => new Set(),
  );
  const autoStartedLiftRef = useRef("");

  // Sync date from URL param after hydration.
  // Heatmap/deep links make the router query the external date source of truth.
  useEffect(() => {
    if (router.query.date && typeof router.query.date === "string") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL state is the external source of truth after hydration
      setSessionDate(router.query.date);
    }
  }, [router.query.date]);

  // All unique session dates from parsedData (ascending)
  const sessionDates = useMemo(() => getSessionDates(parsedData), [parsedData]);

  const {
    syncState,
    isStructuralSaving,
    isDeleteCooldownActive,
    sessionLiftsWithPending,
    resetOptimisticSessionState,
    updateSet,
    deleteSet,
    addSet,
    addLift,
    deleteSession,
  } = useLogSheetSync({
    sheetInfo,
    parsedData,
    sessionDate,
    sessionDates,
    todayIso,
    isMetric,
    mutate,
    toast,
  });

  const navigateToDate = useCallback(
    (date) => {
      setSessionDate(date);
      setShowDeleteConfirm(false);
      resetOptimisticSessionState();
      router.replace(
        { pathname: "/log", query: date !== todayIso ? { date } : {} },
        undefined,
        { shallow: true },
      );
    },
    [router, todayIso, resetOptimisticSessionState],
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

  // In preview mode, if no date was requested and today has no session data,
  // auto-navigate to the most recent session so the user sees actual data
  // instead of an empty state.  Skip when a date query param is present —
  // the user (or heatmap link) explicitly asked for that date.
  const hasAutoNavigatedRef = useRef(false);
  // Demo/import views should open on a real training day instead of today's
  // empty state, but only when the URL did not request a specific date.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preview/demo mode redirects from an empty today to real imported data
    navigateToDate(latestDate);
  }, [
    isImportedData,
    isDemoMode,
    sessionDates,
    sessionDate,
    navigateToDate,
    router.query.date,
  ]);

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

  const hasSession = Object.keys(sessionLiftsWithPending).length > 0;
  const usedSessionUrls = useMemo(
    () =>
      new Set([
        ...getUsedSessionUrls(sessionLiftsWithPending),
        ...acceptedSessionUrls,
      ]),
    [sessionLiftsWithPending, acceptedSessionUrls],
  );
  const handleSessionUrlAccepted = useCallback((url) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    setAcceptedSessionUrls((prev) => {
      if (prev.has(trimmed)) return prev;
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
  }, []);
  const perLiftTonnageStats = useMemo(
    () =>
      getPerLiftTonnageStats({
        sessionDate,
        sessionLiftsWithPending,
        sessionTonnageLookup,
      }),
    [sessionDate, sessionLiftsWithPending, sessionTonnageLookup],
  );
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
  // Keep row-writing controls quiet while SWR is refreshing Google Sheet rows:
  // the small disabled window is preferable to racing against stale rowIndex
  // data, but keep this narrowly scoped so normal logging does not feel sticky.
  const isSheetWriteBlocked =
    showSessionBootstrap ||
    isStructuralSaving ||
    isLoading ||
    isValidating ||
    isError ||
    fetchFailed ||
    !Array.isArray(parsedData);

  const prevSessionDate = useMemo(
    () => getPrevSessionDate(sessionDates, sessionDate),
    [sessionDates, sessionDate],
  );

  const nextSessionDate = useMemo(
    () => getNextSessionDate(sessionDates, sessionDate, todayIso),
    [sessionDates, sessionDate, todayIso],
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
  // Detect the all-kg/all-lb sheet case after data loads and offer a one-time
  // preference correction before new rows are written in the other unit.
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

  // Handle /log?startLift=... links from other pages by creating or focusing
  // the requested lift block after auth, sheet, and parsed data are ready.
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

  // Keep hash navigation working after async lift blocks or optimistic rows
  // render; the target anchor may not exist on the first route paint.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const anchorEl = document.getElementById(hash);
    if (!anchorEl) return;

    anchorEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [router.asPath, sessionLiftsWithPending]);

  const handleDeleteSession = useCallback(async () => {
    const result = await deleteSession();
    if (result?.deleted) {
      navigateToDate(result.nextDate);
    }
  }, [deleteSession, navigateToDate]);

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
    <>
      <NextSeo
        title={LOG_PAGE_TITLE}
        description={LOG_PAGE_DESCRIPTION}
        canonical={LOG_PAGE_CANONICAL_URL}
        openGraph={{
          url: LOG_PAGE_CANONICAL_URL,
          title: LOG_PAGE_TITLE,
          description: LOG_PAGE_DESCRIPTION,
          type: "website",
          images: [
            {
              url: LOG_PAGE_OG_IMAGE_URL,
              alt: "Strength Journeys workout log",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: LOG_PAGE_KEYWORDS,
          },
        ]}
      />
      <div className="mx-auto max-w-[116rem] px-3 pb-24 sm:px-4">
        <Head>
          <script type="application/ld+json">
            {JSON.stringify(LOG_PAGE_STRUCTURED_DATA)}
          </script>
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
              <LogDateNav
                datePickerOpen={datePickerOpen}
                isToday={isToday}
                nextSessionDate={nextSessionDate}
                onDatePickerOpenChange={setDatePickerOpen}
                onDatePickerSelect={handleDatePickerSelect}
                onNavigateToDate={navigateToDate}
                previewMode={previewMode}
                prevSessionDate={prevSessionDate}
                selectedDateObj={selectedDateObj}
                sessionDate={sessionDate}
                sessionDateObjects={sessionDateObjects}
                syncState={syncState}
                todayIso={todayIso}
              />

              {showSessionBootstrap && <LogSessionSkeleton />}

              {!showSessionBootstrap && !isLoading && !hasSession && (
                <EmptySessionState
                  addLiftChips={addLiftChips}
                  isStructuralSaving={isSheetWriteBlocked}
                  isToday={isToday}
                  onAddLift={addLift}
                  parsedData={parsedData}
                  previewMode={previewMode}
                  starterLifts={BIG_FOUR}
                />
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
                            tonnageStats={
                              perLiftTonnageStats?.[liftType] ?? null
                            }
                            dashboardStage={dashboardStage}
                            sessionCount={sessionCount}
                            isPastSession={!isToday}
                            isStructuralSaving={isSheetWriteBlocked}
                            isDeleteCooldownActive={isDeleteCooldownActive}
                            previewMode={previewMode}
                            onUpdateSet={previewMode ? undefined : updateSet}
                            onDeleteSet={previewMode ? undefined : deleteSet}
                            onAddSet={
                              previewMode
                                ? undefined
                                : (prevSet) => addSet(liftType, prevSet)
                            }
                            onNavigateToDate={
                              previewMode ? undefined : navigateToDate
                            }
                            usedSessionUrls={usedSessionUrls}
                            onSessionUrlAccepted={handleSessionUrlAccepted}
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
                        disabled={isSheetWriteBlocked}
                      />

                      <DeleteSessionControls
                        isStructuralSaving={isSheetWriteBlocked}
                        onCancel={() => setShowDeleteConfirm(false)}
                        onConfirm={handleDeleteSession}
                        onRequestConfirm={() => setShowDeleteConfirm(true)}
                        sessionDate={sessionDate}
                        showConfirm={showDeleteConfirm}
                      />
                    </>
                  )}
                </div>
              )}

              <div className="mt-10 hidden lg:block xl:hidden">
                <div className="max-w-[11rem]">{secondaryQuoteCard}</div>
              </div>
            </div>
          </main>

          <aside className="hidden xl:block" aria-hidden="true" />
        </div>
        {authStatus !== "authenticated" && (
          <LogStaticContent content={staticContent} />
        )}
      </div>
    </>
  );
}

LogSessionPage.pageTitle = "Log";
LogSessionPage.pageDescription =
  "Log your lifting session and track your progress.";

export async function getStaticProps() {
  return {
    props: {
      staticContent: LOG_PAGE_STATIC_CONTENT,
    },
  };
}

function LogStaticContent({ content }) {
  return (
    <section
      aria-labelledby="log-static-heading"
      className="border-border/50 mx-auto mt-14 max-w-[56rem] border-t pt-8"
    >
      <div className="space-y-3">
        <h1 id="log-static-heading" className="text-2xl font-semibold">
          {content.heading}
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm leading-6">
          {content.intro}
        </p>
      </div>
      <ul className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        {content.highlights.map((highlight) => (
          <li
            key={highlight}
            className="border-border/60 bg-background/60 rounded-lg border p-4 leading-6"
          >
            {highlight}
          </li>
        ))}
      </ul>
      <dl className="mt-6 space-y-4">
        {content.faq.map(({ question, answer }) => (
          <div key={question}>
            <dt className="font-medium">{question}</dt>
            <dd className="text-muted-foreground mt-1 text-sm leading-6">
              {answer}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-border/50 mt-6 border-t pt-5">
        <h2 className="text-base font-semibold">
          Built around the main barbell lifts
        </h2>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
          The log works for any movement, with richer strength context for the
          squat, bench press, deadlift, and strict press.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {content.lifts.map(({ name, href }) => (
            <li key={name}>
              <Link
                href={href}
                className="border-border bg-background hover:bg-muted inline-flex rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {name} progress guide
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
