/**
 * Pure coaching-state builder for a lift block.
 * Keeps the large warmup/progression decision tree out of the render component.
 */

import { getDisplayWeight } from "@/lib/processing-utils";
import { generateSessionSets } from "@/lib/warmups";
import { getRankingMeta } from "@/lib/pr-ranking";
import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import { getDaysBetweenYmd } from "@/lib/date-utils";
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
  "keep moving",
  "stepping stone",
  "build the fire",
  "one plate closer",
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
const BACK_OFF_SUBLABELS = ["back-off", "volume set", "back-off work"];
const COMEBACK_SUBLABELS = ["welcome back", "ease back in", "comeback set"];

// A gap this long between sessions of a lift starts a staged comeback.
const COMEBACK_GAP_DAYS = 14;
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
export const RECENT_TOP_SET_SESSION_LIMIT = 6;

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
        .filter((e) => e.liftType === liftType && e.date < sessionDate)
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
  // What suggestion telemetry needs to describe the moment, beyond the
  // buttons themselves. See lib/log-suggestion-telemetry.js.
  const firstTimeTelemetryContext = {
    phase: "first-time",
    anchorWeight: firstTimeTargetWeight ?? barWeight,
    minIncrement,
    priorSessionCount: 0,
    previousDate: null,
    previousSets: [],
  };
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
    (e) => e.liftType === liftType && e.date < sessionDate,
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
        telemetryContext: firstTimeTelemetryContext,
      };
    }

    const lastLoggedWeight = lastRealSet
      ? getDisplayWeight(lastRealSet, isMetric).value
      : barWeight;
    const lastLoggedReps = lastRealSet?.reps ?? 5;
    const nextWeight = lastLoggedWeight + minIncrement;
    const secondJumpWeight = lastLoggedWeight + minIncrement * 2;
    const isBarOnlyIntro = lastLoggedWeight <= barWeight && lastLoggedReps >= 8;
    const hasReachedFirstTimeTarget = firstTimeTargetWeight
      ? realSets.some((set) => {
          if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
          return getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight;
        })
      : false;
    const firstTimeWorkSetCount = firstTimeTargetWeight
      ? realSets.filter((set) => {
          if ((set.reps ?? 0) < 5 || (set.weight ?? 0) <= 0) return false;
          return getDisplayWeight(set, isMetric).value >= firstTimeTargetWeight;
        }).length
      : 0;

    return {
      mode: "firstLiftInProgress",
      buttons: firstTimeButtons?.length
        ? firstTimeButtons
        : [
            {
              kind: isBarOnlyIntro ? "first-loaded-set" : "first-small-jump",
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
              kind: "first-repeat",
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
              kind: "first-double-jump",
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
      telemetryContext: firstTimeTelemetryContext,
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
  const orderedLastSets = orderSessionSets(lastSets);
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

  // Assume progressive overload: target is last session's top + one increment,
  // unless the lifter is coming back from a break, when it builds back in
  // stages instead.
  const comeback = getComebackTarget({
    priorLiftDates,
    sessionDate,
    topSetHistory: recentTopSetHistory,
    normalTopWeight: lastTopWeight + minIncrement,
    minIncrement,
  });
  const isComingBack = Boolean(comeback);
  const topWeight = comeback?.weight ?? lastTopWeight + minIncrement;
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

  // The session to replay: the one that set the target top set, so a light
  // day since then does not cut the ramp short. Its sets split at the
  // heaviest one into the ramp up and the back-off sets after it.
  const {
    rampSets: ladderRampSets,
    backOffSets: ladderBackOffSets,
    peakWeight: ladderPeakWeight,
  } = splitSessionAtPeak(
    orderSessionSets(
      prior.filter((e) => e.date === (targetTopSetSummary?.date ?? lastDate)),
    ),
    isMetric,
  );

  // Build a "replay" progression from the ramp of that session. Back-off
  // sets are left out, or last week's 7@112 would come back as a warmup.
  // Warmups replay at the weights the lifter used: replaying the real log
  // showed lifters repeat their ramp and move only the top set, and shifting
  // the upper warmups by an increment missed more often than it helped.
  const seenReplayWeights = new Set();
  const replayProgression = [];
  for (const s of ladderRampSets) {
    const { value: w } = getDisplayWeight(s, isMetric);
    if (w <= 0) continue;
    const replayWeight = w;
    // Deduplicate: only keep the first occurrence at each weight
    if (seenReplayWeights.has(replayWeight)) continue;
    seenReplayWeights.add(replayWeight);
    // The session's own top set becomes today's progressed top.
    const isTop = replayWeight >= Math.min(lastTopWeight, topWeight);
    // In a comeback several old ramp sets can sit above today's top; the
    // ladder ends at the first.
    if (isTop && replayProgression.some((set) => set.isTopSet)) continue;
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
  const nextReplaySet = !replayAtOrPastTop
    ? replayProgression[nextReplayIdx]
    : null;
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

  // Back-off mode: the weight has come down from today's heaviest set once
  // the heavy work is under way. Lifters often stop short of the forecast
  // top, so this cannot wait for the forecast to be reached.
  const reachedHeavyWork = maxLogged >= lastTopWeight * 0.75;
  const inDropSetMode =
    lastLoggedWeight > 0 &&
    lastLoggedWeight < maxLogged &&
    (effectiveAtOrPastTop || reachedHeavyWork);

  // The replayed session's back-offs, in order, as the next one to offer.
  // Each is scaled to today's heaviest set, since back-offs follow the top
  // single, not the calendar.
  const todayBackOffCount = splitSessionAtPeak(realSets, isMetric).backOffSets
    .length;
  const roundToIncrement = (weight) =>
    Math.round(weight / minIncrement) * minIncrement;
  const getTemplateBackOff = (offset = 0) => {
    const template =
      ladderBackOffSets[todayBackOffCount + offset] ??
      (offset === 0 ? ladderBackOffSets.at(-1) : null);
    if (!template || !(ladderPeakWeight > 0) || !(maxLogged > 0)) return null;
    const weight = roundToIncrement(
      (template.weight / ladderPeakWeight) * maxLogged,
    );
    return weight >= barWeight && weight < maxLogged
      ? { reps: template.reps, weight, templateWeight: template.weight }
      : null;
  };

  // Keep both ranking lanes so button badges can use the preferred result while
  // milestone quips can still react specifically to an all-time best.
  const getSuggestionRankingMeta = (reps, weight) =>
    getRankingMeta({
      liftType,
      reps,
      weight,
      isMetric,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    });

  const buttons = [];
  const seenButtonKeys = new Set();

  // `kind` names the rule that proposed the set. Sublabels rotate through
  // playful pools, so suggestion telemetry keys on this instead.
  const pushSuggestionButton = ({ kind, reps, weight, sublabel, variant }) => {
    if (!reps || !weight || buttons.length >= 4) return;
    // A comeback target already lifted past today is no target at all.
    if (kind === "comeback-top" && weight <= maxLogged) return;
    const key = `${reps}-${weight}`;
    if (seenButtonKeys.has(key)) return;
    seenButtonKeys.add(key);
    const rankingMeta = getSuggestionRankingMeta(reps, weight)?.best;
    buttons.push({
      kind,
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
  const getTopSetSublabel = (set, fallback = TOP_SET_SUBLABELS) => {
    const rankingMeta = getSuggestionRankingMeta(set?.reps, set?.weight);

    if (rankingMeta?.lifetime?.rank === 0) return "meet Jesus";

    return getSuggestionSublabel(fallback, "top-set", set);
  };

  const topSetKind = isComingBack
    ? "comeback-top"
    : isRecoveringFromDeload
      ? "trend-target"
      : "top-set";
  const getTargetSublabel = (set) =>
    isComingBack
      ? getSuggestionSublabel(COMEBACK_SUBLABELS, "comeback-top", set)
      : isRecoveringFromDeload
        ? "trend target"
        : getTopSetSublabel(set);

  const pushTemplateBackOff = (offset, variant = "outline") => {
    const backOff = getTemplateBackOff(offset);
    if (!backOff) return;
    pushSuggestionButton({
      kind: offset === 0 ? "back-off" : "back-off-next",
      reps: backOff.reps,
      weight: backOff.weight,
      sublabel: getSuggestionSublabel(BACK_OFF_SUBLABELS, "back-off", backOff),
      variant,
    });
  };

  if (!effectiveAtOrPastTop && !inDropSetMode) {
    // Warmup phase: replay the user's actual previous warmup first, then fill
    // the remaining slots with repeat/heavier/top-set choices.
    const addWarmupButton = (kind, set, sublabel, variant) => {
      if (!set) return;
      pushSuggestionButton({
        kind,
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
    // In a comeback the pre-break top stays one tap away: plenty of lifters
    // walk straight back to it, and replaying old logs showed as much.
    const previousTopOption =
      lastTopWeight > maxLogged &&
      (isComingBack || lastTopWeight < topProgSet.weight)
        ? {
            reps: topReps,
            weight: lastTopWeight,
          }
        : null;
    const stretchTopOption =
      isRecoveringFromDeload && !isComingBack
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
      realSets.length === 0 ? "opening-set" : "next-warmup",
      nextActualWarmupSet,
      realSets.length === 0
        ? "opening set"
        : getSuggestionSublabel(
            [
              "next warmup",
              "heat rising",
              "heart rising",
              "keep moving",
              "stepping stone",
              "build the fire",
              "one plate closer",
            ],
            "next-warmup",
            nextActualWarmupSet,
          ),
      "primary",
    );

    if (lastLoggedWeight > 0) {
      pushSuggestionButton({
        kind: "warmup-repeat",
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

    // Near the top, the session may end here: offer the first back-off so
    // stopping short of the forecast is one tap.
    if (lastLoggedWeight >= lastTopWeight * 0.9) pushTemplateBackOff(0);

    // The step after next on the lifter's own ramp, ahead of the generic
    // warmup generator, which replaying real logs showed is rarely taken.
    const followingReplaySet =
      realSets.length > 0 && nextActualWarmupSet === nextReplaySet
        ? replayProgression[nextReplayIdx + 1]
        : null;
    if (followingReplaySet && !followingReplaySet.isTopSet) {
      addWarmupButton(
        "following-warmup",
        followingReplaySet,
        getHeavierSetSublabel({
          liftType,
          sessionDate,
          reps: followingReplaySet.reps,
          weight: followingReplaySet.weight,
          lastLoggedWeight,
          loggedSetCount: lastLoggedSets.length,
        }),
        "outline",
      );
    }

    if (bridgeWarmupSet) {
      addWarmupButton(
        "bridge-warmup",
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
        nextSet?.isTopSet ? "top-set" : "next-heavier",
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
      "previous-top",
      previousTopOption,
      getSuggestionSublabel(
        ["repeat top", "run it back"],
        "previous-top",
        previousTopOption,
      ),
      "outline",
    );
    addWarmupButton(
      "deload-top",
      lastSessionTopOption,
      "deload top",
      "outline",
    );
    addWarmupButton(
      topSetKind,
      topProgSet,
      getTargetSublabel(topProgSet),
      "outline",
    );
    addWarmupButton(
      "stretch-top",
      stretchTopOption,
      getSuggestionSublabel(
        STRETCH_SET_SUBLABELS,
        "stretch-top",
        stretchTopOption,
      ),
      "outline",
    );
  } else if (inDropSetMode) {
    // Back-off mode: the next back-off from the replayed session leads, then
    // repeating the one just done, then the one after.
    pushTemplateBackOff(0, "primary");
    pushSuggestionButton({
      kind: "drop-repeat",
      reps: lastLoggedReps,
      weight: lastLoggedWeight,
      sublabel: "drop set",
      variant: "secondary",
    });
    pushTemplateBackOff(1);
    pushSuggestionButton({
      kind: "drop-back-up",
      reps: lastLoggedReps,
      weight: maxLogged,
      sublabel: "back up",
      variant: "outline",
    });
    pushSuggestionButton({
      kind: "previous-top",
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
      kind: topSetKind,
      reps: topReps,
      weight: topWeight,
      sublabel: getTargetSublabel({ reps: topReps, weight: topWeight }),
      variant: "outline",
    });
  } else {
    // Working phase: suggest repeat, a lighter top repeat when useful,
    // push-higher, and drop set.
    pushSuggestionButton({
      kind: "working-repeat",
      reps: lastLoggedReps,
      weight: lastLoggedWeight,
      sublabel: getSuggestionSublabel(
        REPEAT_SUBLABELS,
        "working-repeat",
        lastRealSet,
      ),
      variant: "secondary",
    });
    pushTemplateBackOff(0);

    if (
      (isComingBack || lastLoggedWeight < topWeight) &&
      lastTopWeight > lastLoggedWeight
    ) {
      pushSuggestionButton({
        kind: "previous-top",
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
        kind: topSetKind,
        reps: targetTopSet.reps,
        weight: targetTopSet.weight,
        sublabel: getTopSetSublabel(targetTopSet),
        variant: "outline",
      });
    } else {
      const incrWeight = lastLoggedWeight + minIncrement;
      pushSuggestionButton({
        kind: "small-jump",
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
        kind: "drop-set",
        reps: lastLoggedReps,
        weight: dropWeight,
        sublabel: "drop set",
        variant: "outline",
      });
    }

    pushSuggestionButton({
      kind: topSetKind,
      reps: topReps,
      weight: topWeight,
      sublabel: getTargetSublabel({ reps: topReps, weight: topWeight }),
      variant: "outline",
    });
  }

  return {
    mode: "history",
    buttons,
    inSessionCoaching: inSessionFallbackCoaching,
    journeyTechniqueAssist,
    telemetryContext: {
      phase: inDropSetMode
        ? "drop"
        : !effectiveAtOrPastTop
          ? "warmup"
          : "working",
      anchorWeight: lastTopWeight,
      minIncrement,
      priorSessionCount: priorLiftDates.length,
      previousDate: lastDate,
      previousSets: orderedLastSets.map((set) => ({
        reps: set.reps,
        weight: getDisplayWeight(set, isMetric).value,
      })),
    },
  };
}

// Shared with the big four next-up cards, so the weight they propose is the
// one the lift block offers once the athlete starts the lift.
export function getRecentTopSetHistory({ prior, isMetric, limit }) {
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

export function getTargetTopSetSummary({ topSetHistory, minIncrement }) {
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

/**
 * A staged comeback after a break from this lift (illness, holidays, life).
 * The first session back aims below the pre-break top, further below the
 * longer the break; each session after aims a step above the best since the
 * break, until the normal target is back. Returns null when there was no
 * recent break, or the lifter has already built back.
 */
export function getComebackTarget({
  priorLiftDates,
  sessionDate,
  topSetHistory,
  normalTopWeight,
  minIncrement,
}) {
  const dates = [...priorLiftDates, sessionDate];
  // A break is long for this lift: a lift trained every three weeks is not
  // coming back from anything after three weeks.
  const priorTail = priorLiftDates.slice(-8);
  const recentGaps = priorTail
    .slice(1)
    .map((date, i) => getDaysBetweenYmd(priorTail[i], date));
  const usualGap = recentGaps.length
    ? [...recentGaps].sort((a, b) => a - b)[Math.floor(recentGaps.length / 2)]
    : 0;
  const breakGap = Math.max(COMEBACK_GAP_DAYS, usualGap * 2);
  let breakIdx = -1;
  for (let i = dates.length - 1; i > 0; i -= 1) {
    if (getDaysBetweenYmd(dates[i - 1], dates[i]) >= breakGap) {
      breakIdx = i;
      break;
    }
  }
  if (breakIdx === -1) return null;

  const breakStart = dates[breakIdx - 1];
  const comebackStart = dates[breakIdx];
  const before = topSetHistory.filter((entry) => entry.date <= breakStart);
  const since = topSetHistory.filter((entry) => entry.date >= comebackStart);
  // Comebacks are judged against recent history only; a break older than
  // the history window is long since over.
  if (!before.length) return null;

  const preBreakTop = Math.max(...before.map((entry) => entry.weight));
  const gapDays = getDaysBetweenYmd(breakStart, comebackStart);
  const firstBackShare = gapDays >= 56 ? 0.8 : gapDays >= 28 ? 0.85 : 0.9;
  const round = (weight) => Math.round(weight / minIncrement) * minIncrement;
  const stageJump = Math.max(minIncrement, round(preBreakTop * 0.05));
  const bestSince = since.length
    ? Math.max(...since.map((entry) => entry.weight))
    : 0;
  const weight = Math.max(
    round(preBreakTop * firstBackShare),
    bestSince > 0 ? bestSince + stageJump : 0,
  );

  if (weight >= normalTopWeight) return null;
  return { weight, gapDays, sessionsBack: since.length, preBreakTop };
}

function orderSessionSets(sets) {
  return [...sets].sort((a, b) => {
    if (Number.isFinite(a.rowIndex) && Number.isFinite(b.rowIndex)) {
      return a.rowIndex - b.rowIndex;
    }
    return sets.indexOf(a) - sets.indexOf(b);
  });
}

// Splits one session's ordered sets at its heaviest set: everything up to
// and including it is the ramp, lighter sets after it are back-offs.
function splitSessionAtPeak(orderedSets, isMetric) {
  const weighed = orderedSets
    .map((set) => ({ set, weight: getDisplayWeight(set, isMetric).value }))
    .filter(({ set, weight }) => weight > 0 && (set.reps ?? 0) > 0);
  if (!weighed.length) return { rampSets: [], backOffSets: [], peakWeight: 0 };

  const peakWeight = Math.max(...weighed.map(({ weight }) => weight));
  const peakIdx = weighed.findIndex(({ weight }) => weight === peakWeight);
  return {
    rampSets: weighed.slice(0, peakIdx + 1).map(({ set }) => set),
    backOffSets: weighed
      .slice(peakIdx + 1)
      .filter(({ weight }) => weight < peakWeight)
      .map(({ set, weight }) => ({ reps: set.reps, weight })),
    peakWeight,
  };
}

function getBridgeWarmupSet({
  fromWeight,
  targetWeight,
  topReps,
  minIncrement,
}) {
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
