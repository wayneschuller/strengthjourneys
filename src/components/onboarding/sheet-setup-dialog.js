/**
 * Sheet setup dialog powers first-run onboarding and later sheet switching.
 * Keep the chooser aligned with the server-side recommendation flow.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { DrivePickerContainer } from "@/components/onboarding/drive-picker-container";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { ChooseSheetPanel } from "@/components/home-dashboard/choose-sheet-panel";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { deduplicateImportedEntries } from "@/lib/import/dedupe";
import { postImportHistory } from "@/lib/import-history-client";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { OPEN_SHEET_SETUP_EVENT } from "@/lib/open-sheet-setup";
import {
  PENDING_SHEET_ACTIONS,
  clearPendingSheetAction,
  persistPendingSheetAction,
  readPendingSheetAction,
} from "@/lib/pending-sheet-action";
import { devLog } from "@/lib/processing-utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { SHEET_FLOW_ERROR_CODES } from "@/lib/sheet-flow-errors";
import { useToast } from "@/hooks/use-toast";
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
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { PlateDiagram } from "@/components/warmups/plate-diagram";

const ENRICH_CANDIDATE_LIMIT = 12;
const SHEET_FLOW_QUERY_KEY = "sheetFlow";
const FORCE_SHEET_SYNC_TOAST_KEY = "SJ_forceNextSheetSyncToast";
const SHEET_SETUP_QUIPS = [
  "The bar rewards patience.",
  "A tidy logbook is a power tool.",
  "Small jumps still move the total.",
  "Calm lifters lift better.",
  "What gets measured gets managed.",
  "Plates gets dates.",
  "The big four for life: Squat, Deadlift, Bench and Strict Press.",
  "Add five pounds. Repeat.",
  "The work accumulates.",
  "Strength compounds.",
  "The logbook never lies.",
  "Track it. Then attack it.",
  "Strong people are harder to kill.",
  "Build the story of your strength.",
];

function pickRandomSheetSetupQuip() {
  return SHEET_SETUP_QUIPS[
    Math.floor(Math.random() * SHEET_SETUP_QUIPS.length)
  ];
}

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
  const rows =
    typeof candidate?.approxRows === "number" ? candidate.approxRows : 0;
  const sessions =
    typeof candidate?.approxSessions === "number"
      ? candidate.approxSessions
      : 0;
  const modifiedAt = toTimestamp(
    candidate?.modifiedByMeTime || candidate?.modifiedTime,
  );
  const title = String(candidate?.name || "").toLowerCase();
  const spanYears = getDateSpanYears(candidate);
  const ageDays =
    modifiedAt > 0 ? (Date.now() - modifiedAt) / (24 * 60 * 60 * 1000) : 99999;

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
    return (
      toTimestamp(b?.modifiedByMeTime || b?.modifiedTime) -
      toTimestamp(a?.modifiedByMeTime || a?.modifiedTime)
    );
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

function getClientLocale() {
  if (typeof window === "undefined") return "en-US";
  const locale = window.navigator?.language;
  return typeof locale === "string" && locale.trim().length > 0
    ? locale
    : "en-US";
}

function getStarterDateTextForClientLocale() {
  return new Intl.DateTimeFormat(getClientLocale(), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date());
}

function getSheetUrl(ssid, url) {
  if (typeof url === "string" && url.trim().length > 0) return url;
  if (typeof ssid === "string" && ssid.trim().length > 0) {
    return `https://docs.google.com/spreadsheets/d/${ssid}/edit`;
  }
  return null;
}

function shouldShowCreatedConfirmation(payload) {
  if (payload?.action !== "create_new_user_sheet") return false;
  return ["true_new_user", "reprovision_after_missing_sheet"].includes(
    payload?.reason,
  );
}

function shouldShowSyncToastOnAutoLink(payload) {
  if (payload?.action !== "link_existing") return false;
  return ["drive_single", "legacy_drive_relink"].includes(payload?.reason);
}

async function writeEntriesToSheet(targetSsid, entries, formatName) {
  const apiEntries = entries.map((entry) => ({
    date: entry.date,
    liftType: entry.liftType,
    reps: entry.reps,
    weight: entry.weight,
    unitType: entry.unitType || "kg",
    ...(entry.notes ? { notes: entry.notes } : {}),
  }));

  const response = await postImportHistory(
    {
      ssid: targetSsid,
      entries: apiEntries,
    },
    {
      source: "sheet_setup_write",
      formatName,
    },
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildClientFlowError(
      payload?.error || "Failed to write data to sheet",
      payload?.errorCode || null,
    );
  }

  return payload;
}

function buildClientFlowError(message, errorCode = null) {
  const error = new Error(message || "Automatic setup failed");
  error.errorCode = errorCode;
  return error;
}

function getSheetDialogCopy({
  intent,
  state,
  candidateCount,
  statusMessage,
  loadingQuip,
}) {
  if (state === "created_confirmation") {
    return {
      eyebrow: "Lifting log created",
      title: "Your lifting log is ready.",
      description: null,
      tone: "ready",
    };
  }

  if (state === "linking_or_creating") {
    return {
      eyebrow:
        intent === "switch_sheet"
          ? "Checking your lifting logs"
          : "Linking your lifting log",
      title:
        intent === "switch_sheet" ? "Reviewing your options." : "Almost there.",
      description: loadingQuip,
      tone: "working",
    };
  }

  if (state === "choose_sheet") {
    const hasMultipleCandidates = candidateCount > 1;
    return {
      eyebrow:
        intent === "switch_sheet" ? "Choose a new data source" : "Sheets found",
      title: hasMultipleCandidates
        ? intent === "switch_sheet"
          ? "Select your lifting data."
          : "Pick your lifting log."
        : intent === "switch_sheet"
          ? "Select your lifting data."
          : "Your sheet is ready.",
      description: hasMultipleCandidates
        ? intent === "switch_sheet"
          ? `We found ${candidateCount} likely data sources.`
          : `We found ${candidateCount} likely sheets.`
        : intent === "switch_sheet"
          ? "We found a likely lifting data source."
          : "We found the sheet that looks like your lifting log.",
      tone: "ready",
    };
  }

  if (state === "scope_reauth_required") {
    return {
      eyebrow: "Repair Google access",
      title: "Google Drive access is needed to save.",
      description: null,
      tone: "warning",
    };
  }

  return {
    eyebrow:
      intent === "switch_sheet"
        ? "Checking your lifting logs"
        : "Setting up your lifting log",
    title:
      intent === "switch_sheet"
        ? "Loading your sheet options."
        : "Getting your sheet ready.",
    description: loadingQuip || statusMessage,
    tone: "working",
  };
}

export function SheetSetupDialog() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const {
    sheetInfo,
    parsedData,
    sheetParsedData,
    isLoading,
    selectSheet,
    clearSheet,
    isDemoMode,
    enterSignedInDemoMode,
    exitSignedInDemoMode,
    apiError,
    importFile,
    clearImportedData,
    isImportedData,
    importedFileName,
    importedFormatName,
    mutate,
  } = useUserLiftingData();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [onboardingState, setOnboardingState] = useState("idle");
  const [provisionError, setProvisionError] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);
  const [candidateSheets, setCandidateSheets] = useState([]);
  const [isProvisionActionLoading, setIsProvisionActionLoading] =
    useState(false);
  const [isCandidateEnrichmentLoading, setIsCandidateEnrichmentLoading] =
    useState(false);
  const [sheetDiscoveryStatusMessage, setSheetDiscoveryStatusMessage] =
    useState("");
  const [loadingQuip, setLoadingQuip] = useState(() =>
    pickRandomSheetSetupQuip(),
  );
  const [flowIntent, setFlowIntent] = useState("bootstrap");
  const [recommendedCandidateId, setRecommendedCandidateId] = useState(null);
  const [hadLocalSheetBefore, setHadLocalSheetBefore] = useState(false);
  const [createdSheetInfo, setCreatedSheetInfo] = useState(null);
  const [createdSheetReason, setCreatedSheetReason] = useState(null);
  const [dialogAction, setDialogAction] = useState(null);
  const [isDisconnectingCurrentSheet, setIsDisconnectingCurrentSheet] =
    useState(false);
  const launchedFromUserRef = useRef(false);
  const provisioningStartedRef = useRef(false);
  const dialogInitialSsidRef = useRef(null);
  const flowStartedAtRef = useRef(null);
  const outcomeReportedRef = useRef(false);
  const onboardingFlowTokenRef = useRef(null);
  const dialogCopy = getSheetDialogCopy({
    intent: flowIntent,
    state: onboardingState,
    candidateCount: candidateSheets.length,
    statusMessage: sheetDiscoveryStatusMessage,
    loadingQuip,
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
    setCreatedSheetInfo(null);
    setCreatedSheetReason(null);
    setDialogAction(null);
    setIsDisconnectingCurrentSheet(false);
    onboardingFlowTokenRef.current = null;
  }, []);

  const reportOnboardingEvent = useCallback(
    async (event, meta = {}) => {
      if (authStatus !== "authenticated") return;
      const token = onboardingFlowTokenRef.current;
      if (!token) {
        devLog(
          "[sheet-setup] skipping onboarding event — no flow token:",
          event,
        );
        return;
      }
      try {
        await fetch("/api/onboarding-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, meta, onboardingFlowToken: token }),
          keepalive: true,
        });
      } catch (error) {
        devLog(
          "[sheet-setup] founder onboarding event failed:",
          error?.message || error,
        );
      }
    },
    [authStatus],
  );

  const routeToScopeRepair = useCallback(
    ({ actionType, message, intent }) => {
      const nextIntent = intent || flowIntent || "bootstrap";

      // Rare recovery rail: only persist enough context to resume the save that
      // just failed. Do not turn this into a first-class app mode.
      persistPendingSheetAction({
        type: actionType,
        hadLocalBefore: hadLocalSheetBefore,
        intent: nextIntent,
        returnPath: router.asPath,
      });
      setDialogAction(actionType);
      setFlowIntent(nextIntent);
      setProvisionError(message);
      setOnboardingState("scope_reauth_required");
      setSheetDiscoveryStatusMessage("");
      setOpen(true);
    },
    [flowIntent, hadLocalSheetBefore, router.asPath],
  );

  const handleActionFailure = useCallback(
    ({
      error,
      fallbackMessage,
      fallbackState = "fallback_error",
      actionType,
      intent,
    }) => {
      const message = error?.message || fallbackMessage;
      setProvisionError(message);
      setSheetDiscoveryStatusMessage("");

      if (
        error?.errorCode ===
          SHEET_FLOW_ERROR_CODES.GOOGLE_DRIVE_SCOPE_MISSING &&
        actionType
      ) {
        routeToScopeRepair({
          actionType,
          message,
          intent,
        });
        return;
      }

      setOnboardingState(fallbackState);
    },
    [routeToScopeRepair],
  );

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
      // Recompute the recommendation after enrichment lands: the initial pick is
      // only a lightweight guess, and the real winner often emerges once date
      // span/session metadata arrives.
      setRecommendedCandidateId(sorted[0]?.id || null);
      return sorted;
    });
  }, []);

  const enrichCandidateSheets = useCallback(
    async ({ candidates, candidateIds, primaryCandidateId = null }) => {
      const enrichIds = (Array.isArray(candidateIds) ? candidateIds : [])
        .filter((id) => typeof id === "string" && id.trim().length > 0)
        .slice(0, ENRICH_CANDIDATE_LIMIT);

      if (!enrichIds.length || !Array.isArray(candidates) || !candidates.length)
        return;

      setIsCandidateEnrichmentLoading(true);
      setSheetDiscoveryStatusMessage("Analyzing your most likely lifting log.");

      try {
        const primaryId =
          primaryCandidateId && enrichIds.includes(primaryCandidateId)
            ? primaryCandidateId
            : enrichIds[0];
        const secondaryIds = enrichIds.filter((id) => id !== primaryId);

        const primaryResponse = await fetch("/api/sheet/enrich", {
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
          throw new Error(
            primaryPayload?.error || "Failed to enrich primary candidate",
          );
        }
        const primaryEnrichedCandidates = Array.isArray(
          primaryPayload?.enrichedCandidates,
        )
          ? primaryPayload.enrichedCandidates
          : [];
        if (primaryEnrichedCandidates.length > 0) {
          mergeCandidateUpdates(primaryEnrichedCandidates);
        }

        if (secondaryIds.length > 0) {
          setSheetDiscoveryStatusMessage(
            "Checking the rest of your likely lifting logs.",
          );
          const secondaryResponse = await fetch("/api/sheet/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: flowIntent,
              candidateIds: secondaryIds,
              candidates,
            }),
          });
          const secondaryPayload = await secondaryResponse
            .json()
            .catch(() => ({}));
          if (secondaryResponse.ok) {
            const secondaryEnrichedCandidates = Array.isArray(
              secondaryPayload?.enrichedCandidates,
            )
              ? secondaryPayload.enrichedCandidates
              : [];
            if (secondaryEnrichedCandidates.length > 0) {
              mergeCandidateUpdates(secondaryEnrichedCandidates);
            }
          }
        }

        setSheetDiscoveryStatusMessage(
          "Choose the lifting log you want to connect.",
        );
      } catch (error) {
        devLog(
          "[sheet-setup] candidate enrichment failed:",
          error?.message || error,
        );
        setSheetDiscoveryStatusMessage(
          "Choose the lifting log you want to connect.",
        );
      } finally {
        setIsCandidateEnrichmentLoading(false);
      }
    },
    [flowIntent, mergeCandidateUpdates],
  );

  const showCandidateChooser = useCallback(
    ({
      candidates,
      intent,
      currentSheetId = null,
      enrichCandidateIds = null,
      preferredRecommendedId = null,
    }) => {
      const discoveredCandidates = sortCandidatesForChooser(candidates);
      const currentCandidateId =
        intent === "switch_sheet" &&
        currentSheetId &&
        discoveredCandidates.some(
          (candidate) => candidate.id === currentSheetId,
        )
          ? currentSheetId
          : null;
      const serverRecommendedId =
        preferredRecommendedId &&
        discoveredCandidates.some(
          (candidate) => candidate.id === preferredRecommendedId,
        )
          ? preferredRecommendedId
          : null;
      const recommendedId =
        serverRecommendedId || discoveredCandidates[0]?.id || null;
      const nextEnrichCandidateIds = Array.isArray(enrichCandidateIds)
        ? enrichCandidateIds
        : discoveredCandidates
            .slice(0, ENRICH_CANDIDATE_LIMIT)
            .map((candidate) => candidate.id);
      const prioritizedEnrichCandidateIds =
        recommendedId && !nextEnrichCandidateIds.includes(recommendedId)
          ? [recommendedId, ...nextEnrichCandidateIds].slice(
              0,
              ENRICH_CANDIDATE_LIMIT,
            )
          : nextEnrichCandidateIds;

      setCandidateSheets(discoveredCandidates);
      setRecommendedCandidateId(recommendedId);
      setFlowIntent(intent);
      setSheetDiscoveryStatusMessage(
        discoveredCandidates.length > 0
          ? intent === "switch_sheet"
            ? `Found ${discoveredCandidates.length} possible data sources.`
            : `Found ${discoveredCandidates.length} potential lifting logs.`
          : intent === "switch_sheet"
            ? "No accessible data sources detected yet."
            : "No previous lifting logs detected yet.",
      );
      setOnboardingState("choose_sheet");
      void enrichCandidateSheets({
        candidates: discoveredCandidates,
        candidateIds: prioritizedEnrichCandidateIds,
        primaryCandidateId: recommendedId,
      });
    },
    [enrichCandidateSheets],
  );

  const handleResolvedAction = useCallback(
    (payload, intent) => {
      if (payload?.action === "choose_sheet") {
        showCandidateChooser({
          candidates: Array.isArray(payload.candidates)
            ? payload.candidates
            : [],
          intent: payload?.intent || intent,
          currentSheetId: sheetInfo?.ssid || null,
          preferredRecommendedId: payload?.recommendedId || null,
          enrichCandidateIds: Array.isArray(payload.enrichCandidateIds)
            ? payload.enrichCandidateIds
            : null,
        });
        return;
      }

      if (payload?.action === "recover_returning_user") {
        clearPendingSheetAction();
        setOnboardingState("fallback_error");
        setSheetDiscoveryStatusMessage("");
        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-failed", {
            intent,
            state: "recover_returning_user",
            reason: payload?.reason || "no_match",
            hadLocalSheetBefore,
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
          });
        }
        return;
      }

      if (
        payload?.action === "link_existing" ||
        payload?.action === "create_new_user_sheet"
      ) {
        clearPendingSheetAction();
        const nextSheetInfo = {
          ssid: payload.ssid,
          url: payload.webViewLink ?? null,
          filename: payload.name ?? null,
          modifiedTime: payload.modifiedTime ?? null,
          modifiedByMeTime: payload.modifiedByMeTime ?? null,
        };

        if (isImportedData) {
          clearImportedData();
        }
        exitSignedInDemoMode();
        if (
          shouldShowSyncToastOnAutoLink(payload) &&
          typeof window !== "undefined"
        ) {
          window.sessionStorage.setItem(FORCE_SHEET_SYNC_TOAST_KEY, "true");
        }
        selectSheet(payload.ssid, nextSheetInfo);
        if (shouldShowCreatedConfirmation(payload)) {
          setCreatedSheetInfo(nextSheetInfo);
          setCreatedSheetReason(payload?.reason || null);
          setSheetDiscoveryStatusMessage("");
          setOnboardingState("created_confirmation");
        } else {
          // If there's no confirmation to show, close the dialog now.
          // The auto-close effect won't fire when the ssid hasn't changed
          // (e.g. user re-picked the same sheet).
          setOpen(false);
          resetUiState();
        }
        if (
          payload?.action === "create_new_user_sheet" &&
          router.pathname !== "/"
        ) {
          void router.replace("/");
        }
        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-success", {
            intent,
            resultAction: payload.action,
            reason: payload?.reason || null,
            ssid: payload?.ssid || null,
            sheetName: payload?.name || null,
            hadLocalSheetBefore,
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
          });
        }
      }
    },
    [
      exitSignedInDemoMode,
      hadLocalSheetBefore,
      reportOnboardingEvent,
      resetUiState,
      router,
      clearImportedData,
      isImportedData,
      selectSheet,
      sheetInfo?.ssid,
      showCandidateChooser,
    ],
  );

  const resolveSheetFlow = useCallback(
    async ({ intent, hadLocalBefore = false } = {}) => {
      dialogInitialSsidRef.current = sheetInfo?.ssid || null;
      flowStartedAtRef.current = Date.now();
      outcomeReportedRef.current = false;
      setLoadingQuip(pickRandomSheetSetupQuip());
      setOpen(true);
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setFlowIntent(intent || "bootstrap");
      setHadLocalSheetBefore(Boolean(hadLocalBefore));
      setOnboardingState("discovering");
      setSheetDiscoveryStatusMessage(
        intent === "switch_sheet"
          ? "Loading accessible data sources."
          : "Scanning Google Drive for existing lifting logs.",
      );

      try {
        const response = await fetch("/api/sheet/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: intent || "bootstrap",
            hadLocalSheetBefore: Boolean(hadLocalBefore),
            preferredUnitType: getPreferredUnitTypeFromClient(),
            locale: getClientLocale(),
            starterDateText: getStarterDateTextForClientLocale(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.onboardingFlowToken) {
          onboardingFlowTokenRef.current = payload.onboardingFlowToken;
        }
        if (!response.ok) {
          throw buildClientFlowError(
            payload?.error || "Automatic setup failed",
            payload?.errorCode || null,
          );
        }
        handleResolvedAction(payload, intent || "bootstrap");
      } catch (error) {
        handleActionFailure({
          error,
          fallbackMessage: "Automatic setup failed",
          actionType: PENDING_SHEET_ACTIONS.BOOTSTRAP_PROVISION,
          intent: intent || "bootstrap",
        });
        setIsCandidateEnrichmentLoading(false);
        provisioningStartedRef.current = false;
        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-failed", {
            intent: intent || "bootstrap",
            state: "resolve_failed",
            reason: "automatic_setup_failed",
            hadLocalSheetBefore: Boolean(hadLocalBefore),
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
            provisionError: error?.message || "Automatic setup failed",
          });
        }
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [
      handleActionFailure,
      handleResolvedAction,
      reportOnboardingEvent,
      sheetInfo?.ssid,
    ],
  );

  const runLinkAction = useCallback(
    async ({ mode, selectedSsid = null, intent = flowIntent } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOnboardingState("linking_or_creating");
      try {
        const response = await fetch("/api/sheet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent,
            mode,
            selectedSsid,
            hadLocalSheetBefore,
            preferredUnitType: getPreferredUnitTypeFromClient(),
            locale: getClientLocale(),
            starterDateText: getStarterDateTextForClientLocale(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.onboardingFlowToken) {
          onboardingFlowTokenRef.current = payload.onboardingFlowToken;
        }
        if (!response.ok) {
          throw buildClientFlowError(
            payload?.error || "Sheet linking failed",
            payload?.errorCode || null,
          );
        }
        handleResolvedAction(payload, intent);
      } catch (error) {
        handleActionFailure({
          error,
          fallbackMessage: "Sheet linking failed",
          fallbackState:
            intent === "switch_sheet" ? "choose_sheet" : "fallback_error",
          actionType:
            dialogAction === PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT
              ? PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT
              : PENDING_SHEET_ACTIONS.BOOTSTRAP_PROVISION,
          intent,
        });
        if (!outcomeReportedRef.current && intent !== "switch_sheet") {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-failed", {
            intent,
            state: "link_failed",
            reason: "sheet_linking_failed",
            hadLocalSheetBefore,
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
            provisionError: error?.message || "Sheet linking failed",
          });
        }
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [
      flowIntent,
      hadLocalSheetBefore,
      dialogAction,
      handleActionFailure,
      handleResolvedAction,
      reportOnboardingEvent,
    ],
  );

  const handleMergeImportedIntoCurrentSheet = useCallback(async () => {
    if (
      !sheetInfo?.ssid ||
      !Array.isArray(parsedData) ||
      parsedData.length === 0
    ) {
      return;
    }

    const isSheetComparisonPending =
      isLoading && !Array.isArray(sheetParsedData);
    if (isSheetComparisonPending) {
      toast({
        title: "Still checking your sheet",
        description:
          "Wait a moment so Strength Journeys can compare this preview against your linked data.",
      });
      return;
    }

    setProvisionError(null);
    setIsProvisionActionLoading(true);
    try {
      const importedEntries = parsedData.filter((entry) => !entry.isGoal);
      const { newEntries, skippedCount } = deduplicateImportedEntries(
        importedEntries,
        sheetParsedData,
      );

      if (newEntries.length === 0) {
        toast({
          title: "Nothing new to merge",
          description: `All ${skippedCount} entries already exist in your sheet.`,
        });
        return;
      }

      const payload = await writeEntriesToSheet(sheetInfo.ssid, newEntries, importedFormatName);
      clearImportedData();
      mutate();
      setOpen(false);
      resetUiState();

      const skippedNote =
        skippedCount > 0
          ? ` Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
          : "";

      toast({
        title: "Preview merged into your sheet",
        description: `Added ${payload.insertedRows} rows across ${payload.dateCount} date${payload.dateCount === 1 ? "" : "s"}.${skippedNote}`,
      });
    } catch (error) {
      toast({
        title: "Merge failed",
        description:
          error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProvisionActionLoading(false);
    }
  }, [
    clearImportedData,
    importedFormatName,
    isLoading,
    mutate,
    parsedData,
    resetUiState,
    sheetInfo?.ssid,
    sheetParsedData,
    toast,
  ]);

  const handleCreateSheetFromImportedPreview = useCallback(
    async ({ resumeAfterReauth = false } = {}) => {
      if (!parsedData || parsedData.length === 0) return;

      // Rare recovery rail: imported preview normally saves in one step. We
      // only persist a resumable action if Google tells us the session is
      // missing Drive scope and the user needs to re-consent.
      clearPendingSheetAction();
      setDialogAction(PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT);
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOpen(true);
      setFlowIntent("bootstrap");
      setOnboardingState("linking_or_creating");
      setLoadingQuip(pickRandomSheetSetupQuip());

      try {
        const linkRes = await fetch("/api/sheet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "bootstrap",
            mode: "create_blank",
            importedFileName,
            preferredUnitType: getPreferredUnitTypeFromClient(),
            locale: getClientLocale(),
            starterDateText: getStarterDateTextForClientLocale(),
          }),
        });
        const linkPayload = await linkRes.json().catch(() => ({}));
        if (linkPayload?.onboardingFlowToken) {
          onboardingFlowTokenRef.current = linkPayload.onboardingFlowToken;
        }
        if (!linkRes.ok || !linkPayload?.ssid) {
          throw buildClientFlowError(
            linkPayload?.error || "Failed to create Google Sheet",
            linkPayload?.errorCode || null,
          );
        }

        const importedEntries = parsedData.filter((entry) => !entry.isGoal);
        const payload = await writeEntriesToSheet(
          linkPayload.ssid,
          importedEntries,
        );
        const nextSheetInfo = {
          ssid: linkPayload.ssid,
          url: linkPayload.webViewLink ?? null,
          filename: linkPayload.name ?? null,
          modifiedTime: linkPayload.modifiedTime ?? null,
          modifiedByMeTime: linkPayload.modifiedByMeTime ?? null,
        };

        exitSignedInDemoMode();
        selectSheet(linkPayload.ssid, nextSheetInfo);
        clearImportedData();
        mutate();
        clearPendingSheetAction();

        toast({
          title: "Google Sheet created!",
          description: `Imported ${payload.insertedRows} entries into your new Strength Journeys sheet.`,
        });

        setOpen(false);
        resetUiState();
        if (router.pathname !== "/") {
          void router.replace("/");
        }

        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-success", {
            intent: "bootstrap",
            resultAction: "create_from_import",
            reason: resumeAfterReauth ? "scope_reauth_resume" : "preview_save",
            ssid: linkPayload.ssid,
            sheetName: linkPayload.name || null,
            hadLocalSheetBefore,
            importedEntryCount: importedEntries.length,
            importedFileName: importedFileName || null,
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
          });
        }
      } catch (error) {
        handleActionFailure({
          error,
          fallbackMessage: "Failed to create Google Sheet",
          actionType: PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT,
          intent: "bootstrap",
        });
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [
      clearImportedData,
      exitSignedInDemoMode,
      handleActionFailure,
      hadLocalSheetBefore,
      importedFileName,
      mutate,
      parsedData,
      reportOnboardingEvent,
      resetUiState,
      router,
      selectSheet,
      toast,
    ],
  );

  // Inline file import from the onboarding dialog: parse → create sheet → populate → link → done.
  const handleImportFile = useCallback(
    async (file) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOnboardingState("linking_or_creating");
      try {
        // Step 1: Parse the file
        const { count, formatName, entries = [] } = await importFile(file);
        if (count === 0) {
          throw new Error("No valid entries found in the file.");
        }

        // Step 2: Create a blank sheet
        const linkRes = await fetch("/api/sheet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "bootstrap",
            mode: "create_blank",
            preferredUnitType: getPreferredUnitTypeFromClient(),
            locale: getClientLocale(),
            starterDateText: getStarterDateTextForClientLocale(),
          }),
        });
        const linkPayload = await linkRes.json().catch(() => ({}));
        if (linkPayload?.onboardingFlowToken) {
          onboardingFlowTokenRef.current = linkPayload.onboardingFlowToken;
        }
        if (!linkRes.ok || !linkPayload?.ssid) {
          throw new Error(
            linkPayload?.error || "Failed to create Google Sheet",
          );
        }

        // Step 3: Use the parsed entries returned from importFile so the flow
        // does not depend on sessionStorage remaining writable.
        const importedEntries = entries.filter((entry) => !entry.isGoal);

        if (importedEntries.length > 0) {
          const apiEntries = importedEntries.map((e) => ({
            date: e.date,
            liftType: e.liftType,
            reps: e.reps,
            weight: e.weight,
            unitType: e.unitType || "kg",
            ...(e.notes ? { notes: e.notes } : {}),
          }));
          const writeRes = await postImportHistory(
            {
              ssid: linkPayload.ssid,
              entries: apiEntries,
            },
            {
              source: "sheet_setup_create",
              formatName,
            },
          );
          const writeData = await writeRes.json();
          if (!writeRes.ok) {
            throw new Error(writeData.error || "Failed to write data to sheet");
          }
        }

        // Step 4: Link the sheet
        const nextSheetInfo = {
          ssid: linkPayload.ssid,
          url: linkPayload.webViewLink ?? null,
          filename: linkPayload.name ?? null,
          modifiedTime: linkPayload.modifiedTime ?? null,
          modifiedByMeTime: linkPayload.modifiedByMeTime ?? null,
        };
        exitSignedInDemoMode();
        selectSheet(linkPayload.ssid, nextSheetInfo);
        clearImportedData();
        mutate();

        toast({
          title: "Google Sheet created from your data!",
          description: `Imported ${count} ${formatName} entries into a new Strength Journeys sheet.`,
        });

        setOpen(false);
        resetUiState();
        if (router.pathname !== "/") {
          void router.replace("/");
        }

        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportOnboardingEvent("onboarding-success", {
            intent: "bootstrap",
            resultAction: "create_from_import",
            reason: "file_import",
            ssid: linkPayload.ssid,
            sheetName: linkPayload.name || null,
            hadLocalSheetBefore,
            importedEntryCount: count,
            importedFormatName: formatName,
            durationMs: flowStartedAtRef.current
              ? Date.now() - flowStartedAtRef.current
              : null,
          });
        }
      } catch (error) {
        setProvisionError(error?.message || "File import failed");
        setOnboardingState("fallback_error");
        toast({
          title: "File import failed",
          description:
            error?.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [
      importFile,
      clearImportedData,
      exitSignedInDemoMode,
      selectSheet,
      mutate,
      toast,
      router,
      resetUiState,
      hadLocalSheetBefore,
      reportOnboardingEvent,
    ],
  );

  const disconnectCurrentSheet = useCallback(async () => {
    setProvisionError(null);
    setIsDisconnectingCurrentSheet(true);
    try {
      const response = await fetch("/api/sheet/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.error || "Failed to disconnect current data source",
        );
      }
      devLog(
        "[sheet-flow] disconnected current sheet from setup dialog",
        payload,
      );
      clearSheet();
      enterSignedInDemoMode();
      setHadLocalSheetBefore(false);
      setOnboardingState("choose_sheet");
      setSheetDiscoveryStatusMessage(
        "Current data source disconnected. Choose what to connect next.",
      );
    } catch (error) {
      console.error("[sheet-flow] disconnect current sheet failed:", error);
      setProvisionError(
        error?.message || "Failed to disconnect current data source",
      );
    } finally {
      setIsDisconnectingCurrentSheet(false);
    }
  }, [clearSheet, enterSignedInDemoMode]);

  const closeDialog = useCallback(() => {
    const shouldReportAbort =
      authStatus === "authenticated" &&
      !sheetInfo?.ssid &&
      provisioningStartedRef.current &&
      !outcomeReportedRef.current;
    if (shouldReportAbort) {
      outcomeReportedRef.current = true;
      void reportOnboardingEvent("onboarding-aborted", {
        intent: flowIntent,
        state: onboardingState,
        reason: "dialog_closed",
        hadLocalSheetBefore,
        durationMs: flowStartedAtRef.current
          ? Date.now() - flowStartedAtRef.current
          : null,
        provisionError: provisionError || null,
      });
    }
    setOpen(false);
    dialogInitialSsidRef.current = sheetInfo?.ssid || null;
    if (authStatus === "authenticated" && !sheetInfo?.ssid) {
      enterSignedInDemoMode();
    }
    resetUiState();
    launchedFromUserRef.current = false;
    provisioningStartedRef.current = Boolean(sheetInfo?.ssid);
  }, [
    authStatus,
    enterSignedInDemoMode,
    flowIntent,
    hadLocalSheetBefore,
    onboardingState,
    provisionError,
    reportOnboardingEvent,
    resetUiState,
    sheetInfo?.ssid,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setOpen(false);
      launchedFromUserRef.current = false;
      provisioningStartedRef.current = false;
      outcomeReportedRef.current = false;
      flowStartedAtRef.current = null;
      resetUiState();
    }
  }, [authStatus, resetUiState]);

  useEffect(() => {
    if (!open || !sheetInfo?.ssid) return;
    if (sheetInfo.ssid === dialogInitialSsidRef.current) return;
    if (onboardingState === "created_confirmation") {
      dialogInitialSsidRef.current = sheetInfo.ssid;
      return;
    }
    setOpen(false);
    dialogInitialSsidRef.current = sheetInfo.ssid;
    resetUiState();
    launchedFromUserRef.current = false;
    provisioningStartedRef.current = true;
  }, [onboardingState, open, resetUiState, sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (isDemoMode) return;
    if (readPendingSheetAction()?.type) return;
    if (isImportedData) return; // Suppress auto-open when user has imported data — banner handles it
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    launchedFromUserRef.current = false;
    void resolveSheetFlow({ intent: "bootstrap", hadLocalBefore: false });
  }, [
    authStatus,
    isDemoMode,
    isImportedData,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) {
      clearPendingSheetAction();
      return;
    }
    const pendingAction = readPendingSheetAction();
    if (!pendingAction?.type) return;
    if (open) return;
    if (isProvisionActionLoading) return;

    launchedFromUserRef.current = true;
    provisioningStartedRef.current = true;
    flowStartedAtRef.current = Date.now();
    outcomeReportedRef.current = false;

    if (pendingAction.type === PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT) {
      if (!isImportedData) return;
      void handleCreateSheetFromImportedPreview({ resumeAfterReauth: true });
      return;
    }

    if (pendingAction.type === PENDING_SHEET_ACTIONS.BOOTSTRAP_PROVISION) {
      void resolveSheetFlow({
        intent: pendingAction.intent || "bootstrap",
        hadLocalBefore: Boolean(pendingAction.hadLocalBefore),
      });
    }
  }, [
    authStatus,
    handleCreateSheetFromImportedPreview,
    isImportedData,
    isProvisionActionLoading,
    open,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") return undefined;

    const handleOpenSheetSetup = (event) => {
      const requestedIntent = event?.detail?.intent || "bootstrap";
      const requestedAction = event?.detail?.action || null;
      launchedFromUserRef.current = true;
      provisioningStartedRef.current = true;
      flowStartedAtRef.current = Date.now();
      outcomeReportedRef.current = false;

      if (
        requestedAction === PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT &&
        isImportedData
      ) {
        void handleCreateSheetFromImportedPreview();
        return;
      }

      void resolveSheetFlow({
        intent: requestedIntent,
        hadLocalBefore: Boolean(sheetInfo?.ssid),
      });
    };

    window.addEventListener(OPEN_SHEET_SETUP_EVENT, handleOpenSheetSetup);
    return () => {
      window.removeEventListener(OPEN_SHEET_SETUP_EVENT, handleOpenSheetSetup);
    };
  }, [
    authStatus,
    handleCreateSheetFromImportedPreview,
    isImportedData,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (router.query?.[SHEET_FLOW_QUERY_KEY] !== "switch") return;

    launchedFromUserRef.current = true;
    provisioningStartedRef.current = true;
    void resolveSheetFlow({
      intent: "switch_sheet",
      hadLocalBefore: Boolean(sheetInfo?.ssid),
    });
    const nextQuery = { ...router.query };
    delete nextQuery[SHEET_FLOW_QUERY_KEY];
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [
    authStatus,
    resolveSheetFlow,
    router,
    router.pathname,
    router.query,
    sheetInfo?.ssid,
  ]);

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
        onPickerOpen={() => setOpen(false)}
        onPickerClose={() => setOpen(true)}
        onPick={(doc) => {
          if (!doc?.id) return;
          runLinkAction({
            mode: "select_existing",
            selectedSsid: doc.id,
            intent: flowIntent,
          });
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
            return;
          }
          closeDialog();
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[92vh] w-[min(96vw,1220px)] max-w-[1220px] overflow-hidden border-0 bg-transparent p-0 shadow-none"
        >
          <Card className="border-primary/20 bg-background/95 flex max-h-[92vh] flex-col overflow-hidden xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
            <CardHeader className="shrink-0 space-y-3 xl:px-10 2xl:px-16">
              <div className="text-primary inline-flex items-center gap-2 text-sm font-medium">
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
              {dialogCopy.description ? (
                <CardDescription className="max-w-3xl text-base leading-relaxed">
                  {dialogCopy.description}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto xl:px-10 2xl:px-16">
              {(onboardingState === "discovering" ||
                onboardingState === "linking_or_creating") && (
                <PlateLoadingAnimation isActive={true} />
              )}
              {onboardingState === "choose_sheet" && (
                <ChooseSheetPanel
                  embedded
                  intent={flowIntent}
                  candidates={candidateSheets}
                  currentSsid={sheetInfo?.ssid || null}
                  currentSheetInfo={sheetInfo}
                  recommendedId={recommendedCandidateId}
                  showImportedPreviewWarning={isImportedData}
                  importedPreviewEntryCount={
                    parsedData?.filter((entry) => !entry.isGoal)?.length || 0
                  }
                  importedPreviewFileName={importedFileName || ""}
                  openPicker={openPicker}
                  isWorking={isProvisionActionLoading}
                  isDisconnectingCurrent={isDisconnectingCurrentSheet}
                  isEnriching={isCandidateEnrichmentLoading}
                  statusMessage={sheetDiscoveryStatusMessage}
                  onMergeImportedPreview={
                    isImportedData && sheetInfo?.ssid
                      ? handleMergeImportedIntoCurrentSheet
                      : null
                  }
                  onChooseSheet={(ssid) =>
                    runLinkAction({
                      mode: "select_existing",
                      selectedSsid: ssid,
                    })
                  }
                  onCreateBlank={() => runLinkAction({ mode: "create_blank" })}
                  onImportFile={handleImportFile}
                  showImportOption={false}
                  onDisconnectCurrent={() => {
                    void disconnectCurrentSheet();
                  }}
                />
              )}
              {onboardingState === "fallback_error" && (
                <FallbackConnectPanel
                  intent={flowIntent}
                  openPicker={openPicker}
                  onRetry={() => {
                    provisioningStartedRef.current = false;
                    resolveSheetFlow({
                      intent:
                        flowIntent === "switch_sheet"
                          ? "switch_sheet"
                          : "recovery",
                      hadLocalBefore: true,
                    });
                  }}
                  isWorking={isProvisionActionLoading}
                  errorMessage={provisionError}
                />
              )}
              {onboardingState === "scope_reauth_required" && (
                <ScopeRepairPanel
                  errorMessage={provisionError}
                  callbackUrl={router.asPath}
                  onDismiss={() => {
                    clearPendingSheetAction();
                    setOpen(false);
                    resetUiState();
                    provisioningStartedRef.current = false;
                  }}
                  onBeforeReauth={() => {
                    // Rare recovery rail only: remember the interrupted save so
                    // the dialog can resume it after Google re-consent returns.
                    persistPendingSheetAction({
                      type:
                        dialogAction ||
                        PENDING_SHEET_ACTIONS.BOOTSTRAP_PROVISION,
                      hadLocalBefore: hadLocalSheetBefore,
                      intent: flowIntent || "bootstrap",
                      returnPath: router.asPath,
                    });
                  }}
                />
              )}
              {onboardingState === "created_confirmation" && (
                <CreatedSheetPanel
                  sheetInfo={createdSheetInfo || sheetInfo}
                  reason={createdSheetReason}
                  onGoToDashboard={closeDialog}
                />
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Barbell loading animation shown during onboarding API calls.
 * Adds one blue plate per side at each interval to suggest "loading up"
 * while the user waits for sheet discovery or creation.
 * @param {boolean} props.isActive - Whether to run the animation.
 * @param {number} [props.stepDurationMs=1800] - Ms between each plate addition.
 */
function PlateLoadingAnimation({ isActive, stepDurationMs = 300 }) {
  const [plateCount, setPlateCount] = useState(0);
  const MAX_PLATES = 5;

  useEffect(() => {
    if (!isActive) {
      setPlateCount(0);
      return;
    }
    const timer = setInterval(() => {
      setPlateCount((prev) => (prev < MAX_PLATES ? prev + 1 : prev));
    }, stepDurationMs);
    return () => clearInterval(timer);
  }, [isActive, stepDurationMs]);

  const isMetric = getPreferredUnitTypeFromClient() === "kg";
  const barWeight = isMetric ? 20 : 45;
  const bluePlate = isMetric
    ? { weight: 20, color: "#2563EB", name: "20kg" }
    : { weight: 45, color: "#2563EB", name: "45lb" };
  const platesPerSide =
    plateCount > 0 ? [{ ...bluePlate, count: plateCount }] : [];

  return (
    <div className="mx-auto w-fit py-6 opacity-70">
      <PlateDiagram
        platesPerSide={platesPerSide}
        barWeight={barWeight}
        isMetric={isMetric}
        hideLabels={true}
        useScrollTrigger={false}
      />
    </div>
  );
}

function FallbackConnectPanel({
  intent,
  openPicker,
  onRetry,
  isWorking,
  errorMessage,
}) {
  return (
    <Card className="bg-background/95 mb-4 border-orange-300/50 xl:mx-auto xl:w-full xl:max-w-5xl">
      <CardHeader>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          Setup needs a hand
        </div>
        <CardTitle>
          {intent === "switch_sheet"
            ? "Couldn’t load your data source options yet"
            : "Automatic setup needs help"}
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {errorMessage ||
            (intent === "switch_sheet"
              ? "Retry loading your options or choose a file from Google Drive."
              : "You can retry automatic setup or choose a Google Sheet yourself.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRetry} disabled={isWorking} className="gap-2">
          <LoaderCircle
            className={`h-4 w-4 ${isWorking ? "animate-spin" : ""}`}
          />
          {intent === "switch_sheet"
            ? "Retry loading options"
            : "Retry automatic setup"}
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

function ScopeRepairPanel({
  errorMessage,
  callbackUrl,
  onDismiss,
  onBeforeReauth,
}) {
  return (
    <Card className="bg-background/95 mb-4 border-blue-300/60 xl:mx-auto xl:w-full xl:max-w-5xl">
      <CardHeader>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
          <FolderOpen className="h-4 w-4" />
          Google Drive access needed
        </div>
        <CardTitle>
          Strength Journeys needs permission to save your lifting log.
        </CardTitle>
        <CardDescription className="space-y-3 text-base leading-relaxed">
          <p>
            During sign-in, Google asks you to approve access to Drive files.
            That checkbox needs to be checked for Strength Journeys to create
            and manage your lifting log spreadsheet.
          </p>
          <div className="bg-muted/60 flex items-start gap-3 rounded-lg border px-3 py-2.5">
            <img
              src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-16dp/logo_drive_2020q4_color_1x_web_16dp.png"
              alt=""
              width={16}
              height={16}
              className="mt-0.5 shrink-0"
            />
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">
                &ldquo;See, edit, create and delete only the specific Google
                Drive files that you use with this app&rdquo;
              </span>{" "}
              must be checked.
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            This does not give Strength Journeys access to your other Google
            Drive files. We can only see the one spreadsheet we create for your
            lifting log.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <GoogleSignInButton
          cta="sheet_scope_repair"
          callbackUrl={callbackUrl || "/"}
          className="gap-2"
          onClick={() => {
            onBeforeReauth?.();
          }}
        >
          Sign in again with Drive access
        </GoogleSignInButton>
        <Button variant="outline" onClick={onDismiss}>
          Not now
        </Button>
      </CardContent>
    </Card>
  );
}

function CreatedSheetPanel({ sheetInfo, reason, onGoToDashboard }) {
  const sheetUrl = getSheetUrl(sheetInfo?.ssid, sheetInfo?.url);
  const sheetLabel =
    sheetInfo?.filename || "Your Strength Journeys lifting log";
  const showRecoveryHint = reason === "reprovision_after_missing_sheet";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto w-full max-w-2xl"
      >
        {sheetUrl ? (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border/70 hover:border-primary/35 hover:bg-primary/[0.03] block rounded-lg border bg-[#fafafa] p-5 text-left transition-colors"
            aria-label={`Open ${sheetLabel} in Google Sheets`}
          >
            <div className="flex items-start gap-4">
              <div className="border-border bg-background rounded-md border p-4">
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="h-16 w-16"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-xl font-extrabold md:text-2xl">
                  {sheetLabel}
                </p>
                <p className="bg-primary/10 text-primary mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Created in your Google Drive
                </p>
              </div>
            </div>
          </a>
        ) : (
          <div className="border-border/70 rounded-lg border bg-[#fafafa] p-5 text-left">
            <div className="flex items-start gap-4">
              <div className="border-border bg-background rounded-md border p-4">
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="h-16 w-16"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-xl font-extrabold md:text-2xl">
                  {sheetLabel}
                </p>
                <p className="bg-primary/10 text-primary mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Created in your Google Drive
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
      <p className="text-foreground/80 text-center text-sm font-medium italic">
        Every set you log becomes part of your strength story.
      </p>
      <div className="border-border/70 bg-card/20 text-muted-foreground rounded-lg border px-4 py-3 text-center text-sm leading-relaxed">
        Log lifts in your sheet. Your dashboards update automatically.
      </div>
      {showRecoveryHint ? (
        <div className="border-border/70 bg-muted/20 text-muted-foreground rounded-lg border px-4 py-3 text-center text-sm leading-relaxed">
          We created a new lifting log for you. If you deleted your old one
          recently, you may still be able to restore it from{" "}
          <a
            href="https://drive.google.com/drive/trash"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary font-medium underline underline-offset-4 transition-colors"
          >
            Google Drive trash
          </a>
          .
        </div>
      ) : null}
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {sheetUrl ? (
          <Button asChild size="lg" className="gap-2 shadow-sm">
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer">
              Open My Lifting Log
            </a>
          </Button>
        ) : (
          <Button size="lg" className="gap-2 shadow-sm" disabled>
            Open My Lifting Log
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={onGoToDashboard}
        >
          Go to Strength Dashboard
        </Button>
      </div>
    </div>
  );
}
