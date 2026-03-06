import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { ChooseSheetPanel } from "@/components/home-dashboard/choose-sheet-panel";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { OPEN_SHEET_SETUP_EVENT } from "@/lib/open-sheet-setup";
import { devLog } from "@/lib/processing-utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

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

function getSheetDialogCopy({ intent, state, candidateCount, statusMessage }) {
  if (state === "linking_or_creating") {
    return {
      eyebrow: "Linking your sheet",
      title: "Almost there.",
      description: "Connecting the sheet so your training history appears across the app.",
      commentary: "No extra clicks needed. This should only take a moment.",
      tone: "working",
    };
  }

  if (state === "choose_sheet") {
    const hasMultipleCandidates = candidateCount > 1;
    return {
      eyebrow: intent === "switch_sheet" ? "Ready to switch" : "Sheets found",
      title: hasMultipleCandidates
        ? (intent === "switch_sheet" ? "Choose your lifting log." : "Pick your lifting log.")
        : "Your sheet is ready.",
      description:
        hasMultipleCandidates
          ? `We found ${candidateCount} likely sheets.`
          : "We found the sheet that looks like your lifting log.",
      commentary:
        statusMessage ||
        (hasMultipleCandidates
          ? "If the top option is not right, you can choose another one."
          : "Review it below, or start fresh if you prefer."),
      tone: "ready",
    };
  }

  return {
    eyebrow: "Setting up your lifting log",
    title: intent === "switch_sheet" ? "Finding the right sheet." : "Getting your sheet ready.",
    description:
      intent === "switch_sheet"
        ? "Looking through the Google Sheets you can access."
        : "Looking for your lifting log.",
    commentary:
      statusMessage || "If we find more than one likely sheet, you can choose here.",
    tone: "working",
  };
}

export function SheetSetupDialog() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const {
    sheetInfo,
    selectSheet,
    clearSheet,
    isDemoMode,
    enterSignedInDemoMode,
    exitSignedInDemoMode,
    apiError,
  } = useUserLiftingData();

  const [open, setOpen] = useState(false);
  const [onboardingState, setOnboardingState] = useState("idle");
  const [provisionError, setProvisionError] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);
  const [candidateSheets, setCandidateSheets] = useState([]);
  const [isProvisionActionLoading, setIsProvisionActionLoading] = useState(false);
  const [isCandidateEnrichmentLoading, setIsCandidateEnrichmentLoading] = useState(false);
  const [sheetDiscoveryStatusMessage, setSheetDiscoveryStatusMessage] = useState("");
  const [flowIntent, setFlowIntent] = useState("bootstrap");
  const [recommendedCandidateId, setRecommendedCandidateId] = useState(null);
  const [hadLocalSheetBefore, setHadLocalSheetBefore] = useState(false);
  const launchedFromUserRef = useRef(false);
  const provisioningStartedRef = useRef(false);
  const dialogInitialSsidRef = useRef(null);
  const dialogCopy = getSheetDialogCopy({
    intent: flowIntent,
    state: onboardingState,
    candidateCount: candidateSheets.length,
    statusMessage: sheetDiscoveryStatusMessage,
  });

  const resetUiState = useCallback(() => {
    setProvisionError(null);
    setOnboardingState("idle");
    setCandidateSheets([]);
    setRecommendedCandidateId(null);
    setIsProvisionActionLoading(false);
    setIsCandidateEnrichmentLoading(false);
    setSheetDiscoveryStatusMessage("");
    setFlowIntent("bootstrap");
    setHadLocalSheetBefore(false);
  }, []);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

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
        return { ...candidate, ...update };
      });
      const sorted = sortCandidatesForChooser(merged);
      setRecommendedCandidateId(sorted[0]?.id || null);
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: flowIntent,
            candidateIds: primaryId ? [primaryId] : [],
            candidates,
          }),
        });
        const primaryPayload = await primaryResponse.json().catch(() => ({}));
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: flowIntent,
              candidateIds: secondaryIds,
              candidates,
            }),
          });
          const secondaryPayload = await secondaryResponse.json().catch(() => ({}));
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
        devLog("[sheet-setup] candidate enrichment failed:", error?.message || error);
        setSheetDiscoveryStatusMessage("Choose the lifting log you want to connect.");
      } finally {
        setIsCandidateEnrichmentLoading(false);
      }
    },
    [flowIntent, mergeCandidateUpdates],
  );

  const handleResolvedAction = useCallback(
    (payload, intent) => {
      if (payload?.action === "choose_sheet") {
        const discoveredCandidates = Array.isArray(payload.candidates)
          ? sortCandidatesForChooser(payload.candidates)
          : [];
        const enrichCandidateIds = Array.isArray(payload.enrichCandidateIds)
          ? payload.enrichCandidateIds
          : discoveredCandidates.slice(0, ENRICH_CANDIDATE_LIMIT).map((candidate) => candidate.id);
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
        exitSignedInDemoMode();
        selectSheet(payload.ssid, {
          url: payload.webViewLink ?? null,
          filename: payload.name ?? null,
          modifiedTime: payload.modifiedTime ?? null,
          modifiedByMeTime: payload.modifiedByMeTime ?? null,
        });
        if (payload?.action === "create_new_user_sheet" && router.pathname !== "/") {
          void router.replace("/");
        }
      }
    },
    [enrichCandidateSheets, exitSignedInDemoMode, router, selectSheet],
  );

  const resolveSheetFlow = useCallback(
    async ({ intent, hadLocalBefore = false } = {}) => {
      dialogInitialSsidRef.current = sheetInfo?.ssid || null;
      setOpen(true);
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: intent || "bootstrap",
            hadLocalSheetBefore: Boolean(hadLocalBefore),
            preferredUnitType: getPreferredUnitTypeFromClient(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
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
    [handleResolvedAction, sheetInfo?.ssid],
  );

  const runLinkAction = useCallback(
    async ({ mode, selectedSsid = null, intent = flowIntent } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOnboardingState("linking_or_creating");
      try {
        const response = await fetch("/api/link-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent,
            mode,
            selectedSsid,
            hadLocalSheetBefore,
            preferredUnitType: getPreferredUnitTypeFromClient(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
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

  const closeDialog = useCallback(() => {
    setOpen(false);
    dialogInitialSsidRef.current = sheetInfo?.ssid || null;
    if (authStatus === "authenticated" && !sheetInfo?.ssid) {
      enterSignedInDemoMode();
    }
    resetUiState();
    launchedFromUserRef.current = false;
    provisioningStartedRef.current = Boolean(sheetInfo?.ssid);
  }, [authStatus, enterSignedInDemoMode, resetUiState, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setOpen(false);
      launchedFromUserRef.current = false;
      provisioningStartedRef.current = false;
      resetUiState();
    }
  }, [authStatus, resetUiState]);

  useEffect(() => {
    if (!open || !sheetInfo?.ssid) return;
    if (sheetInfo.ssid === dialogInitialSsidRef.current) return;
    setOpen(false);
    dialogInitialSsidRef.current = sheetInfo.ssid;
    resetUiState();
    launchedFromUserRef.current = false;
    provisioningStartedRef.current = true;
  }, [open, resetUiState, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (isDemoMode) return;
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    launchedFromUserRef.current = false;
    void resolveSheetFlow({ intent: "bootstrap", hadLocalBefore: false });
  }, [authStatus, isDemoMode, resolveSheetFlow, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return undefined;

    const handleOpenSheetSetup = (event) => {
      const requestedIntent = event?.detail?.intent || "bootstrap";
      launchedFromUserRef.current = true;
      provisioningStartedRef.current = true;
      void resolveSheetFlow({
        intent: requestedIntent,
        hadLocalBefore: Boolean(sheetInfo?.ssid),
      });
    };

    window.addEventListener(OPEN_SHEET_SETUP_EVENT, handleOpenSheetSetup);
    return () => {
      window.removeEventListener(OPEN_SHEET_SETUP_EVENT, handleOpenSheetSetup);
    };
  }, [authStatus, resolveSheetFlow, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (router.query?.[SHEET_FLOW_QUERY_KEY] !== "switch") return;

    launchedFromUserRef.current = true;
    provisioningStartedRef.current = true;
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

    clearSheet();
    provisioningStartedRef.current = true;
    launchedFromUserRef.current = false;
    void resolveSheetFlow({ intent: "recovery", hadLocalBefore: true });
  }, [apiError, authStatus, clearSheet, resolveSheetFlow, sheetInfo]);

  return (
    <>
      <DrivePickerContainer
        onReady={handlePickerReady}
        trigger={authStatus === "authenticated"}
        oauthToken={session?.accessToken}
        selectSheet={selectSheet}
        onPick={(doc) => {
          if (!doc?.id) return;
          runLinkAction({
            mode: "select_existing",
            selectedSsid: doc.id,
            intent: flowIntent,
          });
        }}
      />
      <Dialog open={open} onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
          return;
        }
        closeDialog();
      }}>
        <DialogContent
          aria-describedby={undefined}
          className="w-[min(96vw,1220px)] max-w-[1220px] border-0 bg-transparent p-0 shadow-none"
        >
          <Card className="border-primary/20 bg-background/95 xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
            <CardHeader className="space-y-3 xl:px-10 2xl:px-16">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                {dialogCopy.tone === "ready" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}
                {dialogCopy.eyebrow}
              </div>
              <CardTitle className="max-w-3xl text-2xl md:text-3xl">
                {dialogCopy.title}
              </CardTitle>
              <CardDescription className="max-w-3xl space-y-2 text-base leading-relaxed">
                <p>{dialogCopy.description}</p>
                <p className="text-sm">
                  {dialogCopy.commentary}
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 xl:px-10 2xl:px-16">
              {["discovering", "linking_or_creating", "idle"].includes(onboardingState) && (
                <ProgressBody state={onboardingState} />
              )}
              {onboardingState === "choose_sheet" && (
                <ChooseSheetPanel
                  embedded
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
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProgressBody({ state }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {state === "linking_or_creating"
          ? "Connecting the sheet now."
          : "This dialog will update in place if we need you to choose between sheets."}
      </p>
    </div>
  );
}

function FallbackConnectPanel({ intent, openPicker, onRetry, isWorking, errorMessage }) {
  return (
    <Card className="mb-4 border-orange-300/50 bg-background/95 xl:mx-auto xl:w-full xl:max-w-5xl">
      <CardHeader>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          Setup needs a hand
        </div>
        <CardTitle>
          {intent === "switch_sheet" ? "Couldn’t prepare the switch yet" : "Automatic setup needs help"}
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {errorMessage || "You can retry automatic setup or choose a Google Sheet yourself."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRetry} disabled={isWorking} className="gap-2">
          <LoaderCircle className={`h-4 w-4 ${isWorking ? "animate-spin" : ""}`} />
          Retry automatic setup
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (openPicker) handleOpenFilePicker(openPicker);
          }}
          disabled={!openPicker || isWorking}
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          Set up from Google Drive
        </Button>
      </CardContent>
    </Card>
  );
}
