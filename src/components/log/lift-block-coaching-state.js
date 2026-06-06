/**
 * Pure coaching-state builder for a lift block.
 * Keeps the large warmup/progression decision tree out of the render component.
 */

import { getDisplayWeight } from "@/lib/processing-utils";
import { generateSessionSets } from "@/lib/warmups";
import { getRankingMeta } from "@/lib/pr-ranking";
import {
  getFirstTimeEmptyButtons,
  getFirstTimeProgressionButtons,
  getFirstTimeTargetWeight,
  getInSessionCoachingCopy,
  getJourneyTechniqueAssist,
  getNonBigFourThreeByFiveCoaching,
} from "@/components/log/coaching-utils";

const HEAVIER_SET_SUBLABELS = [
  "ambitious",
  "send it",
  "for Instagram",
  "spicy one",
  "hero set",
  "big swing",
  "stretch goal",
  "on a heater",
  "bold move",
  "if feeling good",
];

export function getLiftBlockCoachingState({
  dashboardStage,
  isMetric,
  lastRealSet,
  liftType,
  parsedData,
  realSets,
  sessionDate,
  standards,
  storedBarType,
  storedPlatePreference,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
}) {
  if (!parsedData) return null;

  const unitType = isMetric ? "kg" : "lb";
  const barWeight =
    storedBarType === "womens" ? (isMetric ? 15 : 35) : isMetric ? 20 : 45;
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
              sublabel: "repeat",
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

  const lastDate = prior[prior.length - 1].date;
  const lastSets = prior.filter((e) => e.date === lastDate);

  // Find the top set from last session (heaviest weight)
  let topSet = lastSets[0];
  for (const s of lastSets) {
    // Convert to user's current unit for comparison
    const { value } = getDisplayWeight(s, isMetric);
    const { value: topValue } = getDisplayWeight(topSet, isMetric);
    if (value > topValue) topSet = s;
  }

  const { value: lastTopWeight } = getDisplayWeight(topSet, isMetric);
  const topReps = topSet.reps;
  if (!lastTopWeight || lastTopWeight <= 0) return null;

  // Assume progressive overload: target is last session's top + one increment
  const topWeight = lastTopWeight + minIncrement;

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
    if (!reps || !weight || buttons.length >= 3) return;
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
    const previousTopOption =
      lastTopWeight > maxLogged && lastTopWeight < topProgSet.weight
        ? {
            reps: topReps,
            weight: lastTopWeight,
          }
        : null;

    addWarmupButton(nextReplaySet, "last warmup", "primary");

    if (lastLoggedWeight > 0) {
      pushSuggestionButton({
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        sublabel: "repeat",
        variant: "secondary",
      });
    }

    addWarmupButton(
      nextSet,
      getHeavierSetSublabel({
        liftType,
        sessionDate,
        reps: nextSet?.reps,
        weight: nextSet?.weight,
        lastLoggedWeight,
        loggedSetCount: lastLoggedSets.length,
      }),
      "outline",
    );
    addWarmupButton(previousTopOption, "repeat top", "outline");
    addWarmupButton(topProgSet, "top set", "outline");
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
      sublabel: "repeat top",
      variant: "outline",
    });
    pushSuggestionButton({
      reps: topReps,
      weight: topWeight,
      sublabel: "top set",
      variant: "outline",
    });
  } else {
    // Working phase: suggest repeat, a lighter top repeat when useful,
    // push-higher, and drop set.
    pushSuggestionButton({
      reps: lastLoggedReps,
      weight: lastLoggedWeight,
      sublabel: "repeat",
      variant: "secondary",
    });

    if (lastLoggedWeight < topWeight && lastTopWeight > lastLoggedWeight) {
      pushSuggestionButton({
        reps: topReps,
        weight: lastTopWeight,
        sublabel: "repeat top",
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
        sublabel: "top set",
        variant: "outline",
      });
    } else {
      const incrWeight = lastLoggedWeight + minIncrement;
      pushSuggestionButton({
        reps: lastLoggedReps,
        weight: incrWeight,
        sublabel: `+${minIncrement}`,
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
      sublabel: "top set",
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
