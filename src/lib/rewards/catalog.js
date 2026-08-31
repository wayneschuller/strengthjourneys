/**
 * Defines the ordered app reward catalog independently from progress logic.
 * Add future cosmetic or celebratory rewards here without changing consumers.
 */

// The ladder shifted up one rung on 2026-09-01: every theme now costs what the
// theme above it used to, and a new top rung was extrapolated from the same
// curve. The old first rung was a single set, which unlocked before anyone had
// trained — a reward that arrives for free is not a reward. Blueprint now takes
// roughly one full session.
//
// Each reward carries three thresholds and unlocks on ANY one of them, so the
// numbers are three routes to the same rung rather than a checklist.
export const THEME_REWARDS = [
  createThemeReward("blueprint", "Blueprint", 10, 50, 7),
  createThemeReward("blueprint-dark", "Blueprint Dark", 25, 100, 14),
  createThemeReward("starry-night", "Starry Night", 45, 250, 28),
  createThemeReward("starry-night-dark", "Starry Night Dark", 75, 500, 42),
  createThemeReward("retro-arcade", "Retro Arcade", 100, 700, 56),
  createThemeReward("retro-arcade-dark", "Retro Arcade Dark", 125, 850, 70),
  createThemeReward("neo-brutalism", "Neo Brutalism", 150, 1000, 84),
  createThemeReward(
    "neo-brutalism-dark",
    "Neo Brutalism Dark",
    175,
    1200,
    98,
  ),
];

export const REWARD_CATALOG = [...THEME_REWARDS];

export function getRewardsByCategory(category) {
  if (!category) return REWARD_CATALOG;
  return REWARD_CATALOG.filter((reward) => reward.category === category);
}

function createThemeReward(theme, label, sets, reps, historyDays) {
  return {
    id: `theme:${theme}`,
    category: "theme",
    value: theme,
    label,
    unlockMode: "any",
    criteria: [
      { metric: "setCount", threshold: sets },
      { metric: "repCount", threshold: reps },
      { metric: "historyDays", threshold: historyDays },
    ],
  };
}
