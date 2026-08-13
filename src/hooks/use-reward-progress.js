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

  return {
    ...progress,
    rewards,
    authStatus,
    isAuthenticated,
    sheetInfo,
    isProgressLoading:
      authStatus === "loading" || isLoading || isReturningUserLoading,
  };
}
