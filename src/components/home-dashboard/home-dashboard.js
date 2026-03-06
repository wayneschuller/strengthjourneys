// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { HomeInspirationCards } from "./home-inspiration-cards";
import { ChooseSheetPanel } from "./choose-sheet-panel";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertTriangle,
  FolderOpen,
  LoaderCircle,
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
const ENRICH_CANDIDATE_LIMIT = 6;
const SHEET_FLOW_QUERY_KEY = "sheetFlow";

function toTimestamp(iso) {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getDateSpanYears(candidate) {
  const start = toTimestamp(candidate?.dateRangeStart);
  const end = toTimestamp(candidate?.dateRangeEnd);
  if (!start || !end || end < start) return 0;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return Math.max(0, (end - start) / yearMs);
}

function scoreCandidateForChooser(candidate) {
  const rows = typeof candidate?.approxRows === "number" ? candidate.approxRows : 0;
  const sessions =
    typeof candidate?.approxSessions === "number" ? candidate.approxSessions : 0;
  const modifiedAt = toTimestamp(candidate?.modifiedByMeTime || candidate?.modifiedTime);
  const title = String(candidate?.name || "").toLowerCase();
  const spanYears = getDateSpanYears(candidate);
  const ageDays = modifiedAt > 0 ? (Date.now() - modifiedAt) / (24 * 60 * 60 * 1000) : 99999;

  let score = 0;
  score += Math.min(240, rows / 20);
  score += Math.min(280, sessions * 3);
  score += Math.min(120, spanYears * 16);
  if (ageDays <= 3) score += 40;
  else if (ageDays <= 14) score += 24;
  else if (ageDays <= 90) score += 10;
  if (title.includes("strength journey")) score += 8;
  if (title.includes("sample") || title.includes("demo")) score -= 60;
  if (title.includes("copy of")) score -= 20;
  if (title.includes("bespoke")) score += 6;

  return score;
}

function sortCandidatesForChooser(candidates) {
  const arr = Array.isArray(candidates) ? [...candidates] : [];
  arr.sort((a, b) => {
    const scoreDiff = scoreCandidateForChooser(b) - scoreCandidateForChooser(a);
    if (scoreDiff !== 0) return scoreDiff;
    return toTimestamp(b?.modifiedByMeTime || b?.modifiedTime) -
      toTimestamp(a?.modifiedByMeTime || a?.modifiedTime);
  });
  return arr;
}

function getPreferredUnitTypeFromClient() {
  if (typeof window === "undefined") return "lb";
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEYS.CALC_IS_METRIC);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed === true ? "kg" : "lb";
  } catch {
    return "lb";
  }
}

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
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const quipRef = useRef(null);
  if (quipRef.current === null) {
    quipRef.current =
      WELCOME_QUIPS[Math.floor(Math.random() * WELCOME_QUIPS.length)];
  }

  const {
    sheetInfo,
    selectSheet,
    clearSheet,
    parsedData,
    rawRows,
    dataSyncedAt,
    isValidating,
    mutate,
    apiError,
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
  const [isCandidateEnrichmentLoading, setIsCandidateEnrichmentLoading] = useState(false);
  const [sheetDiscoveryStatusMessage, setSheetDiscoveryStatusMessage] = useState("");
  const [flowIntent, setFlowIntent] = useState("bootstrap");
  const [recommendedCandidateId, setRecommendedCandidateId] = useState(null);
  const [hadLocalSheetBefore, setHadLocalSheetBefore] = useState(false);
  const provisioningStartedRef = useRef(false);
  const shouldShowSheetFlowUi =
    !sheetInfo?.ssid ||
    (flowIntent === "switch_sheet" &&
      ["discovering", "linking_or_creating", "choose_sheet", "fallback_error"].includes(
        onboardingState,
      ));
  const canDismissSheetFlow = flowIntent === "switch_sheet" && Boolean(sheetInfo?.ssid);

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
    setRecommendedCandidateId(null);
    setIsProvisionActionLoading(false);
    setIsCandidateEnrichmentLoading(false);
    setSheetDiscoveryStatusMessage("");
    setFlowIntent("bootstrap");
    setHadLocalSheetBefore(false);
  }, [authStatus]);

  const mergeCandidateUpdates = useCallback((updates = []) => {
    const updatesById = new Map(
      updates
        .filter((candidate) => candidate?.id)
        .map((candidate) => [candidate.id, candidate]),
    );

    setCandidateSheets((prev) => {
      const merged = prev.map((candidate) => {
        const update = updatesById.get(candidate.id);
        if (!update) return candidate;
        return {
          ...candidate,
          ...update,
        };
      });
      const sorted = sortCandidatesForChooser(merged);
      setRecommendedCandidateId(sorted[0]?.id || null);
      devLog("[sheet-flow] chooser recommendation updated after enrichment", {
        recommendedId: sorted[0]?.id || null,
        recommendedName: sorted[0]?.name || null,
      });
      return sorted;
    });
  }, []);

  const enrichCandidateSheets = useCallback(
    async ({ candidates, candidateIds, primaryCandidateId = null }) => {
      const enrichIds = (Array.isArray(candidateIds) ? candidateIds : [])
        .filter((id) => typeof id === "string" && id.trim().length > 0)
        .slice(0, ENRICH_CANDIDATE_LIMIT);

      if (!enrichIds.length || !Array.isArray(candidates) || !candidates.length) return;

      setIsCandidateEnrichmentLoading(true);
      setSheetDiscoveryStatusMessage("Analyzing your most likely lifting log.");

      try {
        const primaryId =
          primaryCandidateId && enrichIds.includes(primaryCandidateId)
            ? primaryCandidateId
            : enrichIds[0];
        const secondaryIds = enrichIds.filter((id) => id !== primaryId);

        const primaryResponse = await fetch("/api/enrich-sheet-candidates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              intent: flowIntent,
              candidateIds: primaryId ? [primaryId] : [],
              candidates,
            }),
        });
        const primaryPayload = await primaryResponse.json().catch(() => ({}));
        if (primaryPayload?.debug) {
          devLog("[onboarding] candidate enrichment (primary) debug:", primaryPayload.debug);
        }
        if (!primaryResponse.ok) {
          throw new Error(primaryPayload?.error || "Failed to enrich primary candidate");
        }

        const primaryEnrichedCandidates = Array.isArray(primaryPayload?.enrichedCandidates)
          ? primaryPayload.enrichedCandidates
          : [];
        if (primaryEnrichedCandidates.length > 0) {
          mergeCandidateUpdates(primaryEnrichedCandidates);
        }

        if (secondaryIds.length > 0) {
          setSheetDiscoveryStatusMessage("Checking the rest of your likely lifting logs.");
          const secondaryResponse = await fetch("/api/enrich-sheet-candidates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              intent: flowIntent,
              candidateIds: secondaryIds,
              candidates,
            }),
          });
          const secondaryPayload = await secondaryResponse.json().catch(() => ({}));
          if (secondaryPayload?.debug) {
            devLog("[onboarding] candidate enrichment (secondary) debug:", secondaryPayload.debug);
          }
          if (secondaryResponse.ok) {
            const secondaryEnrichedCandidates = Array.isArray(secondaryPayload?.enrichedCandidates)
              ? secondaryPayload.enrichedCandidates
              : [];
            if (secondaryEnrichedCandidates.length > 0) {
              mergeCandidateUpdates(secondaryEnrichedCandidates);
            }
          }
        }

        setSheetDiscoveryStatusMessage("Choose the lifting log you want to connect.");
      } catch (error) {
        devLog("[onboarding] candidate enrichment failed:", error?.message || error);
        setSheetDiscoveryStatusMessage("Choose the lifting log you want to connect.");
      } finally {
        setIsCandidateEnrichmentLoading(false);
      }
    },
    [flowIntent, mergeCandidateUpdates],
  );

  const handleResolvedAction = useCallback(
    (payload, intent) => {
      devLog("[sheet-flow] handle resolved action", {
        intent,
        action: payload?.action,
        reason: payload?.reason || null,
      });
      if (payload?.action === "choose_sheet") {
        const discoveredCandidates = Array.isArray(payload.candidates)
          ? sortCandidatesForChooser(payload.candidates)
          : [];
        const enrichCandidateIds = Array.isArray(payload.enrichCandidateIds)
          ? payload.enrichCandidateIds
          : discoveredCandidates
            .slice(0, ENRICH_CANDIDATE_LIMIT)
            .map((candidate) => candidate.id);
        setCandidateSheets(discoveredCandidates);
        setRecommendedCandidateId(discoveredCandidates[0]?.id || payload?.recommendedId || null);
        setFlowIntent(payload?.intent || intent);
        setSheetDiscoveryStatusMessage(
          discoveredCandidates.length > 0
            ? `Found ${discoveredCandidates.length} potential lifting logs.`
            : intent === "switch_sheet"
              ? "No accessible lifting logs detected yet."
              : "No previous lifting logs detected yet.",
        );
        setOnboardingState("choose_sheet");
        void enrichCandidateSheets({
          candidates: discoveredCandidates,
          candidateIds: enrichCandidateIds,
          primaryCandidateId: payload?.recommendedId || null,
        });
        return;
      }

      if (payload?.action === "recover_returning_user") {
        setOnboardingState("fallback_error");
        setSheetDiscoveryStatusMessage("");
        return;
      }

      if (payload?.action === "link_existing" || payload?.action === "create_new_user_sheet") {
        selectSheet(payload.ssid, {
          url: payload.webViewLink ?? null,
          filename: payload.name ?? null,
          modifiedTime: payload.modifiedTime ?? null,
          modifiedByMeTime: payload.modifiedByMeTime ?? null,
        });
        if (payload.wasCreated) gaTrackSheetAutoprovisioned();
        setOnboardingState(payload?.action === "create_new_user_sheet" ? "intro_oriented" : "linked");
        setShowIntroBanner(payload?.action === "create_new_user_sheet");
      }
    },
    [enrichCandidateSheets, selectSheet],
  );

  const resolveSheetFlow = useCallback(
    async ({ intent, hadLocalBefore = false } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setFlowIntent(intent || "bootstrap");
      setHadLocalSheetBefore(Boolean(hadLocalBefore));
      setOnboardingState("discovering");
      setSheetDiscoveryStatusMessage(
        intent === "switch_sheet"
          ? "Finding accessible lifting logs."
          : "Scanning Google Drive for existing lifting logs.",
      );

      try {
        const response = await fetch("/api/resolve-sheet-flow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: intent || "bootstrap",
            hadLocalSheetBefore: Boolean(hadLocalBefore),
            preferredUnitType: getPreferredUnitTypeFromClient(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.debug) {
          devLog("[sheet-flow] resolve debug:", payload.debug);
        }
        devLog("[sheet-flow] resolve response:", {
          intent,
          status: response.status,
          ok: response.ok,
          action: payload?.action || null,
        });

        if (!response.ok) {
          throw new Error(payload?.error || "Automatic setup failed");
        }
        handleResolvedAction(payload, intent || "bootstrap");
      } catch (error) {
        setProvisionError(error?.message || "Automatic setup failed");
        setOnboardingState("fallback_error");
        setSheetDiscoveryStatusMessage("");
        setIsCandidateEnrichmentLoading(false);
        provisioningStartedRef.current = false;
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [handleResolvedAction],
  );

  const runLinkAction = useCallback(
    async ({ mode, selectedSsid = null, intent = flowIntent } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOnboardingState("linking_or_creating");
      try {
        const response = await fetch("/api/link-sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent,
            mode,
            selectedSsid,
            hadLocalSheetBefore,
            preferredUnitType: getPreferredUnitTypeFromClient(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.debug) devLog("[sheet-flow] link debug:", payload.debug);
        if (!response.ok) {
          throw new Error(payload?.error || "Sheet linking failed");
        }
        handleResolvedAction(payload, intent);
      } catch (error) {
        setProvisionError(error?.message || "Sheet linking failed");
        setOnboardingState(intent === "switch_sheet" ? "choose_sheet" : "fallback_error");
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [flowIntent, hadLocalSheetBefore, handleResolvedAction],
  );

  const disconnectCurrentSheet = useCallback(async () => {
    setProvisionError(null);
    setIsProvisionActionLoading(true);
    try {
      const response = await fetch("/api/clear-sheet-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to disconnect current sheet");
      }
      devLog("[sheet-flow] disconnected current sheet", payload);
      clearSheet();
      setHadLocalSheetBefore(false);
      setFlowIntent("switch_sheet");
      setOnboardingState("choose_sheet");
      setSheetDiscoveryStatusMessage(
        "Current sheet disconnected. Choose another one or start fresh.",
      );
    } catch (error) {
      setProvisionError(error?.message || "Failed to disconnect current sheet");
    } finally {
      setIsProvisionActionLoading(false);
    }
  }, [clearSheet]);

  const handleSheetFlowOpenChange = useCallback(
    (nextOpen) => {
      if (nextOpen || !canDismissSheetFlow) return;
      setProvisionError(null);
      setFlowIntent("bootstrap");
      setOnboardingState("linked");
      setSheetDiscoveryStatusMessage("");
      setCandidateSheets([]);
      setRecommendedCandidateId(null);
      setIsCandidateEnrichmentLoading(false);
    },
    [canDismissSheetFlow],
  );

  const handlePickerSelection = useCallback(
    (doc) => {
      if (!doc?.id) return;
      devLog("[sheet-flow] picker selected sheet", {
        flowIntent,
        ssid: doc.id,
        name: doc.name || null,
      });
      runLinkAction({
        mode: "select_existing",
        selectedSsid: doc.id,
        intent: flowIntent,
      });
    },
    [flowIntent, runLinkAction],
  );

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    resolveSheetFlow({ intent: "bootstrap", hadLocalBefore: false });
  }, [authStatus, resolveSheetFlow, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (router.query?.[SHEET_FLOW_QUERY_KEY] !== "switch") return;
    provisioningStartedRef.current = true;
    setShowIntroBanner(false);
    void resolveSheetFlow({ intent: "switch_sheet", hadLocalBefore: Boolean(sheetInfo?.ssid) });
    const nextQuery = { ...router.query };
    delete nextQuery[SHEET_FLOW_QUERY_KEY];
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [authStatus, resolveSheetFlow, router, router.pathname, router.query, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid) return;
    if (!apiError?.status) return;
    if (![400, 403, 404].includes(apiError.status)) return;

    devLog("[sheet-flow] current local sheet failed, entering recovery", {
      ssid: sheetInfo.ssid,
      status: apiError.status,
      message: apiError.message,
    });
    setHadLocalSheetBefore(true);
    clearSheet();
    provisioningStartedRef.current = true;
    void resolveSheetFlow({ intent: "recovery", hadLocalBefore: true });
  }, [apiError, authStatus, clearSheet, resolveSheetFlow, sheetInfo]);

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
      {sheetInfo?.ssid && (
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
            {hasDataLoaded && (
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
          {hasDataLoaded && (
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
      )}
      <DrivePickerContainer
        onReady={handlePickerReady}
        trigger={authStatus === "authenticated"}
        oauthToken={session?.accessToken}
        selectSheet={selectSheet}
        onPick={handlePickerSelection}
      />
      <Dialog open={shouldShowSheetFlowUi} onOpenChange={handleSheetFlowOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className={`w-[min(96vw,1220px)] max-w-[1220px] border-0 bg-transparent p-0 shadow-none ${
            canDismissSheetFlow ? "" : "[&>button]:hidden"
          }`}
          onEscapeKeyDown={(event) => {
            if (!canDismissSheetFlow) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!canDismissSheetFlow) event.preventDefault();
          }}
        >
          {["discovering", "linking_or_creating", "idle"].includes(onboardingState) && (
            <ProvisioningPanel
              isWorking={isProvisionActionLoading}
              intent={flowIntent}
              state={onboardingState}
            />
          )}
          {onboardingState === "choose_sheet" && (
            <ChooseSheetPanel
              intent={flowIntent}
              candidates={candidateSheets}
              currentSsid={sheetInfo?.ssid || null}
              recommendedId={recommendedCandidateId}
              openPicker={openPicker}
              isWorking={isProvisionActionLoading}
              isEnriching={isCandidateEnrichmentLoading}
              statusMessage={sheetDiscoveryStatusMessage}
              onChooseSheet={(ssid) => runLinkAction({ mode: "select_existing", selectedSsid: ssid })}
              onCreateBlank={() => runLinkAction({ mode: "create_blank" })}
              onDisconnectCurrentSheet={disconnectCurrentSheet}
            />
          )}
          {onboardingState === "fallback_error" && (
            <FallbackConnectPanel
              intent={flowIntent}
              openPicker={openPicker}
              onRetry={() => {
                provisioningStartedRef.current = false;
                resolveSheetFlow({
                  intent: flowIntent === "switch_sheet" ? "switch_sheet" : "recovery",
                  hadLocalBefore: true,
                });
              }}
              isWorking={isProvisionActionLoading}
              errorMessage={provisionError}
            />
          )}
        </DialogContent>
      </Dialog>
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

function ProvisioningPanel({
  isWorking = true,
  intent = "bootstrap",
  state = "discovering",
}) {
  const isSwitchSheet = intent === "switch_sheet";
  const isCreating = state === "linking_or_creating";

  return (
    <Card className="mb-4 border-primary/20 bg-background/95 xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
      <CardHeader className="xl:px-10 2xl:px-16">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LoaderCircle className={`h-5 w-5 ${isWorking ? "animate-spin" : ""}`} />
          {isCreating
            ? "Forging your lifting log"
            : isSwitchSheet
              ? "Finding your accessible lifting logs"
              : "Scanning your Google Drive"}
        </CardTitle>
        <CardDescription>
          {isCreating
            ? "Racking plates, sharpening pencils, and setting up your sheet."
            : isSwitchSheet
              ? "Gathering the sheets you can access so you can deliberately switch data sources."
              : "Looking for existing lifting logs so you can connect the right sheet quickly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground xl:px-10 2xl:px-16">
        {isCreating
          ? "This usually takes a moment. No deadlifts were harmed in the process."
          : "This usually takes a few seconds."}
      </CardContent>
    </Card>
  );
}

function FallbackConnectPanel({
  openPicker,
  onRetry,
  errorMessage,
  isWorking = false,
  intent = "recovery",
}) {
  return (
    <Card className="mb-4 border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {intent === "switch_sheet" ? "No lifting logs detected yet" : "Automatic setup needs help"}
        </CardTitle>
        <CardDescription>
          {intent === "switch_sheet"
            ? "Browse Google Drive or create a new sheet if you want to switch data sources."
            : "You can retry automatic setup or connect an existing sheet from Google Drive."}
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
