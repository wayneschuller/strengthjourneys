/**
 * Home-only import reminder rendered in the app shell's top banner stack.
 * Keep its stage rules and sheet-scoped dismissal behavior aligned with the
 * dashboard while avoiding a second notice rail inside the page content.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { FileUp, X } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import {
  AppBanner,
  AppBannerActions,
  AppBannerContent,
  AppBannerMessage,
  bannerAccentButtonClassName,
  bannerGhostButtonClassName,
} from "@/components/ui/app-banner";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaTrackHomeImportNudge } from "@/lib/analytics/analytics";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";
import {
  formatWorkoutFreshnessDate,
  getLatestImportedWorkoutDate,
  getRepeatImportAppName,
  getRepeatImportHref,
} from "@/lib/import/import-sources";
import { isRepeatImportDue } from "@/lib/import/import-profile";
import {
  getSheetScopedStorageKey,
  LOCAL_STORAGE_KEYS,
} from "@/lib/localStorage-keys";

export function HomeImportMergeNudge() {
  const { dataSource, importProfile, parsedData, rawRows, sheetInfo } =
    useUserLiftingData();
  const trackedImpressionKeyRef = useRef(null);
  const { dashboardStage, sessionCount } = useMemo(
    () => getDashboardStage({ parsedData, rawRows, sheetInfo }),
    [parsedData, rawRows, sheetInfo],
  );
  const storageKey = useMemo(
    () =>
      getSheetScopedStorageKey(
        LOCAL_STORAGE_KEYS.HOME_DASHBOARD_IMPORT_NUDGE_DISMISSED,
        sheetInfo?.ssid,
      ),
    [sheetInfo?.ssid],
  );
  const [isDismissed, setIsDismissed] = useLocalStorage(storageKey, false, {
    initializeWithValue: false,
  });
  const freshnessStorageKey = useMemo(
    () =>
      getSheetScopedStorageKey(
        LOCAL_STORAGE_KEYS.HOME_DASHBOARD_REPEAT_IMPORT_DISMISSED,
        sheetInfo?.ssid,
      ),
    [sheetInfo?.ssid],
  );
  const [dismissedImportAt, setDismissedImportAt] = useLocalStorage(
    freshnessStorageKey,
    null,
    { initializeWithValue: false },
  );
  const latestSheetDate = useMemo(
    () => getLatestImportedWorkoutDate(parsedData || []),
    [parsedData],
  );
  // A lifter who has imported before never sees the first-import nudge below,
  // whether or not the repeat invitation is showing right now.
  const hasImportedHere =
    dataSource === "sheet" &&
    Boolean(importProfile?.lastSourceId) &&
    (!importProfile?.lastSheetId ||
      importProfile.lastSheetId === sheetInfo?.ssid);
  const importMarker = importProfile?.lastImportCheckedAt || "unknown";
  const shouldShowFreshness =
    hasImportedHere &&
    Array.isArray(parsedData) &&
    dismissedImportAt !== importMarker &&
    isRepeatImportDue(importProfile, {
      sheetId: sheetInfo?.ssid,
      latestSheetDate,
    });
  const shouldShow =
    dataSource === "sheet" &&
    !hasImportedHere &&
    Array.isArray(parsedData) &&
    rawRows != null &&
    !isDismissed &&
    dashboardStage !== "starter_sample" &&
    dashboardStage !== "first_real_week" &&
    dashboardStage !== "established";

  useEffect(() => {
    if (!shouldShow) return;

    const trackingKey = `${storageKey}:${dashboardStage}`;
    if (trackedImpressionKeyRef.current === trackingKey) return;

    gaTrackHomeImportNudge({
      action: "impression",
      surface: "dashboard_banner",
      dashboardStage,
      sessionCount,
    });
    trackedImpressionKeyRef.current = trackingKey;
  }, [dashboardStage, sessionCount, shouldShow, storageKey]);

  useEffect(() => {
    if (!shouldShowFreshness) return;
    const trackingKey = `${storageKey}:freshness:${importProfile.lastImportCheckedAt || "unknown"}`;
    if (trackedImpressionKeyRef.current === trackingKey) return;

    gaTrackHomeImportNudge({
      action: "impression",
      surface: "dashboard_freshness",
      dashboardStage,
      sessionCount,
    });
    trackedImpressionKeyRef.current = trackingKey;
  }, [
    dashboardStage,
    importProfile?.lastImportCheckedAt,
    sessionCount,
    shouldShowFreshness,
    storageKey,
  ]);

  if (shouldShowFreshness) {
    const freshnessDate = formatWorkoutFreshnessDate(
      latestSheetDate || importProfile.latestImportedWorkoutDate,
    );
    const appName = getRepeatImportAppName(importProfile);

    return (
      <AppBanner tint="blue">
        <AppBannerContent density="compact">
          <AppBannerMessage>
            <FileUp className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
            <span className="font-semibold">
              {freshnessDate
                ? `Your log is current to ${freshnessDate}.`
                : "Keep your training timeline current."}
            </span>{" "}
            <span>
              {freshnessDate ? "Trained since then? " : ""}
              {appName
                ? `Export a fresh file from ${appName} and merge in just the new sessions.`
                : "Upload your latest file and merge in just the new sessions."}
            </span>
          </AppBannerMessage>
          <AppBannerActions className="flex-row flex-wrap">
            <Button
              asChild
              size="sm"
              className={bannerAccentButtonClassName({ tint: "blue" })}
            >
              <Link
                href={getRepeatImportHref(importProfile, "dashboard-freshness")}
                onClick={() => {
                  gaTrackHomeImportNudge({
                    action: "click",
                    surface: "dashboard_freshness",
                    dashboardStage,
                    sessionCount,
                  });
                }}
              >
                Import and Merge More Data
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={bannerGhostButtonClassName({ tint: "blue" })}
              onClick={() => {
                setDismissedImportAt(importMarker);
                gaTrackHomeImportNudge({
                  action: "dismiss",
                  surface: "dashboard_freshness",
                  dashboardStage,
                  sessionCount,
                });
              }}
            >
              <X className="h-3.5 w-3.5" />
              Not Now
            </Button>
          </AppBannerActions>
        </AppBannerContent>
      </AppBanner>
    );
  }

  if (!shouldShow) return null;

  const copy = getHomeImportNudgeCopy(dashboardStage);

  return (
    <AppBanner tint="amberAlert">
      <AppBannerContent density="compact">
        <AppBannerMessage>
          <FileUp className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
          <span className="font-semibold">{copy.title}</span>{" "}
          <span>{copy.body}</span>
        </AppBannerMessage>
        <AppBannerActions className="flex-row flex-wrap">
          <Button
            asChild
            size="sm"
            className={bannerAccentButtonClassName({ tint: "amberAlert" })}
          >
            <Link
              href="/import?source=home-dashboard-banner"
              onClick={() => {
                gaTrackHomeImportNudge({
                  action: "click",
                  surface: "dashboard_banner",
                  dashboardStage,
                  sessionCount,
                });
              }}
            >
              Import / Merge Data
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={bannerGhostButtonClassName({ tint: "amberAlert" })}
            onClick={() => {
              setIsDismissed(true);
              gaTrackHomeImportNudge({
                action: "dismiss",
                surface: "dashboard_banner",
                dashboardStage,
                sessionCount,
              });
            }}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </AppBannerActions>
      </AppBannerContent>
    </AppBanner>
  );
}

function getHomeImportNudgeCopy(dashboardStage) {
  return {
    title:
      dashboardStage === "early_base"
        ? "Your long-term dashboard gets better with more history."
        : "Already trained in another app?",
    body: "Import Hevy, Strong, StrongLifts, Wodify, BTWB, or another spreadsheet. Add files one at a time and merge them into one timeline.",
  };
}
