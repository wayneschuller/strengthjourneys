/**
 * Defines the ordered app reward catalog independently from progress logic.
 * Add future cosmetic or celebratory rewards here without changing consumers.
 */

export const THEME_REWARDS = [
  createThemeReward("blueprint", "Blueprint", 1, 1, 0),
  createThemeReward("blueprint-dark", "Blueprint Dark", 10, 50, 7),
  createThemeReward("starry-night", "Starry Night", 25, 100, 14),
  createThemeReward("starry-night-dark", "Starry Night Dark", 45, 250, 28),
  createThemeReward("retro-arcade", "Retro Arcade", 75, 500, 42),
  createThemeReward("retro-arcade-dark", "Retro Arcade Dark", 100, 700, 56),
  createThemeReward("neo-brutalism", "Neo Brutalism", 125, 850, 70),
  createThemeReward(
    "neo-brutalism-dark",
    "Neo Brutalism Dark",
    150,
    1000,
    84,
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
