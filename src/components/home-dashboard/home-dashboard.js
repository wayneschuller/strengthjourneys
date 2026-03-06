// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { HomeInspirationCards } from "./home-inspiration-cards";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { TheLatestSessionCard } from "@/components/home-dashboard/the-latest-session-card";
import { TheMonthInIronCard } from "@/components/home-dashboard/the-month-in-iron-card";
import { TheLongGameCard } from "@/components/home-dashboard/the-long-game-card";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { motion } from "motion/react";
import {
  gaTrackHomeDashboardFirstView,
  gaTrackSheetAutoprovisioned,
} from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import {
  AlertTriangle,
  CopyPlus,
  FolderOpen,
  LoaderCircle,
  PlusSquare,
  Sparkles,
} from "lucide-react";

// Short, subtle quips that incorporate the user's first name.
// {name} is replaced at render time.
const WELCOME_QUIPS = [
  "Welcome back, {name}",
  "Good to see you, {name}",
  "Stay strong, {name}",
  "Built different, {name}",
  "Iron sharpens iron, {name}",
  "Brave choices, {name}",
  "Strong looks good on you, {name}",
  "Keep showing up, {name}",
  "One rep at a time, {name}",
  "Fortitude suits you, {name}",
  "No shortcuts, {name}",
  "Earned, not given, {name}",
  "Grit and grace, {name}",
  "Bold move logging in, {name}",
  "Discipline on display, {name}",
  "Steel resolve, {name}",
  "The bar doesn't lie, {name}",
  "Heart of a lifter, {name}",
  "Respect the process, {name}",
  "You showed up, {name}",
  "Stronger every week, {name}",
  "The weights remember you, {name}",
  "Consistency is your superpower, {name}",
  "Another day, another PR, {name}",
  "The rack awaits, {name}",
  "Not just lifting, living, {name}",
  "Quiet strength, {name}",
  "Trust the training, {name}",
  "Your future self thanks you, {name}",
  "Progress over perfection, {name}",
  "Relentless, {name}",
  "Hard things make strong people, {name}",
  "Still here, still growing, {name}",
  "Gravity fears you, {name}",
  "Uncommon discipline, {name}",
  "Plates don't move themselves, {name}",
  "The grind looks good on you, {name}",
  "Nothing worth having comes easy, {name}",
  "Proof is in the logbook, {name}",
  "Built with patience, {name}",
];

/**
 * Top-level home dashboard rendered when the user is authenticated and a Google Sheet is linked.
 * Shows a personalised welcome greeting, consistency grade circles, a data-sync status row, a
 * row-processing animation, top stat cards, and the most recent session card. Falls back to
 * OnBoardingDashboard when no sheet is connected.
 * Reads session and lifting data from context; takes no props.
 *
 * @param {Object} props
 */
export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const quipRef = useRef(null);
  if (quipRef.current === null) {
    quipRef.current =
      WELCOME_QUIPS[Math.floor(Math.random() * WELCOME_QUIPS.length)];
  }

  const {
    sheetInfo,
    selectSheet,
    parsedData,
    rawRows,
    dataSyncedAt,
    isValidating,
    mutate,
  } = useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const [highlightDate, setHighlightDate] = useState(null);
  const [onboardingState, setOnboardingState] = useState("idle");
  const [provisionError, setProvisionError] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);
  const [showIntroBanner, setShowIntroBanner] = useState(false);
  const [candidateSheets, setCandidateSheets] = useState([]);
  const [isProvisionActionLoading, setIsProvisionActionLoading] = useState(false);
  const provisioningStartedRef = useRef(false);

  const nonGoalSessionCount = useMemo(() => {
    if (!Array.isArray(parsedData)) return 0;
    const uniqueDates = new Set();
    parsedData.forEach((entry) => {
      if (!entry?.isGoal && entry?.date) uniqueDates.add(entry.date);
    });
    return uniqueDates.size;
  }, [parsedData]);

  const dataMaturityStage = useMemo(() => {
    if (nonGoalSessionCount === 0) return "no_sessions";
    if (nonGoalSessionCount <= 7) return "first_week";
    if (nonGoalSessionCount <= 20) return "first_month";
    return "mature";
  }, [nonGoalSessionCount]);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  useEffect(() => {
    if (isProgressDone) setHasDataLoaded(true);
  }, [isProgressDone]);

  useEffect(() => {
    if (!sheetInfo?.ssid) setHasDataLoaded(false);
  }, [sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus === "authenticated") return;
    // HomeDashboard can remain mounted across sign-out/sign-in transitions.
    // Reset provisioning guard so the next authenticated session can re-run setup.
    provisioningStartedRef.current = false;
    setOnboardingState("idle");
    setProvisionError(null);
    setShowIntroBanner(false);
    setCandidateSheets([]);
    setIsProvisionActionLoading(false);
  }, [authStatus]);

  const performProvisioning = useCallback(
    async ({ mode = "discover", selectedSsid = null } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      if (mode === "discover") setOnboardingState("provisioning");

      try {
        const response = await fetch("/api/provision-sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode, selectedSsid }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.debug) {
          devLog("[onboarding] provision-sheet debug:", payload.debug);
        }
        devLog("[onboarding] provision-sheet response:", {
          mode,
          status: response.status,
          ok: response.ok,
          needsSelection: Boolean(payload?.needsSelection),
          hasSsid: Boolean(payload?.ssid),
        });

        if (!response.ok) {
          throw new Error(payload?.error || "Automatic setup failed");
        }

        if (payload?.needsSelection) {
          setCandidateSheets(Array.isArray(payload.candidates) ? payload.candidates : []);
          setOnboardingState("choose_sheet");
          provisioningStartedRef.current = false;
          return;
        }

        if (!payload?.ssid) {
          throw new Error("Provisioning returned no sheet id");
        }

        devLog("[onboarding] linking selected/provisioned sheet:", {
          mode,
          ssid: payload.ssid,
          name: payload.name || null,
          wasCreated: Boolean(payload.wasCreated),
        });
        selectSheet(payload.ssid, {
          url: payload.webViewLink ?? null,
          filename: payload.name ?? null,
          modifiedTime: payload.modifiedTime ?? null,
          modifiedByMeTime: payload.modifiedByMeTime ?? null,
        });
        if (payload.wasCreated) gaTrackSheetAutoprovisioned();
        setOnboardingState("intro_oriented");
        setShowIntroBanner(true);
      } catch (error) {
        setProvisionError(error?.message || "Automatic setup failed");
        setOnboardingState("fallback_error");
        provisioningStartedRef.current = false;
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [selectSheet],
  );

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    performProvisioning({ mode: "discover" });
  }, [authStatus, performProvisioning, sheetInfo?.ssid]);

  useEffect(() => {
    if (!sheetInfo?.ssid) return;
    devLog("[onboarding] sheet linked in local state:", sheetInfo);
  }, [sheetInfo]);

  useEffect(() => {
    if (sheetInfo?.ssid && hasDataLoaded && onboardingState === "intro_oriented") {
      setShowIntroBanner(true);
    }
  }, [sheetInfo?.ssid, hasDataLoaded, onboardingState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid || !hasDataLoaded || !Array.isArray(parsedData)) return;

    const storageKey = LOCAL_STORAGE_KEYS.HOME_DASHBOARD_FIRST_VIEW_TRACKED;
    if (window.localStorage.getItem(storageKey) === "1") return;

    const parsedDataCount = parsedData.length;
    const nonGoalParsedDataCount = parsedData.reduce(
      (count, entry) => (entry?.isGoal ? count : count + 1),
      0,
    );

    gaTrackHomeDashboardFirstView({
      parsedDataCount,
      nonGoalParsedDataCount,
    });
    window.localStorage.setItem(storageKey, "1");
  }, [authStatus, sheetInfo?.ssid, hasDataLoaded, parsedData]);

  return (
    <div>
      <div className="relative mb-4 2xl:mb-6 text-xl">
        {/* 2xl: welcome left + status right in one row, vertically centered with circles */}
        <div className="2xl:flex 2xl:items-start 2xl:justify-between">
          <motion.div
            className="mb-2 text-center 2xl:mb-0 2xl:text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-muted-foreground">
              {quipRef.current.split("{name}")[0]}
            </span>
            <span className="font-bold">
              {session.user.name?.split(" ")[0]}
            </span>
          </motion.div>
          {sheetInfo?.ssid && hasDataLoaded && (
            <div className="hidden 2xl:block">
              <DataSheetStatus
                rawRows={rawRows}
                parsedData={parsedData}
                dataSyncedAt={dataSyncedAt}
                isValidating={isValidating}
                sheetURL={sheetInfo?.url}
                sheetFilename={sheetInfo?.filename}
                mutate={mutate}
              />
            </div>
          )}
        </div>
        {/* Mobile: status below circles */}
        {sheetInfo?.ssid && hasDataLoaded && (
          <div className="mt-2 flex justify-center 2xl:hidden">
            <DataSheetStatus
              rawRows={rawRows}
              parsedData={parsedData}
              dataSyncedAt={dataSyncedAt}
              isValidating={isValidating}
              sheetURL={sheetInfo?.url}
              sheetFilename={sheetInfo?.filename}
              mutate={mutate}
            />
          </div>
        )}
      </div>
      {!sheetInfo?.ssid && (
        <>
          <DrivePickerContainer
            onReady={handlePickerReady}
            trigger={authStatus === "authenticated"}
            oauthToken={session?.accessToken}
            selectSheet={selectSheet}
          />
          {(onboardingState === "provisioning" || onboardingState === "idle") && (
            <ProvisioningPanel
              isWorking={isProvisionActionLoading}
            />
          )}
          {onboardingState === "choose_sheet" && (
            <ChooseSheetPanel
              candidates={candidateSheets}
              openPicker={openPicker}
              isWorking={isProvisionActionLoading}
              onChooseSheet={(ssid) => performProvisioning({ mode: "select_existing", selectedSsid: ssid })}
              onCreateBlank={() => performProvisioning({ mode: "create_blank" })}
              onCreateSample={() => performProvisioning({ mode: "create_sample" })}
            />
          )}
          {onboardingState === "fallback_error" && (
            <>
              <FallbackConnectPanel
                openPicker={openPicker}
                onRetry={() => {
                  provisioningStartedRef.current = false;
                  performProvisioning({ mode: "discover" });
                }}
                isWorking={isProvisionActionLoading}
                errorMessage={provisionError}
              />
            </>
          )}
        </>
      )}
      {sheetInfo?.ssid && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
        />
      )}
      {sheetInfo?.ssid && <HomeInspirationCards isProgressDone={hasDataLoaded} />}
      {sheetInfo?.ssid && hasDataLoaded && (
        <>
          {showIntroBanner && (
            <IntroOrientationBanner
              firstName={session?.user?.name?.split(" ")?.[0] || "there"}
              onDismiss={() => {
                setShowIntroBanner(false);
                setOnboardingState("normal_dashboard");
              }}
            />
          )}
          <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {/* Three headline cards intentionally begin with "The" and widen chronology:
                The Latest Session -> The Month in Iron -> The Long Game.
                Together they make the app experience feel badass and motivating, like chapters in an ongoing strength story. */}
            <TheLatestSessionCard
              highlightDate={highlightDate}
              setHighlightDate={setHighlightDate}
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
            <TheMonthInIronCard
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
            <TheLongGameCard
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ProvisioningPanel({ isWorking = true }) {
  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LoaderCircle className={`h-5 w-5 ${isWorking ? "animate-spin" : ""}`} />
          Setting up your personal lifting sheet
        </CardTitle>
        <CardDescription>
          Strength Journeys is creating your own Google Sheet and linking it automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This usually takes a few seconds. You will land straight in your dashboard.
      </CardContent>
    </Card>
  );
}

function formatYearLabel(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

function formatCandidateMeta(candidate) {
  const isSampled = Boolean(candidate?.metadataSampled);
  const bits = [];

  if (typeof candidate?.approxRows === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxRows.toLocaleString()}+ rows`
        : `${candidate.approxRows.toLocaleString()} rows`,
    );
  }
  if (typeof candidate?.approxSessions === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxSessions.toLocaleString()}+ workouts`
        : `${candidate.approxSessions.toLocaleString()} workouts`,
    );
  }
  const start = formatYearLabel(candidate?.dateRangeStart);
  const end = formatYearLabel(candidate?.dateRangeEnd);
  if (start && end) bits.push(`${start}-${end}`);

  if (bits.length === 0) return "Lifting sheet detected";
  return bits.join(" · ");
}

function formatRecommendedMeta(candidate) {
  const bits = [];
  const isSampled = Boolean(candidate?.metadataSampled);
  const startYear = parseInt(formatYearLabel(candidate?.dateRangeStart) || "", 10);
  const endYear = parseInt(formatYearLabel(candidate?.dateRangeEnd) || "", 10);
  if (typeof candidate?.approxSessions === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxSessions.toLocaleString()}+ workouts`
        : `${candidate.approxSessions.toLocaleString()} workouts`,
    );
  }
  if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
    if (isSampled) {
      const spanYears = endYear - startYear + 1;
      bits.push(`${spanYears}+ years data`);
    } else {
      bits.push(`${startYear}-${endYear}`);
    }
  }
  return bits.join(" • ") || "Lifting log detected";
}

function formatPreviewDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPreviewLiftLabel(liftType) {
  const liftLabelMap = {
    "Back Squat": "Squat",
    "Bench Press": "Bench",
    Deadlift: "Deadlift",
    "Strict Press": "Press",
  };
  return liftLabelMap[liftType] || liftType;
}

function formatPreviewWeight(preview) {
  if (!preview || typeof preview.weight !== "number") return "";
  const roundedWeight =
    Math.abs(preview.weight - Math.round(preview.weight)) < 0.05
      ? String(Math.round(preview.weight))
      : preview.weight.toFixed(1);
  return `${roundedWeight}${preview.unitType || ""}`;
}

function formatPreviewSetDetail(preview) {
  if (!preview) return "";
  const weight = formatPreviewWeight(preview);
  const date = formatPreviewDate(preview.date);
  if (!weight) return "";
  return `${preview.reps}@${weight}${date ? ` (${date})` : ""}`;
}

function ChooseSheetPanel({
  candidates,
  openPicker,
  isWorking,
  onChooseSheet,
  onCreateBlank,
  onCreateSample,
}) {
  return (
    <Card className="mb-4 border-primary/20 bg-background/95 xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
      <CardHeader className="xl:px-10 2xl:px-16">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          Connect your lifting log
        </CardTitle>
        <CardDescription>
          Strength Journeys found Google Sheets in your Drive that look like lifting logs. Choose one to connect, or create a new sheet to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 xl:px-10 2xl:px-16">
        <div className="space-y-3">
          {candidates[0] && (
            <>
              <p className="text-sm font-semibold text-foreground">
                Your lifting log
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div
                  key={candidates[0].id}
                  className="rounded-xl border border-black/10 bg-card/40 px-6 py-6"
                >
                  <div className="max-w-2xl space-y-5">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-base font-semibold text-foreground">
                        {candidates[0].name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatRecommendedMeta(candidates[0])}
                      </p>
                      {Array.isArray(candidates[0].bigFourPreview) &&
                        candidates[0].bigFourPreview.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Best lifts detected
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {candidates[0].bigFourPreview.map((preview) => (
                                <div
                                  key={preview.liftType}
                                  className="flex min-w-[120px] items-center gap-2 rounded-md border border-black/10 bg-background/90 px-2.5 py-2"
                                >
                                  <LiftSvg
                                    liftType={preview.liftType}
                                    size="sm"
                                    animate={false}
                                    className="h-8 w-8"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium leading-tight text-muted-foreground">
                                      {getPreviewLiftLabel(preview.liftType)}
                                    </p>
                                    <p className="text-base font-semibold leading-tight text-foreground">
                                      {formatPreviewWeight(preview)}
                                    </p>
                                    <p className="truncate text-[10px] leading-tight text-muted-foreground">
                                      {formatPreviewSetDetail(preview)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto sm:min-w-56"
                      disabled={isWorking}
                      onClick={() => onChooseSheet(candidates[0].id)}
                    >
                      Connect this lifting log
                    </Button>
                  </div>
                </div>
                <div className="flex items-start justify-center lg:pt-1">
                  <div className="w-full max-w-sm rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Don&apos;t see the sheet you want?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Browse Google Drive to grant Strength Journeys access to another sheet.
                    </p>
                    <div className="mt-2 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-52"
                        disabled={!openPicker || isWorking}
                        onClick={() => {
                          if (openPicker) handleOpenFilePicker(openPicker);
                        }}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Browse Google Drive
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {candidates.length > 1 && (
            <>
              <p className="pt-2 text-sm font-semibold text-muted-foreground">
                Other sheets we detected
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {candidates.slice(1).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex min-w-0 items-center gap-2">
                        <img
                          src={GOOGLE_SHEETS_ICON_URL}
                          alt=""
                          className="h-4 w-4 shrink-0"
                          aria-hidden
                        />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {candidate.name}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCandidateMeta(candidate)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isWorking}
                      onClick={() => onChooseSheet(candidate.id)}
                    >
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="border-t pt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Or start with a new sheet
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={onCreateBlank}
              disabled={isWorking}
            >
              <PlusSquare className="mr-2 h-4 w-4" />
              Start fresh (create a new lifting sheet)
            </Button>
            <Button
              variant="ghost"
              onClick={onCreateSample}
              disabled={isWorking}
            >
              <CopyPlus className="mr-2 h-4 w-4" />
              Create demo sheet with example data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FallbackConnectPanel({ openPicker, onRetry, errorMessage, isWorking = false }) {
  return (
    <Card className="mb-4 border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Automatic setup needs help
        </CardTitle>
        <CardDescription>
          You can retry automatic setup or connect an existing sheet from Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMessage && (
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} disabled={isWorking}>Retry automatic setup</Button>
          <Button
            variant="outline"
            disabled={!openPicker || isWorking}
            onClick={() => {
              if (openPicker) handleOpenFilePicker(openPicker);
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Connect an existing sheet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntroOrientationBanner({ firstName, onDismiss }) {
  return (
    <Card className="mb-4 border-emerald-600/30 bg-emerald-600/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Sparkles className="h-5 w-5" />
          Your dashboard is ready, {firstName}
        </CardTitle>
        <CardDescription>
          Start with your next training session and watch these cards evolve as your data grows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Continue to dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
