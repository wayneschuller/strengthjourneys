// Which themes a lifter is allowed to wear.
//
// Every surface that offers a theme has to agree on this, or a picker hands out
// a theme the app then quietly takes back: ThemeChooser demotes an unearned
// theme to light on the next load, so a second picker that ignores the reward
// catalog does not really grant anything — it just confuses people. Both the
// nav-bar chooser and the year recap's customise panel read the set from here.

import { getRewardRequirement } from "@/lib/rewards/progression";

// Always available, to everyone, signed in or not.
export const BASIC_THEMES = ["light", "dark"];

/**
 * The theme values this lifter may select.
 * @param {Array} rewards - Theme rewards from useRewardProgress("theme").
 * @param {Set<string>} unlockedRewardIds - Reward ids the lifter has earned.
 * @returns {Set<string>} Theme values, including the always-available basics.
 */
export function getUnlockedThemes(rewards, unlockedRewardIds) {
  const unlocked = new Set(BASIC_THEMES);
  (rewards || []).forEach((reward) => {
    if (unlockedRewardIds?.has(reward.id)) unlocked.add(reward.value);
  });
  return unlocked;
}

/**
 * Whether a theme should be shown as locked.
 *
 * While reward progress is still loading we do not know the answer yet, so the
 * currently-active theme gets the benefit of the doubt rather than flashing a
 * padlock on a theme the lifter has already earned. Everything else stays
 * locked until proven unlocked.
 *
 * @param {string} theme - Theme value being rendered.
 * @param {Object} params
 * @param {Set<string>} params.unlockedThemes - From getUnlockedThemes().
 * @param {boolean} params.isProgressLoading - From useRewardProgress().
 * @param {string} [params.activeTheme] - The theme currently applied.
 * @returns {boolean}
 */
export function isThemeLocked(
  theme,
  { unlockedThemes, isProgressLoading, activeTheme },
) {
  if (unlockedThemes.has(theme)) return false;
  return !(isProgressLoading && theme === activeTheme);
}

/**
 * One-line explanation of how to earn a theme, e.g. "10 sets, 50 reps, or 1
 * week of history". Returns null for themes with no reward behind them.
 * @param {string} theme - Theme value.
 * @param {Array} rewards - Theme rewards from useRewardProgress("theme").
 * @returns {string|null}
 */
export function getThemeUnlockRequirement(theme, rewards) {
  const reward = (rewards || []).find((candidate) => candidate.value === theme);
  return reward ? getRewardRequirement(reward) : null;
}

/**
 * Full sentence explaining how to earn a theme, ready to drop into a tooltip.
 * getRewardRequirement() returns an instruction for the very first reward
 * ("Log your first set") and a list of thresholds for every one after it, so
 * the two need different sentences around them.
 * @param {string} theme - Theme value.
 * @param {Array} rewards - Theme rewards from useRewardProgress("theme").
 * @returns {string|null}
 */
export function getThemeUnlockSentence(theme, rewards) {
  const requirement = getThemeUnlockRequirement(theme, rewards);
  if (!requirement) return null;
  return /^Log /.test(requirement)
    ? `${requirement} to unlock it.`
    : `Unlocks at ${requirement}.`;
}
