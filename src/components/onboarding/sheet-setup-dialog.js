/**
 * Sheet setup dialog: first-run onboarding, recovery and sheet switching.
 *
 * The server decides what a signed-in lifter needs (/api/sheet/resolve, whose
 * header holds the policy); this dialog asks, then shows the answer.
 *
 * What starts a flow (each is one effect near the bottom of SheetSetupDialog):
 *   auto      signed in, no sheet, setup not dismissed    -> resolve bootstrap
 *   ask       openSheetSetupDialog() from anywhere        -> resolve bootstrap
 *             or switch_sheet, or save an import preview into a new sheet
 *   recover   Google says the linked sheet is gone        -> resolve recovery
 *   resume    back from re-consenting to Drive access     -> the saved action
 *
 * States (onboardingState) and where each goes next:
 *   idle                   closed
 *   discovering            resolve in flight -> any state below
 *   choose_sheet           picker; a choice -> linking_or_creating
 *   linking_or_creating    /api/sheet/link in flight -> created_confirmation,
 *                          closed, or an error state
 *   created_confirmation   linked or created; the button closes the dialog
 *   fallback_error         nothing could be linked unasked; retry or browse
 *   scope_reauth_required  Drive access was declined at sign-in; sign in again
 *
 * The cases, by what resolve answers:
 *   new lifter                        create_new_user_sheet -> confirmation
 *   this browser forgot the sheet,    link_existing (the one log in Drive, or
 *   or a new device                   the last one linked) -> confirmation
 *   several logs and no last link     choose_sheet -> picker
 *   a returning lifter, none found    recover_returning_user -> fallback_error
 *
 * Two things outlive the dialog, both in localStorage: SHEET_SETUP_DISMISSED
 * (closing setup without a sheet stops it opening itself) and the pending
 * action that carries an interrupted save across the Google redirect.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { DrivePickerContainer } from "@/components/onboarding/drive-picker-container";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { ChooseSheetPanel } from "@/components/home-dashboard/choose-sheet-panel";
import { AthleteBioSliderSettings } from "@/components/athlete-bio-quick-settings";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { handleOpenFilePicker } from "@/lib/sheet/handle-open-picker";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useLocalStorage } from "usehooks-ts";
import { OPEN_SHEET_SETUP_EVENT } from "@/lib/sheet/open-sheet-setup";
import {
  PENDING_SHEET_ACTIONS,
  clearPendingSheetAction,
  persistPendingSheetAction,
  readPendingSheetAction,
} from "@/lib/sheet/pending-sheet-action";
import { devLog } from "@/lib/processing-utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";
import { SHEET_FLOW_ERROR_CODES } from "@/lib/sheet/sheet-flow-errors";
import { importWriter, useImportMerge } from "@/hooks/use-import-merge";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  Activity,
} from "lucide-react";
import { PlateDiagram } from "@/components/plate-diagram";
import { PLATE_SETS } from "@/lib/warmups";

const ENRICH_CANDIDATE_LIMIT = 12;
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

function getSheetUrl(ssid, url) {
  if (typeof url === "string" && url.trim().length > 0) return url;
  if (typeof ssid === "string" && ssid.trim().length > 0) {
    return `https://docs.google.com/spreadsheets/d/${ssid}/edit`;
  }
  return null;
}

function shouldShowConfirmation(payload) {
  if (payload?.action === "create_new_user_sheet") {
    return ["true_new_user", "reprovision_after_missing_sheet"].includes(
      payload?.reason,
    );
  }
  if (payload?.action === "link_existing") {
    return true;
  }
  return false;
}

function shouldShowSyncToastOnAutoLink(payload) {
  if (payload?.action !== "link_existing") return false;
  return ["drive_single", "legacy_drive_relink", "last_linked"].includes(
    payload?.reason,
  );
}

// The sheetInfo shape the app stores, from a resolve or link answer.
function toSheetInfo(payload) {
  return {
    ssid: payload.ssid,
    url: payload.webViewLink ?? null,
    filename: payload.name ?? null,
    modifiedTime: payload.modifiedTime ?? null,
    modifiedByMeTime: payload.modifiedByMeTime ?? null,
  };
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
  wasCreated,
}) {
  if (state === "created_confirmation") {
    return {
      eyebrow: wasCreated ? "Lifting log created" : "Lifting log connected",
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
        intent === "switch_sheet" ? "Swapping the bar over." : "Almost there.",
      description: loadingQuip,
      status: statusMessage,
      tone: "working",
    };
  }

  if (state === "choose_sheet") {
    const hasMultipleCandidates = candidateCount > 1;
    if (intent === "switch_sheet") {
      return {
        eyebrow: "Your data source",
        title: "Your lifting data.",
        description:
          "Switch sheets, bring in your history from another app, or start fresh.",
        tone: "ready",
      };
    }
    if (candidateCount === 0) {
      return {
        eyebrow: "Nothing on the bar yet",
        title: "Let's start you fresh.",
        description:
          "Nothing in your Drive looks like a lifting log, so we will rack a new one for you.",
        tone: "ready",
      };
    }
    return {
      eyebrow: "Sheets found",
      title: hasMultipleCandidates ? "Pick your lifting log." : "Found it.",
      description: hasMultipleCandidates
        ? `Google Drive spotted ${candidateCount}. Our best guess is up top.`
        : "This one looks like your lifting log. Connect it and you are back in business.",
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
        ? "Seeing what else is on the rack."
        : "Asking Google Drive to spot us.",
    description: loadingQuip,
    status: statusMessage,
    tone: "working",
  };
}

export function SheetSetupDialog() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const {
    sheetInfo,
    parsedData,
    selectSheet,
    clearSheet,
    apiError,
    clearImportedData,
    dataSource,
    importedFileName,
    importedFormatId,
    importedFormatName,
    mutate,
  } = useUserLiftingData();
  const { toast } = useToast();
  const { merge: mergeImportedPreview } = useImportMerge({
    source: "sheet_setup_write",
  });

  const [open, setOpen] = useState(false);
  // Once a signed-in lifter closes setup without a sheet (or disconnects one),
  // setup waits to be asked instead of opening itself on every visit.
  // Read on the first render, unlike every other useLocalStorage in the app:
  // this component only ever mounts in the browser, after sign-in (see the
  // loader), and the effect that opens setup runs on that same first render.
  // With the usual late read it saw "not dismissed" every time and opened.
  const [isSetupDismissed, setIsSetupDismissed] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_SETUP_DISMISSED,
    false,
    { initializeWithValue: true },
  );
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
  // A new sheet and a sheet found in Drive get different words on the
  // confirmation. The server says which; a blank sheet the lifter asked for
  // arrives as link_existing, so the action name cannot tell them apart.
  const [createdSheetIsNew, setCreatedSheetIsNew] = useState(false);
  const [dialogAction, setDialogAction] = useState(null);
  const [isDisconnectingCurrentSheet, setIsDisconnectingCurrentSheet] =
    useState(false);
  const provisioningStartedRef = useRef(false);
  // The sheet the read-failure recovery last unlinked, to spot a repeat.
  const lastRecoveredSsidRef = useRef(null);
  const dialogInitialSsidRef = useRef(null);
  const flowStartedAtRef = useRef(null);
  const outcomeReportedRef = useRef(false);
  const onboardingFlowTokenRef = useRef(null);
  // What the last resolve was asked, so Retry asks the same thing again.
  const lastResolveRequestRef = useRef(null);
  const dialogCopy = getSheetDialogCopy({
    intent: flowIntent,
    state: onboardingState,
    candidateCount: candidateSheets.length,
    statusMessage: sheetDiscoveryStatusMessage,
    loadingQuip,
    wasCreated: createdSheetIsNew,
  });
  // Discovering and linking are one visual beat: sharing a phase key keeps the
  // barbell loading up instead of resetting when the flow moves between them.
  const dialogPhase =
    onboardingState === "discovering" ||
    onboardingState === "linking_or_creating"
      ? "working"
      : onboardingState;
  // Size the shell to the state. A spinner does not need 1220px, and the old
  // fixed width left the chooser marooned in whitespace.
  const dialogWidthClass =
    {
      working: "w-[min(96vw,560px)]",
      choose_sheet: "w-[min(96vw,820px)]",
      created_confirmation: "w-[min(96vw,1100px)]",
      fallback_error: "w-[min(96vw,720px)]",
      scope_reauth_required: "w-[min(96vw,720px)]",
    }[dialogPhase] || "w-[min(96vw,560px)]";

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
    setCreatedSheetIsNew(false);
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

  // One outcome per flow, timed from when the flow began.
  const reportOutcome = useCallback(
    (event, meta = {}) => {
      if (outcomeReportedRef.current) return;
      outcomeReportedRef.current = true;
      void reportOnboardingEvent(event, {
        ...meta,
        durationMs: flowStartedAtRef.current
          ? Date.now() - flowStartedAtRef.current
          : null,
      });
    },
    [reportOnboardingEvent],
  );

  const routeToScopeRepair = useCallback(
    ({ actionType, message, intent }) => {
      const nextIntent = intent || flowIntent || "bootstrap";

      // Rare recovery rail. Nothing is saved for later here: the panel's
      // sign-in button saves the interrupted action as the lifter leaves for
      // Google (onBeforeReauth), from the action and intent set below.
      setDialogAction(actionType);
      setFlowIntent(nextIntent);
      setProvisionError(message);
      setOnboardingState("scope_reauth_required");
      setSheetDiscoveryStatusMessage("");
      setOpen(true);
    },
    [flowIntent],
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
      enrichCandidateIds = null,
      preferredRecommendedId = null,
    }) => {
      const discoveredCandidates = sortCandidatesForChooser(candidates);
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
        reportOutcome("onboarding-failed", {
          intent,
          state: "recover_returning_user",
          reason: payload?.reason || "no_match",
          hadLocalSheetBefore,
        });
        return;
      }

      if (
        payload?.action === "link_existing" ||
        payload?.action === "create_new_user_sheet"
      ) {
        clearPendingSheetAction();
        const nextSheetInfo = toSheetInfo(payload);

        if (dataSource === "import") {
          clearImportedData();
        }
        if (
          shouldShowSyncToastOnAutoLink(payload) &&
          typeof window !== "undefined"
        ) {
          window.sessionStorage.setItem(FORCE_SHEET_SYNC_TOAST_KEY, "true");
        }
        selectSheet(payload.ssid, nextSheetInfo);
        if (shouldShowConfirmation(payload)) {
          setCreatedSheetInfo(nextSheetInfo);
          setCreatedSheetReason(payload?.reason || null);
          setCreatedSheetIsNew(Boolean(payload?.wasCreated));
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
        reportOutcome("onboarding-success", {
          intent,
          resultAction: payload.action,
          reason: payload?.reason || null,
          ssid: payload?.ssid || null,
          sheetName: payload?.name || null,
          hadLocalSheetBefore,
        });
      }
    },
    [
      hadLocalSheetBefore,
      reportOutcome,
      resetUiState,
      router,
      clearImportedData,
      dataSource,
      selectSheet,
      showCandidateChooser,
    ],
  );

  const resolveSheetFlow = useCallback(
    async ({
      intent,
      hadLocalBefore = false,
      skipAutoLinkSsid = null,
    } = {}) => {
      dialogInitialSsidRef.current = sheetInfo?.ssid || null;
      flowStartedAtRef.current = Date.now();
      outcomeReportedRef.current = false;
      lastResolveRequestRef.current = {
        intent: intent || "bootstrap",
        hadLocalBefore: Boolean(hadLocalBefore),
        skipAutoLinkSsid,
      };
      setLoadingQuip(pickRandomSheetSetupQuip());
      setOpen(true);
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setFlowIntent(intent || "bootstrap");
      setHadLocalSheetBefore(Boolean(hadLocalBefore));
      setOnboardingState("discovering");
      setSheetDiscoveryStatusMessage(
        intent === "switch_sheet"
          ? "Checking which sheets you can connect."
          : "Checking for a lifting log you have used before.",
      );

      try {
        const response = await fetch("/api/sheet/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: intent || "bootstrap",
            hadLocalSheetBefore: Boolean(hadLocalBefore),
            ...(skipAutoLinkSsid ? { skipAutoLinkSsid } : {}),
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
        reportOutcome("onboarding-failed", {
          intent: intent || "bootstrap",
          state: "resolve_failed",
          reason: "automatic_setup_failed",
          hadLocalSheetBefore: Boolean(hadLocalBefore),
          provisionError: error?.message || "Automatic setup failed",
        });
      } finally {
        setIsProvisionActionLoading(false);
      }
    },
    [handleActionFailure, handleResolvedAction, reportOutcome, sheetInfo?.ssid],
  );

  const runLinkAction = useCallback(
    async ({ mode, selectedSsid = null, intent = flowIntent } = {}) => {
      setProvisionError(null);
      setIsProvisionActionLoading(true);
      setOnboardingState("linking_or_creating");
      setSheetDiscoveryStatusMessage(
        mode === "select_existing"
          ? "Connecting your lifting log."
          : "Racking a fresh sheet in your Google Drive.",
      );
      try {
        const response = await fetch("/api/sheet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent,
            mode,
            selectedSsid,
            hadLocalSheetBefore,
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
        if (intent !== "switch_sheet") {
          reportOutcome("onboarding-failed", {
            intent,
            state: "link_failed",
            reason: "sheet_linking_failed",
            hadLocalSheetBefore,
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
      reportOutcome,
    ],
  );

  // Merging the preview into the linked sheet is the import writer's job;
  // the dialog only closes once the whole preview is in.
  const handleMergeImportedIntoCurrentSheet = useCallback(async () => {
    setProvisionError(null);
    setIsProvisionActionLoading(true);
    try {
      const result = await mergeImportedPreview();
      if (result.previewDone) {
        setOpen(false);
        resetUiState();
      }
    } finally {
      setIsProvisionActionLoading(false);
    }
  }, [mergeImportedPreview, resetUiState]);

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
      setSheetDiscoveryStatusMessage(
        "Saving your preview into a new lifting log.",
      );
      setLoadingQuip(pickRandomSheetSetupQuip());

      try {
        const linkRes = await fetch("/api/sheet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "bootstrap",
            mode: "create_blank",
            importedFileName,
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

        const importedEntries = parsedData;
        const payload = await importWriter.writeWholeImport({
          ssid: linkPayload.ssid,
          entries: importedEntries,
          formatId: importedFormatId,
          formatName: importedFormatName,
          source: "sheet_setup_write",
        });
        selectSheet(linkPayload.ssid, toSheetInfo(linkPayload));
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

        reportOutcome("onboarding-success", {
          intent: "bootstrap",
          resultAction: "create_from_import",
          reason: resumeAfterReauth ? "scope_reauth_resume" : "preview_save",
          ssid: linkPayload.ssid,
          sheetName: linkPayload.name || null,
          hadLocalSheetBefore,
        });
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
      handleActionFailure,
      hadLocalSheetBefore,
      importedFileName,
      importedFormatId,
      importedFormatName,
      mutate,
      parsedData,
      reportOutcome,
      resetUiState,
      router,
      selectSheet,
      toast,
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
      setIsSetupDismissed(true);
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
  }, [clearSheet, setIsSetupDismissed]);

  const closeDialog = useCallback(() => {
    if (
      authStatus === "authenticated" &&
      !sheetInfo?.ssid &&
      provisioningStartedRef.current
    ) {
      reportOutcome("onboarding-aborted", {
        intent: flowIntent,
        state: onboardingState,
        reason: "dialog_closed",
        hadLocalSheetBefore,
        provisionError: provisionError || null,
      });
    }
    // Closing abandons a save that was waiting on Drive access. Left behind,
    // it would start setup again on every later page load.
    clearPendingSheetAction();
    setOpen(false);
    dialogInitialSsidRef.current = sheetInfo?.ssid || null;
    if (authStatus === "authenticated" && !sheetInfo?.ssid) {
      setIsSetupDismissed(true);
    }
    resetUiState();
    provisioningStartedRef.current = Boolean(sheetInfo?.ssid);
  }, [
    authStatus,
    flowIntent,
    hadLocalSheetBefore,
    onboardingState,
    provisionError,
    reportOutcome,
    resetUiState,
    setIsSetupDismissed,
    sheetInfo?.ssid,
  ]);

  // The success button says "Go to Home Dashboard", and until now it only
  // closed the dialog. Setup can start from /strength-levels/[lift], the
  // 1000lb club calculator and the homepage hero, so for everyone who did not
  // happen to already be on "/" the button quietly did nothing and they never
  // reached the dashboard the copy promised them.
  const goToDashboard = useCallback(() => {
    closeDialog();
    if (router.pathname !== "/") {
      void router.push("/");
    }
  }, [closeDialog, router]);

  useEffect(() => {
    // The loader forgets a dismissed setup on sign-out; it is always mounted.
    if (authStatus !== "authenticated") {
      setOpen(false);
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
    provisioningStartedRef.current = true;
  }, [onboardingState, open, resetUiState, sheetInfo?.ssid]);

  // Trigger "auto": signed in with no sheet, and setup has not been dismissed.
  // provisioningStartedRef gives it one turn per page load.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (isSetupDismissed) return;
    if (readPendingSheetAction()?.type) return;
    if (dataSource === "import") return; // Suppress auto-open when user has imported data — banner handles it
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    void resolveSheetFlow({ intent: "bootstrap", hadLocalBefore: false });
  }, [
    authStatus,
    dataSource,
    isSetupDismissed,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  // Trigger "resume": back from Google with the save that was interrupted.
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

    provisioningStartedRef.current = true;
    flowStartedAtRef.current = Date.now();
    outcomeReportedRef.current = false;

    if (
      pendingAction.type === PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT &&
      dataSource === "import"
    ) {
      void handleCreateSheetFromImportedPreview({ resumeAfterReauth: true });
      return;
    }

    // Ordinary setup, which is also where a saved import ends up once its
    // preview has gone (another tab, a closed browser).
    void resolveSheetFlow({
      intent: pendingAction.intent || "bootstrap",
      hadLocalBefore: Boolean(pendingAction.hadLocalBefore),
    });
  }, [
    authStatus,
    handleCreateSheetFromImportedPreview,
    dataSource,
    isProvisionActionLoading,
    open,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  // Trigger "ask": openSheetSetupDialog() from a button somewhere in the app.
  useEffect(() => {
    if (authStatus !== "authenticated") return undefined;

    const handleOpenSheetSetup = (event) => {
      const requestedIntent = event?.detail?.intent || "bootstrap";
      const requestedAction = event?.detail?.action || null;
      provisioningStartedRef.current = true;
      flowStartedAtRef.current = Date.now();
      outcomeReportedRef.current = false;

      if (
        requestedAction === PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT &&
        dataSource === "import"
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
    dataSource,
    resolveSheetFlow,
    sheetInfo?.ssid,
  ]);

  // Trigger "recover": Google says the linked sheet is gone.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid) return;
    if (!apiError?.status) return;
    if (![400, 403, 404].includes(apiError.status)) return;
    // Only on Google's own answer about this sheet, which the read route
    // marks. The same statuses from anything else are not about the sheet.
    if (apiError.code !== "SHEET_UNAVAILABLE") return;
    // Unlinking is destructive, so never do it on a flaky connection.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    // Recovery may link the lifter's last sheet straight back, which heals a
    // one-off failure without a picker. If that same sheet fails again, say
    // so, and recovery shows the picker instead of linking it a third time.
    const failedSsid = sheetInfo.ssid;
    const failedBefore = lastRecoveredSsidRef.current === failedSsid;
    lastRecoveredSsidRef.current = failedSsid;

    clearSheet();
    provisioningStartedRef.current = true;
    void resolveSheetFlow({
      intent: "recovery",
      hadLocalBefore: true,
      skipAutoLinkSsid: failedBefore ? failedSsid : null,
    });
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
          className={cn(
            "max-h-[92vh] max-w-[96vw] overflow-hidden border-0 bg-transparent p-0 shadow-none",
            "transition-[width] duration-300 ease-out",
            dialogWidthClass,
          )}
        >
          <Card className="border-primary/20 bg-background/95 flex max-h-[92vh] flex-col overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={dialogPhase}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <CardHeader className="shrink-0 space-y-3 sm:px-8">
                  {dialogCopy.tone === "working" ? null : (
                    <div className="text-primary inline-flex items-center gap-2 text-sm font-medium">
                      {dialogCopy.tone === "warning" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {dialogCopy.eyebrow}
                    </div>
                  )}
                  <DialogTitle className="max-w-3xl text-2xl leading-tight md:text-3xl">
                    {dialogCopy.title}
                  </DialogTitle>
                  {dialogCopy.description ? (
                    <CardDescription className="max-w-3xl text-base leading-relaxed">
                      {dialogCopy.description}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto sm:px-8">
                  {(onboardingState === "discovering" ||
                    onboardingState === "linking_or_creating") && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <PlateLoadingAnimation isActive={true} />
                      {dialogCopy.status ? (
                        <p
                          className="text-muted-foreground flex items-center gap-2 text-sm"
                          aria-live="polite"
                        >
                          <LoaderCircle
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                          {dialogCopy.status}
                        </p>
                      ) : null}
                      {onboardingState === "discovering" ? (
                        <p className="text-muted-foreground/80 max-w-md text-center text-xs leading-relaxed">
                          Strength Journeys can only see spreadsheets you have
                          opened with it &mdash; never the rest of your Google
                          Drive.
                        </p>
                      ) : null}
                    </div>
                  )}
                  {onboardingState === "choose_sheet" && (
                    <ChooseSheetPanel
                      intent={flowIntent}
                      candidates={candidateSheets}
                      currentSsid={sheetInfo?.ssid || null}
                      currentSheetInfo={sheetInfo}
                      recommendedId={recommendedCandidateId}
                      showImportedPreviewWarning={dataSource === "import"}
                      importedPreviewEntryCount={parsedData?.length || 0}
                      importedPreviewFileName={importedFileName || ""}
                      openPicker={openPicker}
                      isWorking={isProvisionActionLoading}
                      isDisconnectingCurrent={isDisconnectingCurrentSheet}
                      isEnriching={isCandidateEnrichmentLoading}
                      statusMessage={sheetDiscoveryStatusMessage}
                      onMergeImportedPreview={
                        dataSource === "import" && sheetInfo?.ssid
                          ? handleMergeImportedIntoCurrentSheet
                          : null
                      }
                      onChooseSheet={(ssid) =>
                        runLinkAction({
                          mode: "select_existing",
                          selectedSsid: ssid,
                        })
                      }
                      onCreateBlank={() =>
                        runLinkAction({ mode: "create_blank" })
                      }
                      onImportFromApp={() => {
                        // The import page previews the file first, then
                        // merges it into the linked sheet or saves a new one.
                        closeDialog();
                        void router.push("/import");
                      }}
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
                        // Retry what failed. A preview that could not be
                        // saved is saved again; a resolve would link or
                        // create a sheet and drop the preview. Anything else
                        // repeats the last resolve as it was asked, so a new
                        // lifter whose first try failed is still treated as
                        // new.
                        if (
                          dialogAction ===
                            PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT &&
                          dataSource === "import"
                        ) {
                          void handleCreateSheetFromImportedPreview();
                          return;
                        }
                        void resolveSheetFlow(
                          lastResolveRequestRef.current || {
                            intent: flowIntent,
                            hadLocalBefore: hadLocalSheetBefore,
                          },
                        );
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
                      wasCreated={createdSheetIsNew}
                      intent={flowIntent}
                      onGoToDashboard={goToDashboard}
                    />
                  )}
                </CardContent>
              </motion.div>
            </AnimatePresence>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Barbell loading animation shown during onboarding API calls.
 *
 * Loads plates onto the bar, holds at the top, then strips back to a bare bar
 * and goes again. The cycle matters: discovery can run for several seconds, and
 * the old version filled the bar in 1.5s and then sat frozen for the rest of
 * the wait, which reads as a hung dialog rather than work in progress.
 *
 * Loading is deliberate and stripping is quick, so the down phase reads as
 * clearing the bar for the next set rather than as progress being undone.
 * @param {boolean} props.isActive - Whether to run the animation.
 */
function PlateLoadingAnimation({ isActive }) {
  const MAX_PLATES = 5;
  const LOAD_STEP_MS = 320;
  const STRIP_STEP_MS = 110;
  const HOLD_AT_TOP_MS = 750;
  const HOLD_AT_BOTTOM_MS = 400;

  const [bar, setBar] = useState({ plateCount: 0, direction: 1 });
  // Read the unit preference once: this component re-renders on every plate.
  const [isMetric] = useState(() => getPreferredUnitTypeFromClient() === "kg");
  const { plateCount, direction } = bar;

  useEffect(() => {
    if (!isActive) {
      setBar({ plateCount: 0, direction: 1 });
      return;
    }

    const isLoading = direction === 1;
    const atTop = isLoading && plateCount >= MAX_PLATES;
    const atBottom = !isLoading && plateCount <= 0;
    const delay = atTop
      ? HOLD_AT_TOP_MS
      : atBottom
        ? HOLD_AT_BOTTOM_MS
        : isLoading
          ? LOAD_STEP_MS
          : STRIP_STEP_MS;

    const timer = setTimeout(() => {
      setBar((prev) => {
        if (prev.direction === 1 && prev.plateCount >= MAX_PLATES) {
          return { plateCount: MAX_PLATES - 1, direction: -1 };
        }
        if (prev.direction === -1 && prev.plateCount <= 0) {
          return { plateCount: 1, direction: 1 };
        }
        return {
          plateCount: prev.plateCount + prev.direction,
          direction: prev.direction,
        };
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [isActive, plateCount, direction]);

  const barWeight = isMetric ? 20 : 45;
  // Pull the disc straight from the plate set so the demo bar tracks the same
  // competition colours and proportions as the warm-up calculator.
  const plate = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(
    (p) => p.weight === (isMetric ? 20 : 45),
  );
  const platesPerSide = plateCount > 0 ? [{ ...plate, count: plateCount }] : [];
  // Bar plus both sides: the familiar 20/60/100/140/180/220 (45/135/225/...)
  // ladder every lifter counts in their head while loading up.
  const totalWeight = barWeight + plateCount * 2 * plate.weight;

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <div className="mx-auto w-fit opacity-70">
        <PlateDiagram
          platesPerSide={platesPerSide}
          barWeight={barWeight}
          isMetric={isMetric}
          hideLabels={true}
          useScrollTrigger={false}
        />
      </div>
      <p
        className="text-muted-foreground/70 text-sm font-semibold tabular-nums"
        aria-hidden
      >
        {totalWeight}
        {isMetric ? "kg" : "lb"}
      </p>
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
            Drive files. We can only see spreadsheets you choose to use with
            this app.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <GoogleSignInButton
          cta="sheet_scope_repair"
          callbackUrl={callbackUrl || "/"}
          className="gap-2"
          skipEducation
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

function CreatedSheetPanel({
  sheetInfo,
  reason,
  wasCreated,
  intent,
  onGoToDashboard,
}) {
  const sheetUrl = getSheetUrl(sheetInfo?.ssid, sheetInfo?.url);
  const sheetLabel =
    sheetInfo?.filename || "Your Strength Journeys lifting log";
  const showRecoveryHint = reason === "reprovision_after_missing_sheet";
  const isLinked = !wasCreated;
  const badgeText = isLinked
    ? "Connected from your Google Drive"
    : "Created in your Google Drive";
  const subtitleText = isLinked
    ? "Your lifting data is ready. Let's see what you've built."
    : "Every set you log becomes part of your strength story.";
  const infoText = isLinked
    ? "Your dashboards will load with your existing data."
    : "Log lifts in your sheet. Your dashboards update automatically.";
  const showBioSetupPrompt = intent !== "switch_sheet";

  const sheetCard = (
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
          {badgeText}
        </p>
        {sheetUrl ? (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 transition-colors"
          >
            Open in Google Sheets
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center text-5xl"
        aria-hidden
      >
        🎉
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
        className="mx-auto w-full max-w-2xl"
      >
        <div className="border-border/70 bg-muted/30 rounded-lg border p-5 text-left">
          {sheetCard}
        </div>
      </motion.div>
      <p className="text-foreground/80 text-center text-sm font-medium italic">
        {subtitleText}
      </p>
      <div className="border-border/70 bg-card/20 text-muted-foreground rounded-lg border px-4 py-3 text-center text-sm leading-relaxed">
        {infoText}
      </div>
      {showBioSetupPrompt ? (
        <div className="border-primary/20 bg-background/80 rounded-lg border px-4 py-4 text-left">
          <div className="mb-4 space-y-2">
            <p className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Activity className="text-primary h-4 w-4" aria-hidden />
              Add your bio details
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Set age, sex, and bodyweight now so strength standards and
              coaching context use your actual profile. The unit switch here
              also chooses your app display units between kg and lb. Each Google
              Sheet row still keeps its own unit, so direct sheet edits can mix
              kg and lb entries when you need them.
            </p>
          </div>
          <AthleteBioSliderSettings className="bg-muted/20 rounded-md p-3" />
        </div>
      ) : null}
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
      <div className="flex justify-center">
        <Button size="lg" className="gap-2 shadow-sm" onClick={onGoToDashboard}>
          Go to Home Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
