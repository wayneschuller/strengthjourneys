/**
 * Derives reward progress from a lifter's completed training history.
 * Reward definitions supply metric criteria, keeping this engine feature-agnostic.
 */

export function getRewardProgress({
  isAuthenticated,
  isDemoMode,
  parsedData,
  rewards,
}) {
  const metrics = getTrainingRewardMetrics(
    isAuthenticated && !isDemoMode ? parsedData : [],
  );
  const unlockedRewardIds = new Set();

  if (isAuthenticated) {
    rewards.forEach((reward) => {
      if (isRewardUnlocked(reward, metrics)) {
        unlockedRewardIds.add(reward.id);
      }
    });
  }

  const nextReward = rewards.find(
    (reward) => !unlockedRewardIds.has(reward.id),
  );

  return { metrics, unlockedRewardIds, nextReward };
}

export function getRewardRequirement(reward) {
  const requirements = reward.criteria.map(({ metric, threshold }) => {
    if (metric === "setCount") {
      return threshold === 1 ? "your first set" : `${threshold} sets`;
    }
    if (metric === "repCount") {
      return threshold === 1 ? "your first rep" : `${threshold} reps`;
    }
    if (metric === "historyDays") {
      return `${Math.round(threshold / 7)} weeks of history`;
    }
    return `${threshold} ${metric}`;
  });

  if (requirements[0] === "your first set") return "Log your first set";
  return requirements.join(", ").replace(/, ([^,]*)$/, ", or $1");
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

  const criteriaMatch = reward.criteria.some(
    ({ metric, threshold }) => metrics[metric] >= threshold,
  );

  return reward.unlockMode === "all"
    ? reward.criteria.every(
        ({ metric, threshold }) => metrics[metric] >= threshold,
      )
    : criteriaMatch;
}

function getDaysBetween(firstDate, lastDate) {
  if (!firstDate || !lastDate) return 0;

  const first = Date.parse(`${firstDate}T00:00:00Z`);
  const last = Date.parse(`${lastDate}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;

  return Math.max(0, Math.floor((last - first) / 86_400_000));
}
