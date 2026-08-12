/**
 * Calculates theme rewards from a lifter's real training history.
 * Theme pairs unlock together so choosing light or dark never changes progress.
 */

export const BASIC_THEMES = ["light", "dark"];

export const THEME_REWARDS = [
  {
    themes: ["neo-brutalism", "neo-brutalism-dark"],
    label: "Neo Brutalism",
    sets: 1,
    reps: 1,
    historyDays: 0,
  },
  {
    themes: ["blueprint", "blueprint-dark"],
    label: "Blueprint",
    sets: 25,
    reps: 100,
    historyDays: 14,
  },
  {
    themes: ["retro-arcade", "retro-arcade-dark"],
    label: "Retro Arcade",
    sets: 75,
    reps: 500,
    historyDays: 42,
  },
  {
    themes: ["starry-night", "starry-night-dark"],
    label: "Starry Night",
    sets: 150,
    reps: 1000,
    historyDays: 84,
  },
];

export function getThemeUnlocks({
  isAuthenticated,
  isDemoMode,
  parsedData,
}) {
  const metrics = getTrainingRewardMetrics(
    isAuthenticated && !isDemoMode ? parsedData : [],
  );
  const unlockedThemes = new Set(BASIC_THEMES);

  if (!isAuthenticated) {
    return { metrics, unlockedThemes, nextReward: THEME_REWARDS[0] };
  }

  THEME_REWARDS.forEach((reward) => {
    if (isRewardUnlocked(reward, metrics)) {
      reward.themes.forEach((theme) => unlockedThemes.add(theme));
    }
  });

  const nextReward = THEME_REWARDS.find(
    (reward) => !reward.themes.every((theme) => unlockedThemes.has(theme)),
  );

  return { metrics, unlockedThemes, nextReward };
}

export function getRewardRequirement(reward) {
  if (reward.sets === 1) return "Log your first set";

  const weeks = Math.round(reward.historyDays / 7);
  return `${reward.sets} sets, ${reward.reps} reps, or ${weeks} weeks of history`;
}

function getTrainingRewardMetrics(parsedData) {
  const completedSets = Array.isArray(parsedData)
    ? parsedData.filter((lift) => !lift?.isGoal)
    : [];

  if (completedSets.length === 0) {
    return { setCount: 0, repCount: 0, historyDays: 0, hasTrainingData: false };
  }

  let firstDate = null;
  let lastDate = null;
  let repCount = 0;

  completedSets.forEach((lift) => {
    repCount += Math.max(0, Number(lift?.reps) || 0);

    const date = lift?.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return;
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
  });

  return {
    setCount: completedSets.length,
    repCount,
    historyDays: getDaysBetween(firstDate, lastDate),
    hasTrainingData: true,
  };
}

function isRewardUnlocked(reward, metrics) {
  if (!metrics.hasTrainingData) return false;

  return (
    metrics.setCount >= reward.sets ||
    metrics.repCount >= reward.reps ||
    metrics.historyDays >= reward.historyDays
  );
}

function getDaysBetween(firstDate, lastDate) {
  if (!firstDate || !lastDate) return 0;

  const first = Date.parse(`${firstDate}T00:00:00Z`);
  const last = Date.parse(`${lastDate}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;

  return Math.max(0, Math.floor((last - first) / 86_400_000));
}
