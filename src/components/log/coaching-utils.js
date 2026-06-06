/**
 * Pure coaching helpers for log-session lift suggestions and guidance copy.
 */

import { getDisplayWeight } from "@/lib/processing-utils";
import { COACHED_LIFTS } from "@/components/log/coached-lifts";

export function isEarlyStrengthJourneyStage(dashboardStage) {
  return (
    dashboardStage === "starter_sample" ||
    dashboardStage === "first_real_week" ||
    dashboardStage === "first_month"
  );
}

function getDaysBetweenDates(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

export function getJourneyTechniqueAssist({
  liftType,
  dashboardStage,
  priorLiftDates = [],
  sessionDate,
}) {
  const match = COACHED_LIFTS.find((item) => item.liftType === liftType);
  if (!match) return null;

  const defaultCues = match.cues ?? [];
  const videoAssist = match.videoUrl
    ? {
        slug: match.slug ?? null,
        videoUrl: match.videoUrl,
        prompt: `Need a quick ${liftType} form check?`,
      }
    : null;
  const mostRecentLiftDate = priorLiftDates.length
    ? priorLiftDates[priorLiftDates.length - 1]
    : null;
  const isLiftReintroduction =
    !!mostRecentLiftDate &&
    !!sessionDate &&
    getDaysBetweenDates(mostRecentLiftDate, sessionDate) > 42;
  const shouldShowFullAssist =
    isEarlyStrengthJourneyStage(dashboardStage) ||
    !mostRecentLiftDate ||
    isLiftReintroduction;
  const cues = shouldShowFullAssist ? defaultCues : [];

  if (!cues.length && !videoAssist) return null;

  return {
    cues,
    videoAssist,
  };
}

export function getFirstTimeEmptyButtons({
  liftType,
  barWeight,
  minIncrement,
  unitType,
}) {
  const lightJumpWeight =
    liftType === "Deadlift"
      ? barWeight + minIncrement * 2
      : barWeight + minIncrement;

  if (liftType === "Deadlift") {
    return [
      {
        label: `5@${barWeight}${unitType}`,
        sublabel: "bar only",
        reps: 5,
        weight: barWeight,
        unitType,
        variant: "primary",
      },
      {
        label: `5@${barWeight + minIncrement}${unitType}`,
        sublabel: "small jump",
        reps: 5,
        weight: barWeight + minIncrement,
        unitType,
        variant: "secondary",
      },
      {
        label: `5@${lightJumpWeight}${unitType}`,
        sublabel: "light starter",
        reps: 5,
        weight: lightJumpWeight,
        unitType,
        variant: "outline",
      },
    ];
  }

  return [
    {
      label: `5@${barWeight}${unitType}`,
      sublabel: "empty bar",
      reps: 5,
      weight: barWeight,
      unitType,
      variant: "primary",
    },
    {
      label: `5@${lightJumpWeight}${unitType}`,
      sublabel: "light starter",
      reps: 5,
      weight: lightJumpWeight,
      unitType,
      variant: "secondary",
    },
    {
      label: `10@${barWeight}${unitType}`,
      sublabel: "more reps",
      reps: 10,
      weight: barWeight,
      unitType,
      variant: "outline",
    },
  ];
}

export function getFirstTimeTargetWeight({
  standards,
  liftType,
  barWeight,
  minIncrement,
}) {
  let physicallyActiveWeight = standards?.[liftType]?.physicallyActive;

  if (!physicallyActiveWeight || physicallyActiveWeight <= 0) {
    const ref = COACHED_LIFTS.find(
      (lift) => lift.liftType === liftType,
    )?.standardsRef;
    if (ref) {
      const base = standards?.[ref.liftType]?.physicallyActive;
      if (base > 0) physicallyActiveWeight = base * ref.ratio;
    }
  }

  if (!physicallyActiveWeight || physicallyActiveWeight <= 0) return null;

  return Math.max(
    barWeight,
    Math.ceil(physicallyActiveWeight / minIncrement) * minIncrement,
  );
}

export function getFirstTimeProgressionButtons({
  progression,
  realSets,
  isMetric,
  unitType,
  minIncrement,
}) {
  if (!progression?.length) return [];

  const loggedSets = realSets.filter((set) => set.weight > 0);
  const loggedWeights = loggedSets.map(
    (set) => getDisplayWeight(set, isMetric).value,
  );
  let nextWarmupIdx = 0;

  if (loggedWeights.length > 0) {
    const maxLogged = Math.max(...loggedWeights);
    nextWarmupIdx = progression.findIndex((set) => set.weight > maxLogged);
    if (nextWarmupIdx === -1) nextWarmupIdx = progression.length;
  }

  const buttons = [];
  const seen = new Set();
  const pushButton = ({ reps, weight, sublabel, variant }) => {
    const key = `${reps}-${weight}`;
    if (seen.has(key)) return;
    seen.add(key);
    buttons.push({
      label: `${reps}@${weight}${unitType}`,
      sublabel,
      reps,
      weight,
      unitType,
      variant,
    });
  };

  if (nextWarmupIdx < progression.length) {
    const nextSet = progression[nextWarmupIdx];
    const followingSet = progression[nextWarmupIdx + 1];
    const topSet = progression[progression.length - 1];

    pushButton({
      reps: nextSet.reps,
      weight: nextSet.weight,
      sublabel: nextSet.isTopSet ? "today's target" : "next warmup",
      variant: "primary",
    });

    if (followingSet && !followingSet.isTopSet) {
      pushButton({
        reps: followingSet.reps,
        weight: followingSet.weight,
        sublabel: "then this",
        variant: "secondary",
      });
    }

    if (!nextSet.isTopSet) {
      pushButton({
        reps: topSet.reps,
        weight: topSet.weight,
        sublabel: "today's target",
        variant: "outline",
      });
    }

    return buttons;
  }

  const lastLoggedSet = loggedSets[loggedSets.length - 1];
  if (!lastLoggedSet) return [];

  const lastLoggedWeight = getDisplayWeight(lastLoggedSet, isMetric).value;
  const lastLoggedReps = lastLoggedSet.reps ?? 5;

  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight,
    sublabel: "repeat",
    variant: "secondary",
  });
  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight + minIncrement,
    sublabel: "small jump",
    variant: "primary",
  });
  pushButton({
    reps: lastLoggedReps,
    weight: lastLoggedWeight + minIncrement * 2,
    sublabel: "if it felt easy",
    variant: "outline",
  });

  return buttons;
}

export function getInSessionCoachingCopy({
  mode,
  dashboardStage,
  liftType,
  hasReachedTarget = false,
  workSetCount = 0,
}) {
  const earlyStage = isEarlyStrengthJourneyStage(dashboardStage);

  if (mode === "firstLiftEmpty") {
    return earlyStage
      ? {
          eyebrow: "First lift",
          title: `First time logging ${liftType}?`,
          body: "Start with an empty bar and work up to a moderate weight.",
          effortCue:
            "Keep the weight easy enough that technique stays clean. You should finish with 2-3 reps left if needed.",
        }
      : {
          eyebrow: "New lift",
          title: `${liftType} starts lighter than you think`,
          body: "Use the first set to find the groove, not to impress the logbook.",
          effortCue: "Add only small jumps while the reps stay crisp.",
        };
  }

  if (mode === "firstLiftInProgress") {
    if (hasReachedTarget) {
      if (liftType === "Deadlift") {
        return {
          eyebrow: null,
          title: null,
          body: "Great, that's your top work set.",
          effortCue:
            "Deadlift usually wants just one heavy set of 5. Stop here, or go a little heavier if that felt too easy.",
        };
      }

      if (workSetCount >= 3) {
        return {
          eyebrow: null,
          title: null,
          body: `You can stop doing ${liftType} now.`,
          effortCue:
            "Feel free to go do some curls in the squat rack or hit your local fast food franchise.",
        };
      }

      if (workSetCount === 2) {
        return {
          eyebrow: null,
          title: null,
          body: "Nice, now just do 1 more set of 5 at this weight.",
          effortCue: "Keep it tidy and call the lift there for today.",
        };
      }

      return {
        eyebrow: null,
        title: null,
        body: "Great, that's your first work set.",
        effortCue: "Now aim for 2 more sets of 5 at this same weight.",
      };
    }

    return {
      eyebrow: null,
      title: null,
      body: "Keep adding weight while the reps stay clean and confident.",
      effortCue: "Stop when it feels heavy, not grindy or impossible.",
    };
  }

  return null;
}

export function getNonBigFourThreeByFiveCoaching(liftType) {
  return {
    eyebrow: null,
    title: null,
    body: `${liftType} usually goes well as 3x5.`,
    effortCue:
      "If these sets felt solid, you've probably done enough for today.",
  };
}
