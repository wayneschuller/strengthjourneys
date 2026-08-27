import { THEME_REWARDS } from "@/lib/rewards/catalog";
import {
  isRewardUnlocked,
  getRewardRequirement,
} from "@/lib/rewards/progression";

/*
 * Vote weight on the playlist leaderboard rides the same ladder as the theme rewards.
 *
 * It used to key off how long ago someone linked a sheet, which rewarded holding an account
 * rather than doing the training. The themes already encode "how much lifting has this person
 * actually logged", so there is no reason to maintain a second, worse answer to the same
 * question. One ladder, two rewards: a theme to look at and a heavier vote.
 *
 *   anonymous                     1x
 *   signed in, nothing logged     2x
 *   each theme unlocked          +1x, to 10x at Neo Brutalism Dark
 */

const ANONYMOUS_WEIGHT = 1;
const SIGNED_IN_BASE_WEIGHT = 2;

/**
 * Derives vote weight from verified training metrics.
 * @param {Object|null} metrics - Output of getTrainingRewardMetrics(), or null when unavailable.
 * @param {boolean} isSignedIn - Whether the voter has a session.
 * @returns {{weight: number, label: string, blurb: string, unlockedCount: number, signedIn: boolean, isTopTier: boolean}}
 */
export function getVoteWeightFromMetrics(metrics, isSignedIn) {
  if (!isSignedIn) {
    return {
      weight: ANONYMOUS_WEIGHT,
      label: "Anonymous",
      blurb: "Sign in with Google and your votes start counting for more.",
      unlockedCount: 0,
      signedIn: false,
      isTopTier: false,
    };
  }

  const unlocked = metrics
    ? THEME_REWARDS.filter((reward) => isRewardUnlocked(reward, metrics))
    : [];
  const highest = unlocked[unlocked.length - 1];
  const next = THEME_REWARDS[unlocked.length];

  return {
    weight: SIGNED_IN_BASE_WEIGHT + unlocked.length,
    label: highest ? highest.label : "Signed in",
    blurb: next
      ? `${getRewardRequirement(next)} unlocks ${next.label} and another point of vote weight.`
      : "Every theme unlocked. Top voting weight on the board.",
    unlockedCount: unlocked.length,
    signedIn: true,
    isTopTier: !next,
  };
}

export const MAX_VOTE_WEIGHT = SIGNED_IN_BASE_WEIGHT + THEME_REWARDS.length;
