/**
 * Announces newly earned themes once per browser using the shared app banner.
 * If several unlock together, only the highest reward is surfaced to avoid noise.
 */

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTheme } from "next-themes";

import {
  AppBanner,
  AppBannerActions,
  AppBannerContent,
  AppBannerMessage,
} from "@/components/ui/app-banner";
import { Button } from "@/components/ui/button";
import { useRewardProgress } from "@/hooks/use-reward-progress";
import {
  getSheetScopedStorageKey,
  LOCAL_STORAGE_KEYS,
} from "@/lib/localStorage-keys";

export function ThemeRewardUnlockBanner({ suppress = false }) {
  const { setTheme } = useTheme();
  const {
    rewards,
    unlockedRewardIds,
    isAuthenticated,
    isProgressLoading,
    sheetInfo,
  } = useRewardProgress("theme");
  const [announcement, setAnnouncement] = useState(null);
  const storageKey = getSheetScopedStorageKey(
    LOCAL_STORAGE_KEYS.SEEN_REWARD_ANNOUNCEMENTS,
    sheetInfo?.ssid,
  );

  useEffect(() => {
    if (suppress || !isAuthenticated || isProgressLoading) return;

    // Delay the browser-only acknowledgement read until after hydration.
    const timeoutId = window.setTimeout(() => {
      const seenRewardIds = readSeenRewardIds(storageKey);
      const newlyUnlocked = rewards.filter(
        (reward) =>
          unlockedRewardIds.has(reward.id) && !seenRewardIds.has(reward.id),
      );
      if (newlyUnlocked.length === 0) return;

      unlockedRewardIds.forEach((rewardId) => seenRewardIds.add(rewardId));
      writeSeenRewardIds(storageKey, seenRewardIds);
      setAnnouncement({
        reward: newlyUnlocked[newlyUnlocked.length - 1],
        additionalCount: newlyUnlocked.length - 1,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    isAuthenticated,
    isProgressLoading,
    rewards,
    storageKey,
    suppress,
    unlockedRewardIds,
  ]);

  if (!announcement) return null;

  const { reward, additionalCount } = announcement;
  const additionalLabel = additionalCount === 1 ? "theme" : "themes";

  return (
    <AppBanner tint="primary" role="status" aria-live="polite">
      <AppBannerContent density="compact">
        <AppBannerMessage className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{reward.label} unlocked.</strong> Your training earned a new
            look.
            {additionalCount > 0 && (
              <> You also unlocked {additionalCount} earlier {additionalLabel}.</>
            )}
          </span>
        </AppBannerMessage>
        <AppBannerActions className="flex-row flex-nowrap">
          <Button
            size="sm"
            onClick={() => {
              setTheme(reward.value);
              setAnnouncement(null);
            }}
          >
            Use theme
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Dismiss reward announcement"
            onClick={() => setAnnouncement(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AppBannerActions>
      </AppBannerContent>
    </AppBanner>
  );
}

function readSeenRewardIds(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSeenRewardIds(storageKey, rewardIds) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([...rewardIds]),
    );
  } catch {
    // A blocked/full localStorage should not prevent the reward from appearing.
  }
}
