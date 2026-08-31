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

const METRIC_LABELS = {
  setCount: "sets",
  repCount: "reps",
  historyDays: "days",
};

/**
 * Criteria that actually stand between a lifter and a reward. A zero threshold
 * means the metric is not gating this reward at all — Blueprint asks nothing of
 * history so an honest first session earns something on day one — and listing
 * "0 weeks of history" as a hurdle would read as nonsense.
 */
export function getActiveCriteria(reward) {
  return reward.criteria.filter(({ threshold }) => threshold > 0);
}

export function getRewardRequirement(reward) {
  const requirements = getActiveCriteria(reward).map(({ metric, threshold }) => {
    if (metric === "setCount") {
      return threshold === 1 ? "your first set" : `${threshold} sets`;
    }
    if (metric === "repCount") {
      return threshold === 1 ? "your first rep" : `${threshold} reps`;
    }
    if (metric === "historyDays") {
      const weeks = Math.round(threshold / 7);
      return `${weeks} week${weeks === 1 ? "" : "s"} of history`;
    }
    return `${threshold} ${metric}`;
  });

  if (requirements[0] === "your first set") return "Log your first set";
  return joinRequirements(
    requirements,
    reward.unlockMode === "all" ? "and" : "or",
  );
}

/**
 * "12/60 sets", "80/200 reps", "5/14 days" — a lifter's standing against each
 * criterion that still applies, for showing progress towards the next reward.
 * @param {Object} reward
 * @param {Object} metrics - From getTrainingRewardMetrics().
 * @returns {string[]}
 */
export function getRewardProgressParts(reward, metrics) {
  return getActiveCriteria(reward).map(
    ({ metric, threshold }) =>
      `${metrics?.[metric] ?? 0}/${threshold} ${METRIC_LABELS[metric] ?? metric}`,
  );
}

/**
 * The sentence that explains how the criteria combine, or null when there is
 * only one criterion and the rule would be stating the obvious.
 * @param {Object} reward
 * @returns {string|null}
 */
export function getRewardUnlockRule(reward) {
  if (getActiveCriteria(reward).length < 2) return null;
  return reward.unlockMode === "all"
    ? "Reach all of these to unlock it."
    : "Reach any one to unlock it.";
}

function joinRequirements(requirements, conjunction) {
  if (requirements.length === 0) return "";
  if (requirements.length === 1) return requirements[0];
  if (requirements.length === 2) {
    return `${requirements[0]} ${conjunction} ${requirements[1]}`;
  }
  return `${requirements.slice(0, -1).join(", ")}, ${conjunction} ${
    requirements[requirements.length - 1]
  }`;
}

export function getTrainingRewardMetrics(parsedData) {
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

export function isRewardUnlocked(reward, metrics) {
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
