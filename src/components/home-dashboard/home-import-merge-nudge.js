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
import { gaTrackHomeImportNudge } from "@/lib/analytics";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";
import {
  getSheetScopedStorageKey,
  LOCAL_STORAGE_KEYS,
} from "@/lib/localStorage-keys";

export function HomeImportMergeNudge() {
  const { hasUserData, isImportedData, parsedData, rawRows, sheetInfo } =
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
  const shouldShow =
    hasUserData &&
    !isImportedData &&
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
    body:
      "Import Hevy, Strong, StrongLifts, Wodify, BTWB, or another spreadsheet. Add files one at a time and merge them into one timeline.",
  };
}
