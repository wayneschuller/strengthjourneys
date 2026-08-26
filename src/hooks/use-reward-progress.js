/**
 * Connects the generic reward engine to authenticated, real lifting data.
 * Consumers can request one category without knowing how progress is sourced.
 */

import { useMemo } from "react";
import { useSession } from "next-auth/react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getRewardsByCategory } from "@/lib/rewards/catalog";
import { getRewardProgress } from "@/lib/rewards/progression";

export function useRewardProgress(category) {
  const { status: authStatus } = useSession();
  const {
    parsedData,
    isDemoMode,
    hasUserData,
    isLoading,
    isReturningUserLoading,
    sheetInfo,
  } = useUserLiftingData();
  const rewards = useMemo(() => getRewardsByCategory(category), [category]);
  const isAuthenticated = authStatus === "authenticated";
  const progress = useMemo(
    () =>
      getRewardProgress({
        isAuthenticated,
        isDemoMode,
        parsedData,
        rewards,
      }),
    [isAuthenticated, isDemoMode, parsedData, rewards],
  );

  // The provider writes parsedData from an effect that runs *after* the render
  // where SWR (or the access token wait) stops reporting loading. In that gap a
  // returning lifter looks like "loaded, but zero training data", which made the
  // ThemeChooser demote a legitimately unlocked theme back to light and persist
  // it. Stay loading until real data has actually landed in context.
  const isAwaitingUserData = hasUserData && !parsedData;

  return {
    ...progress,
    rewards,
    authStatus,
    isAuthenticated,
    sheetInfo,
    isProgressLoading:
      authStatus === "loading" ||
      isLoading ||
      isReturningUserLoading ||
      isAwaitingUserData,
  };
}
