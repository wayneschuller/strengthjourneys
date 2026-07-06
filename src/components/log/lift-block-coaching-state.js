/**
 * Pure coaching-state builder for a lift block.
 * Keeps the large warmup/progression decision tree out of the render component.
 */

import { getDisplayWeight } from "@/lib/processing-utils";
import { generateSessionSets } from "@/lib/warmups";
import { getRankingMeta } from "@/lib/pr-ranking";
import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import {
  getFirstTimeEmptyButtons,
  getFirstTimeProgressionButtons,
  getFirstTimeTargetWeight,
  getInSessionCoachingCopy,
  getJourneyTechniqueAssist,
  getNonBigFourThreeByFiveCoaching,
} from "@/components/log/coaching-utils";

const HEAVIER_SET_SUBLABELS = [
  "next warmup",
  "heat rising",
  "heart rising",
  "ambitious",
  "send it",
  "for Instagram",
  "for the gram",
  "spicy one",
  "hero set",
  "big swing",
  "violence",
  "bad idea",
  "own this",
  "reckless optimism",
  "stretch goal",
  "on a heater",
  "bold move",
  "if feeling good",
];
const BRIDGE_WARMUP_SUBLABELS = ["bridge warmup", "launch ramp"];
const REPEAT_SUBLABELS = ["repeat", "run it back"];
const SMALL_JUMP_SUBLABELS = ["small jump", "polite increase", "nudge upward"];
const STRETCH_SET_SUBLABELS = ["if feeling good", "reckless optimism"];
const TOP_SET_SUBLABELS = [
  "top set",
  "main event",
  "prove it",
  "no hiding",
  "lock in",
  "reckless optimism",
  "danger button",
  "ignition set",
  "PR bait",
  "make it count",
  "send it",
  "violence",
  "bad idea",
  "own this",
  "big swing",
  "for the gram",
];
const RECENT_TOP_SET_SESSION_LIMIT = 6;

export function getLiftBlockCoachingState({
  dashboardStage,
  isMetric,
  lastRealSet,
  liftType,
  parsedData,
  realSets,
  sessionDate,
  sex,
  standards,
  storedBarType,
  storedPlatePreference,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
}) {
  if (!parsedData) return null;

  const unitType = isMetric ? "kg" : "lb";
  const barWeight = getDefaultBarbellWeight({ isMetric, sex, storedBarType });
  const minIncrement = isMetric ? 2.5 : 5;
  const priorLiftDates = Array.from(
    new Set(
      parsedData
        .filter(
          (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
        )
        .map((e) => e.date)
        .filter(Boolean),
    ),
  ).sort();
  const journeyTechniqueAssist = getJourneyTechniqueAssist({
    liftType,
    dashboardStage,
    priorLiftDates,
    sessionDate,
  });
  const completedSetCount = realSets.filter(
    (set) => (set.reps ?? 0) > 0 && (set.weight ?? 0) > 0,
  ).length;
  const inSessionFallbackCoaching =
    !journeyTechniqueAssist && completedSetCount >= 3
      ? getNonBigFourThreeByFiveCoaching(liftType)
      : null;
  const firstTimeTargetWeight = getFirstTimeTargetWeight({
    standards,
    liftType,
    barWeight,
    minIncrement,
  });
  const firstTimeProgression = firstTimeTargetWeight
    ? generateSessionSets(
        firstTimeTargetWeight,
        5,
        barWeight,
        isMetric,
        storedPlatePreference,
      )
    : null;

  // Find last session's sets for this lift (same logic as LiftSuggestions)
  const prior = parsedData.filter(
    (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
  );
  if (!prior.length) {
    const firstTimeButtons = firstTimeProgression
      ? getFirstTimeProgressionButtons({
          progression: firstTimeProgression,
          realSets,
          isMetric,
          unitType,
          minIncrement,
        })
      : null;

    if (realSets.length === 0) {
      return {
        mode: "firstLiftEmpty",
        buttons: firstTimeButtons?.length
          ? firstTimeButtons
          : getFirstTimeEmptyButtons({
              liftType,
              barWeight,
              minIncrement,
              unitType,
            }),
        inSessionCoaching: getInSessionCoachingCopy({
          mode: "firstLiftEmpty",
          dashboardStage,
          liftType,
          minIncrement,
          unitType,
        }),
        journeyTechniqueAssist: journeyTechniqueAssist
          ? {
              ...journeyTechniqueAssist,
              videoAssist: journeyTechniqueAssist.videoAssist
                ? {
                    ...journeyTechniqueAssist.videoAssist,
                    defaultOpen: false,
                  }
                : null,
            }
          : null,
      };
    }

    const lastLoggedWeight = lastRealSet
      ? getDisplayWeight(lastRealSet, isMetric).value
      : barWeight;
    const lastLoggedReps = lastRealSet?.reps ?? 5;
    const nextWeight = lastLoggedWeight + minIncrement;
    const secondJumpWeight = lastLoggedWeight + minIncrement * 2;
    const isBarOnlyIntro =
      lastLoggedWeight <= barWeight && lastLoggedReps >= 8;
    const hasReachedFirstTimeTarget = firstTimeTargetWeight
      ? realSets.some((set) => {
          if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
          return (
            getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight
          );
        })
      : false;
    const firstTimeWorkSetCount = firstTimeTargetWeight
      ? realSets.filter((set) => {
          if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
          return (
            getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight
          );
        }).length
      : 0;

    return {
      mode: "firstLiftInProgress",
      buttons: firstTimeButtons?.length
        ? firstTimeButtons
        : [
            {
              label: `${isBarOnlyIntro ? 5 : lastLoggedReps}@${nextWeight}${unitType}`,
              sublabel: isBarOnlyIntro
                ? "first loaded set"
                : `+${minIncrement}${unitType}`,
              reps: isBarOnlyIntro ? 5 : lastLoggedReps,
              weight: nextWeight,
              unitType,
              variant: "primary",
            },
            {
              label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
              sublabel: getStableSublabel({
                labels: REPEAT_SUBLABELS,
                seed: `${liftType}|${sessionDate}|first-time-repeat|${lastLoggedWeight}`,
              }),
              reps: lastLoggedReps,
              weight: lastLoggedWeight,
              unitType,
              variant: "secondary",
            },
            {
              label: `${lastLoggedReps}@${secondJumpWeight}${unitType}`,
              sublabel: `+${minIncrement * 2}${unitType}`,
              reps: lastLoggedReps,
              weight: secondJumpWeight,
              unitType,
              variant: "outline",
            },
          ],
      inSessionCoaching:
        inSessionFallbackCoaching ??
        getInSessionCoachingCopy({
          mode: "firstLiftInProgress",
          dashboardStage,
          liftType,
          minIncrement,
          unitType,
          hasReachedTarget: hasReachedFirstTimeTarget,
          workSetCount: firstTimeWorkSetCount,
        }),
      journeyTechniqueAssist,
    };
  }

  const recentTopSetHistory = getRecentTopSetHistory({
    prior,
    isMetric,
    limit: RECENT_TOP_SET_SESSION_LIMIT,
  });
  const lastTopSetSummary =
    recentTopSetHistory[recentTopSetHistory.length - 1] ?? null;
  const targetTopSetSummary = getTargetTopSetSummary({
    topSetHistory: recentTopSetHistory,
    minIncrement,
  });
  const lastDate = lastTopSetSummary?.date ?? prior[prior.length - 1].date;
  const lastSets = prior.filter((e) => e.date === lastDate);
  const orderedLastSets = [...lastSets].sort((a, b) => {
    if (Number.isFinite(a.rowIndex) && Number.isFinite(b.rowIndex)) {
      return a.rowIndex - b.rowIndex;
    }

    return lastSets.indexOf(a) - lastSets.indexOf(b);
  });
  const previousOpeningSet = orderedLastSets.find((set) => {
    const { value } = getDisplayWeight(set, isMetric);
    return value > 0 && (set.reps ?? 0) > 0;
  });

  // Anchor top-set planning to the recent trend. A single deload session should
  // not erase several prior sessions of steady top-set progression.
  const topSet = targetTopSetSummary?.set ?? lastSets[0];

  const { value: lastTopWeight } = getDisplayWeight(topSet, isMetric);
  const topReps = topSet.reps;
  if (!lastTopWeight || lastTopWeight <= 0) return null;

  // Assume progressive overload: target is last session's top + one increment
  const topWeight = lastTopWeight + minIncrement;
  const lastSessionTopWeight = lastTopSetSummary?.weight ?? lastTopWeight;
  const lastSessionTopReps = lastTopSetSummary?.reps ?? topReps;
  const isRecoveringFromDeload =
    targetTopSetSummary?.date &&
    lastTopSetSummary?.date &&
    targetTopSetSummary.date !== lastTopSetSummary.date;

  // Generate the full warmup progression using shared algorithm
  const progression = generateSessionSets(
    topWeight,
    topReps,
    barWeight,
    isMetric,
    storedPlatePreference,
  );

  // Build a "replay" progression from the user's actual last session sets.
  // Lower warmups (below 80% of last top) stay at the same weight.
  // Upper warmups (at or above 80%) shift by the increment delta.
  const incrementDelta = topWeight - lastTopWeight; // usually minIncrement
  const upperThreshold = lastTopWeight * 0.8;
  const seenReplayWeights = new Set();
  const replayProgression = [];
  for (const s of lastSets) {
    const { value: w } = getDisplayWeight(s, isMetric);
    if (w <= 0) continue;
    const isUpper = w >= upperThreshold;
    const replayWeight = isUpper
      ? Math.round((w + incrementDelta) / minIncrement) * minIncrement
      : w;
    // Deduplicate: only keep the first occurrence at each weight
    if (seenReplayWeights.has(replayWeight)) continue;
    seenReplayWeights.add(replayWeight);
    const isTop = replayWeight >= topWeight;
    replayProgression.push({
      weight: isTop ? topWeight : replayWeight,
      reps: isTop ? topReps : s.reps,
      isTopSet: isTop,
    });
  }
  // Sort ascending and ensure the top set is last
  replayProgression.sort((a, b) => a.weight - b.weight);

  // Determine where the lifter is based on already-logged sets
  const loggedWeights = realSets
    .filter((s) => s.weight > 0)
    .map((s) => {
      const { value } = getDisplayWeight(s, isMetric);
      return value;
    });

  // Find the next warmup set they haven't done yet (algorithmic)
  let nextWarmupIdx = 0;
  if (loggedWeights.length > 0) {
    const maxLogged = Math.max(...loggedWeights);
    nextWarmupIdx = progression.findIndex((s) => s.weight > maxLogged);
    if (nextWarmupIdx === -1) nextWarmupIdx = progression.length;
  }

  // Find the next replay set they haven't done yet
  let nextReplayIdx = 0;
  if (loggedWeights.length > 0) {
    const maxLogged = Math.max(...loggedWeights);
    nextReplayIdx = replayProgression.findIndex((s) => s.weight > maxLogged);
    if (nextReplayIdx === -1) nextReplayIdx = replayProgression.length;
  }

  const atOrPastTop = nextWarmupIdx >= progression.length;
  const replayAtOrPastTop = nextReplayIdx >= replayProgression.length;
  const maxLogged = loggedWeights.length > 0 ? Math.max(...loggedWeights) : 0;
  const lastLoggedSets = realSets.filter((s) => s.weight > 0);
  const lastLoggedWeight =
    lastLoggedSets.length > 0
      ? getDisplayWeight(lastLoggedSets[lastLoggedSets.length - 1], isMetric)
          .value
      : 0;
  const lastLoggedReps =
    lastLoggedSets[lastLoggedSets.length - 1]?.reps ?? topReps;
  const nextSet = !atOrPastTop ? progression[nextWarmupIdx] : null;
  const nextReplaySet =
    !replayAtOrPastTop ? replayProgression[nextReplayIdx] : null;
  const nextActualWarmupSet =
    realSets.length === 0 && previousOpeningSet
      ? {
          reps: previousOpeningSet.reps,
          weight: getDisplayWeight(previousOpeningSet, isMetric).value,
          isTopSet: false,
        }
      : nextReplaySet;
  const nearMissTopGapRatio =
    nextSet?.isTopSet && nextSet.weight > 0 && lastLoggedWeight > 0
      ? (nextSet.weight - lastLoggedWeight) / nextSet.weight
      : null;
  // If the user logs within 5% under the forecasted top, treat it as
  // them picking a different (slightly lighter) top set rather than a
  // missed warmup — we'll surface a "repeat" suggestion at their chosen
  // weight and keep the original forecast as a push-higher alternative.
  const treatNearMissAsTopSet =
    nextSet?.isTopSet &&
    lastLoggedWeight < nextSet.weight &&
    nearMissTopGapRatio !== null &&
    nearMissTopGapRatio > 0 &&
    nearMissTopGapRatio <= 0.05;
  // Past top if a near-miss top set was logged, or both tracks are exhausted.
  const effectiveAtOrPastTop =
    treatNearMissAsTopSet || (atOrPastTop && replayAtOrPastTop);

  // Detect drop set mode: last logged weight is below the session's peak
  const inDropSetMode = effectiveAtOrPastTop && lastLoggedWeight < maxLogged;

  // Helper: check if a suggested set would be a PR (use best/default pick)
  const getSuggestionRankingMeta = (reps, weight) => {
    const meta = getRankingMeta({
      liftType,
      reps,
      weight,
      isMetric,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    });
    return meta?.best ?? null;
  };

  const buttons = [];
  const seenButtonKeys = new Set();

  const pushSuggestionButton = ({
    reps,
    weight,
    sublabel,
    variant,
  }) => {
    if (!reps || !weight || buttons.length >= 4) return;
    const key = `${reps}-${weight}`;
    if (seenButtonKeys.has(key)) return;
    seenButtonKeys.add(key);
    const rankingMeta = getSuggestionRankingMeta(reps, weight);
    buttons.push({
      label: `${reps}@${weight}${unitType}`,
      sublabel,
      rankingMessage: rankingMeta?.message ?? null,
      rankingScope: rankingMeta?.scope ?? null,
      reps,
      weight,
      unitType,
      variant,
    });
  };
  const getSuggestionSublabel = (labels, scope, set = {}) =>
    getStableSublabel({
      labels,
      seed: [
        liftType,
        sessionDate,
        scope,
        set?.reps,
        set?.weight,
        lastLoggedWeight,
        lastLoggedSets.length,
      ].join("|"),
    });
  const getTopSetSublabel = (set, fallback = TOP_SET_SUBLABELS) =>
    getSuggestionSublabel(fallback, "top-set", set);

  if (!effectiveAtOrPastTop) {
    // Warmup phase: replay the user's actual previous warmup first, then fill
    // the remaining slots with repeat/heavier/top-set choices.
    const addWarmupButton = (set, sublabel, variant) => {
      if (!set) return;
      pushSuggestionButton({
        reps: set.reps,
        weight: set.weight,
        sublabel,
        variant: set.isTopSet ? "primary" : variant,
      });
    };

    const topProgSet = progression[progression.length - 1];
    const lastSessionTopOption =
      isRecoveringFromDeload &&
      lastSessionTopWeight > maxLogged &&
      lastSessionTopWeight < topProgSet.weight
        ? {
            reps: lastSessionTopReps,
            weight: lastSessionTopWeight,
          }
        : null;
    const previousTopOption =
      lastTopWeight > maxLogged && lastTopWeight < topProgSet.weight
        ? {
            reps: topReps,
            weight: lastTopWeight,
          }
        : null;
    const stretchTopOption = isRecoveringFromDeload
      ? {
          reps: topReps,
          weight: topWeight + minIncrement,
        }
      : null;
    const bridgeWarmupSet =
      nextSet?.isTopSet && lastLoggedWeight > 0
        ? getBridgeWarmupSet({
            fromWeight: lastLoggedWeight,
            targetWeight: nextSet.weight,
            topReps,
            minIncrement,
          })
        : null;

    addWarmupButton(
      nextActualWarmupSet,
      realSets.length === 0
        ? "opening set"
        : getSuggestionSublabel(
            ["next warmup", "heat rising", "heart rising"],
            "next-warmup",
            nextActualWarmupSet,
          ),
      "primary",
    );

    if (lastLoggedWeight > 0) {
      pushSuggestionButton({
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        sublabel: getSuggestionSublabel(
          REPEAT_SUBLABELS,
          "warmup-repeat",
          lastRealSet,
        ),
        variant: "secondary",
      });
    }

    if (bridgeWarmupSet) {
      addWarmupButton(
        bridgeWarmupSet,
        getSuggestionSublabel(
          BRIDGE_WARMUP_SUBLABELS,
          "bridge-warmup",
          bridgeWarmupSet,
        ),
        "primary",
      );
    } else {
      addWarmupButton(
        nextSet,
        nextSet?.isTopSet
          ? getTopSetSublabel(nextSet)
          : getHeavierSetSublabel({
              liftType,
              sessionDate,
              reps: nextSet?.reps,
              weight: nextSet?.weight,
              lastLoggedWeight,
              loggedSetCount: lastLoggedSets.length,
            }),
        "outline",
      );
    }
    addWarmupButton(
      previousTopOption,
      getSuggestionSublabel(
        ["repeat top", "run it back"],
        "previous-top",
        previousTopOption,
      ),
      "outline",
    );
    addWarmupButton(lastSessionTopOption, "deload top", "outline");
    addWarmupButton(
      topProgSet,
      isRecoveringFromDeload ? "trend target" : getTopSetSublabel(topProgSet),
      "outline",
    );
    addWarmupButton(
      stretchTopOption,
      getSuggestionSublabel(
        STRETCH_SET_SUBLABELS,
        "stretch-top",
        stretchTopOption,
      ),
      "outline",
    );
  } else if (inDropSetMode) {
    // Drop set mode: weight is descending — only offer repeat at current drop weight
    pushSuggestionButton({
      reps: lastLoggedReps,
      weight: lastLoggedWeight,
      sublabel: "drop set",
      variant: "secondary",
    });
    pushSuggestionButton({
      reps: lastLoggedReps,
      weight: maxLogged,
      sublabel: "back up",
      variant: "outline",
    });
    pushSuggestionButton({
      reps: topReps,
      weight: lastTopWeight,
      sublabel: getSuggestionSublabel(
        ["repeat top", "run it back"],
        "drop-repeat-top",
        { reps: topReps, weight: lastTopWeight },
      ),
      variant: "outline",
    });
    pushSuggestionButton({
      reps: topReps,
      weight: topWeight,
      sublabel: isRecoveringFromDeload
        ? "trend target"
        : getTopSetSublabel({ reps: topReps, weight: topWeight }),
      variant: "outline",
    });
  } else {
    // Working phase: suggest repeat, a lighter top repeat when useful,
    // push-higher, and drop set.
    pushSuggestionButton({
      reps: lastLoggedReps,
      weight: lastLoggedWeight,
      sublabel: getSuggestionSublabel(
        REPEAT_SUBLABELS,
        "working-repeat",
        lastRealSet,
      ),
      variant: "secondary",
    });

    if (lastLoggedWeight < topWeight && lastTopWeight > lastLoggedWeight) {
      pushSuggestionButton({
        reps: topReps,
        weight: lastTopWeight,
        sublabel: getSuggestionSublabel(
          ["repeat top", "run it back"],
          "working-repeat-top",
          { reps: topReps, weight: lastTopWeight },
        ),
        variant: "outline",
      });
    }

    const targetTopSet = treatNearMissAsTopSet
      ? progression[progression.length - 1]
      : null;
    if (targetTopSet && targetTopSet.weight > lastLoggedWeight) {
      pushSuggestionButton({
        reps: targetTopSet.reps,
        weight: targetTopSet.weight,
        sublabel: getTopSetSublabel(targetTopSet),
        variant: "outline",
      });
    } else {
      const incrWeight = lastLoggedWeight + minIncrement;
      pushSuggestionButton({
        reps: lastLoggedReps,
        weight: incrWeight,
        sublabel: getSuggestionSublabel(
          [`+${minIncrement}`, ...SMALL_JUMP_SUBLABELS],
          "working-small-jump",
          { reps: lastLoggedReps, weight: incrWeight },
        ),
        variant: "outline",
      });
    }

    // Drop set: ~80% of current weight, rounded to nearest increment
    const dropWeight =
      Math.round((lastLoggedWeight * 0.8) / minIncrement) * minIncrement;
    if (dropWeight >= barWeight && dropWeight < lastLoggedWeight) {
      pushSuggestionButton({
        reps: lastLoggedReps,
        weight: dropWeight,
        sublabel: "drop set",
        variant: "outline",
      });
    }

    pushSuggestionButton({
      reps: topReps,
      weight: topWeight,
      sublabel: isRecoveringFromDeload
        ? "trend target"
        : getTopSetSublabel({ reps: topReps, weight: topWeight }),
      variant: "outline",
    });
  }

  return {
    mode: "history",
    buttons,
    inSessionCoaching: inSessionFallbackCoaching,
    journeyTechniqueAssist,
  };
}

function getRecentTopSetHistory({ prior, isMetric, limit }) {
  const dateOrder = [];
  const setsByDate = new Map();

  for (const set of prior) {
    if (!set?.date) continue;
    if (!setsByDate.has(set.date)) {
      setsByDate.set(set.date, []);
      dateOrder.push(set.date);
    }
    setsByDate.get(set.date).push(set);
  }

  return dateOrder
    .sort()
    .slice(-limit)
    .map((date) => {
      const sets = setsByDate.get(date) ?? [];
      const topSet = sets.reduce((best, set) => {
        if (!best) return set;
        const { value } = getDisplayWeight(set, isMetric);
        const { value: bestValue } = getDisplayWeight(best, isMetric);
        return value > bestValue ? set : best;
      }, null);

      if (!topSet) return null;

      return {
        date,
        set: topSet,
        reps: topSet.reps,
        weight: getDisplayWeight(topSet, isMetric).value,
      };
    })
    .filter((entry) => entry?.weight > 0 && entry?.reps > 0);
}

function getTargetTopSetSummary({ topSetHistory, minIncrement }) {
  if (!topSetHistory.length) return null;

  const latest = topSetHistory[topSetHistory.length - 1];
  const earlier = topSetHistory.slice(0, -1);
  if (earlier.length < 2) return latest;

  const strongestEarlier = earlier.reduce((best, entry) =>
    entry.weight > best.weight ? entry : best,
  );
  const meaningfulDrop = Math.max(
    minIncrement * 2,
    strongestEarlier.weight * 0.05,
  );

  if (latest.weight <= strongestEarlier.weight - meaningfulDrop) {
    return strongestEarlier;
  }

  return latest;
}

function getBridgeWarmupSet({ fromWeight, targetWeight, topReps, minIncrement }) {
  const gap = targetWeight - fromWeight;
  const bridgeThreshold = minIncrement * 4;
  if (gap < bridgeThreshold) return null;

  const rawBridgeWeight = fromWeight + gap * 0.55;
  const bridgeWeight =
    Math.round(rawBridgeWeight / minIncrement) * minIncrement;

  if (
    bridgeWeight <= fromWeight + minIncrement ||
    bridgeWeight >= targetWeight - minIncrement
  ) {
    return null;
  }

  return {
    reps: topReps <= 3 ? 1 : 3,
    weight: bridgeWeight,
    isTopSet: false,
  };
}

function getHeavierSetSublabel({
  liftType,
  sessionDate,
  reps,
  weight,
  lastLoggedWeight,
  loggedSetCount,
}) {
  if (!weight || !lastLoggedWeight || weight <= lastLoggedWeight) {
    return "next warmup";
  }

  const seed = [
    liftType,
    sessionDate,
    reps,
    weight,
    lastLoggedWeight,
    loggedSetCount,
  ].join("|");

  return HEAVIER_SET_SUBLABELS[
    getStableIndex(seed, HEAVIER_SET_SUBLABELS.length)
  ];
}

function getStableIndex(seed, length) {
  if (!length) return 0;

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % length;
  }

  return hash;
}

function getStableSublabel({ labels, seed }) {
  if (!labels?.length) return "";

  return labels[getStableIndex(seed, labels.length)];
}
