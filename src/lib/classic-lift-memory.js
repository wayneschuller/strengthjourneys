import { differenceInCalendarYears, format, parseISO } from "date-fns";

import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog, logTiming } from "@/lib/processing-utils";

export const BIG_FOUR_LIFTS = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Strict Press",
];

const BIG_FOUR_INSIGHT_PATHS = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const STRENGTH_RATING_SCORE = {
  "Physically Active": 1,
  Beginner: 2,
  Intermediate: 3,
  Advanced: 4,
  Elite: 5,
};

const CLASSIC_LIFT_NOTE_KEYWORDS = {
  meet: [
    "competition",
    "comp",
    "meet",
    "powerlifting meet",
    "powerlifting",
    "platform",
    "weigh in",
    "weigh-in",
    "opener",
    "second attempt",
    "third attempt",
    "1st attempt",
    "2nd attempt",
    "3rd attempt",
    "white lights",
    "judges",
    "usapl",
    "uspa",
    "apl",
    "attempt",
  ],
  positive: [
    "amazing",
    "awesome",
    "great",
    "felt great",
    "happy",
    "stoked",
    "pumped",
    "wow",
    "best",
    "huge",
    "nailed",
    "smoked",
    "easy",
    "flew",
    "crushed",
    "money",
    "dialed",
    "solid",
    "strong",
    "excellent",
  ],
  battle: [
    "hurt",
    "pain",
    "tweaked",
    "missed",
    "failed",
    "awful",
    "bad",
    "sloppy",
    "ugly",
  ],
};

const CLASSIC_LIFT_NOTE_FAST_HINTS = [
  "meet",
  "comp",
  "platform",
  "attempt",
  "opener",
  "usapl",
  "uspa",
  "amazing",
  "awesome",
  "great",
  "happy",
  "stoked",
  "pumped",
  "wow",
  "nailed",
  "smoked",
  "easy",
  "flew",
  "crushed",
  "money",
  "solid",
  "hurt",
  "pain",
  "tweak",
  "missed",
  "failed",
  "ugly",
  "sloppy",
];

export function getBigFourPrSectionHref(liftType) {
  const basePath = BIG_FOUR_INSIGHT_PATHS[liftType];
  return basePath ? `${basePath}#lift-prs` : null;
}

/**
 * Pure orchestration for the Classic Lift engine.
 * Builds candidates, curates a pool, and returns data the UI can use to select/cache a pick.
 */
export function buildClassicLiftMemoryPoolData({
  parsedData,
  liftTypes,
  topLiftsByTypeAndReps,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!topLiftsByTypeAndReps) {
    return {
      selectionPool: [],
      fallbackMemory: null,
      fingerprint: "classic-lift:none",
    };
  }

  const firstParsedDate = parsedData?.[0]?.date ?? null;
  const lastParsedDate =
    parsedData && parsedData.length > 0
      ? parsedData[parsedData.length - 1]?.date ?? null
      : null;

  const trainingYears =
    firstParsedDate != null
      ? Math.max(0, differenceInCalendarYears(new Date(), parseISO(firstParsedDate)))
      : 0;

  const candidates = buildClassicLiftCandidates({
    topLiftsByTypeAndReps,
    liftTypes,
    parsedData,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });

  if (candidates.length === 0) {
    const fallbackPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);
    return {
      selectionPool: [],
      fallbackMemory: fallbackPR
        ? {
            lift: fallbackPR,
            reasonLabel: "Recent PR single",
            strengthRating: getLiftStrengthRating({
              lift: fallbackPR,
              hasBioData,
              age,
              bodyWeight,
              sex,
              isMetric,
            }),
            score: 0,
          }
        : null,
      fingerprint: [
        firstParsedDate ?? "none",
        lastParsedDate ?? "none",
        parsedData?.length ?? 0,
        0,
      ].join("|"),
    };
  }

  const targetPoolSize = getClassicLiftPoolTargetSize(trainingYears, candidates.length);
  const selectionPool = buildClassicLiftSelectionPool(candidates, {
    trainingYears,
    targetPoolSize,
  });

  devLog(
    "Classic lift pool size:",
    selectionPool.length,
    "target:",
    targetPoolSize,
    "candidateCount:",
    candidates.length,
    "pool:",
    selectionPool.map((candidate) => ({
      liftType: candidate.lift?.liftType,
      reps: candidate.lift?.reps,
      weight: candidate.lift?.weight,
      unitType: candidate.lift?.unitType ?? "lb",
      date: candidate.lift?.date,
      reason: candidate.reasonLabel,
      candidateKind: candidate.candidateKind,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      strengthRating: candidate.strengthRating ?? null,
      noteTags: candidate.noteSignals?.tags ?? [],
      anniversaryDaysAway: candidate.anniversaryDaysAway ?? null,
      hasUrl: !!(candidate.lift?.URL || candidate.lift?.url),
      frequentLiftType: candidate.frequentLiftType ?? null,
      frequentLiftSlot: candidate.frequentLiftSlot ?? null,
    })),
  );

  return {
    selectionPool,
    fallbackMemory: null,
    fingerprint: [
      firstParsedDate ?? "none",
      lastParsedDate ?? "none",
      parsedData?.length ?? 0,
      selectionPool.length,
    ].join("|"),
  };
}

/**
 * Builds the raw candidate list before pool curation.
 *
 * Candidate sources:
 * - Big Four top singles + standout rep PRs (core classic lane)
 * - Frequent non-Big-Four PRs (importance lane)
 * - Note-driven non-Big-Four story lifts (memory lane)
 */
function buildClassicLiftCandidates({
  topLiftsByTypeAndReps,
  liftTypes,
  parsedData,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const candidates = [];
  const liftFrequencyMap = new Map(
    (liftTypes ?? []).map((lift) => [lift.liftType, lift.totalSets ?? 0]),
  );

  BIG_FOUR_LIFTS.forEach((liftType) => {
    const repRanges = topLiftsByTypeAndReps[liftType];
    if (!repRanges) return;

    const topSinglesDepth =
      trainingYears >= 10 ? 10 : trainingYears >= 5 ? 7 : trainingYears >= 3 ? 5 : 3;
    const standoutRepDepth =
      trainingYears >= 10 ? 4 : trainingYears >= 5 ? 3 : trainingYears >= 3 ? 2 : 1;

    const topSingles = takeTopUniqueWeightEntries(repRanges[0] ?? [], topSinglesDepth);
    topSingles.forEach((lift, index) => {
      const strengthRating = getLiftStrengthRating({
        lift,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift,
        candidateKind: "single",
        rankIndex: index,
        trainingYears,
        strengthRating,
        liftFrequency: liftFrequencyMap.get(liftType) ?? 0,
      });

      candidates.push({
        id: buildLiftCandidateId(lift, `single-${index + 1}`),
        lift,
        score: score.total,
        scoreBreakdown: score.breakdown,
        strengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "single",
        reasonLabel: `Top ${index + 1} single`,
      });
    });

    for (let repsIndex = 1; repsIndex < 10; repsIndex++) {
      const reps = repsIndex + 1;
      const topRepEntries = takeTopUniqueWeightEntries(
        repRanges[repsIndex] ?? [],
        standoutRepDepth,
      );
      if (topRepEntries.length === 0) continue;

      topRepEntries.forEach((topAtReps, repRankIndex) => {
        const estimatedE1RM = estimateE1RM(reps, topAtReps.weight, "Brzycki");
        const strengthRating = getLiftStrengthRating({
          lift: topAtReps,
          oneRepMaxOverride: estimatedE1RM,
          hasBioData,
          age,
          bodyWeight,
          sex,
          isMetric,
        });

        const ratingScore = STRENGTH_RATING_SCORE[strengthRating] ?? 0;
        const qualifiesStandoutRep =
          hasBioData
            ? ratingScore >= (trainingYears >= 3 ? 4 : 3)
            : reps <= 5;

        if (!qualifiesStandoutRep) return;

        const score = scoreClassicLiftCandidate({
          lift: topAtReps,
          candidateKind: "standoutRep",
          rankIndex: repRankIndex,
          trainingYears,
          strengthRating,
          liftFrequency: liftFrequencyMap.get(liftType) ?? 0,
        });

        candidates.push({
          id: buildLiftCandidateId(topAtReps, `rep-${reps}-${repRankIndex + 1}`),
          lift: topAtReps,
          score: score.total,
          scoreBreakdown: score.breakdown,
          strengthRating,
          noteSignals: score.noteSignals,
          anniversaryDaysAway: score.anniversaryDaysAway,
          candidateKind: "standoutRep",
          reasonLabel:
            repRankIndex === 0
              ? `Standout ${reps}RM`
              : `Standout ${reps}RM #${repRankIndex + 1}`,
        });
      });
    }
  });

  if (trainingYears < 3) {
    const recentPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);
    if (recentPR) {
      const strengthRating = getLiftStrengthRating({
        lift: recentPR,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      candidates.push({
        id: buildLiftCandidateId(recentPR, "recent-pr"),
        lift: recentPR,
        score:
          scoreClassicLiftCandidate({
            lift: recentPR,
            candidateKind: "single",
            rankIndex: 0,
            trainingYears,
            strengthRating,
            liftFrequency: liftFrequencyMap.get(recentPR.liftType) ?? 0,
          }).total + 8,
        strengthRating,
        candidateKind: "single",
        reasonLabel: "Recent PR single",
      });
    }
  }

  const frequentLaneStart = performance.now();
  const frequentNonBigFourCandidates = buildFrequentNonBigFourClassicCandidates({
    topLiftsByTypeAndReps,
    liftTypes,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    logTiming(
      "Classic Lift Frequent Lane",
      performance.now() - frequentLaneStart,
      `${frequentNonBigFourCandidates.length} candidates`,
    );
  }

  const storyLaneTimingStart = performance.now();
  const nonBigFourStoryCandidates = buildNonBigFourStoryCandidates({
    parsedData,
    liftTypes,
    trainingYears,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    logTiming(
      "Classic Lift Story Lane",
      performance.now() - storyLaneTimingStart,
      `${nonBigFourStoryCandidates.length} candidates`,
    );
  }

  return dedupeClassicLiftCandidates([
    ...candidates,
    ...frequentNonBigFourCandidates,
    ...nonBigFourStoryCandidates,
  ]);
}

/**
 * Computes an age-adjusted strength rating for a historical lift.
 */
function getLiftStrengthRating({
  lift,
  oneRepMaxOverride,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!hasBioData || !lift) return null;

  const standardForLift = getStandardForLiftDate(
    age,
    lift.date,
    bodyWeight,
    sex,
    lift.liftType,
    isMetric,
  );

  if (!standardForLift) return null;

  const unitForStandards = isMetric ? "kg" : "lb";
  const liftUnit = lift.unitType || "lb";
  let oneRepMax =
    typeof oneRepMaxOverride === "number" ? oneRepMaxOverride : lift.weight;

  if (!oneRepMax) return null;

  if (liftUnit !== unitForStandards) {
    if (liftUnit === "kg" && unitForStandards === "lb") {
      oneRepMax = Math.round(oneRepMax * 2.2046);
    } else if (liftUnit === "lb" && unitForStandards === "kg") {
      oneRepMax = Math.round(oneRepMax / 2.2046);
    }
  }

  return getStrengthRatingForE1RM(oneRepMax, standardForLift);
}

function takeTopUniqueWeightEntries(entries, maxCount) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const results = [];
  const seenWeights = new Set();

  for (let i = 0; i < entries.length && results.length < maxCount; i++) {
    const lift = entries[i];
    const weightKey = `${lift.weight}|${lift.unitType || "lb"}`;
    if (seenWeights.has(weightKey)) continue;
    seenWeights.add(weightKey);
    results.push(lift);
  }

  return results;
}

function scoreClassicLiftCandidate({
  lift,
  candidateKind,
  rankIndex,
  trainingYears,
  strengthRating,
  liftFrequency,
}) {
  const ratingScore = STRENGTH_RATING_SCORE[strengthRating] ?? 0;
  const noteSignals = analyzeClassicLiftNotes(lift?.notes);
  const normalizedCandidateKind = candidateKind ?? "standoutRep";
  const base = 82;
  const adjustedBase =
    normalizedCandidateKind === "single"
      ? 100
      : normalizedCandidateKind === "frequentLiftPR"
        ? 88
        : normalizedCandidateKind === "storyLift"
          ? 74
          : 82;
  const rankBonus =
    normalizedCandidateKind === "single"
      ? Math.max(0, 5 - rankIndex) * 4
      : normalizedCandidateKind === "frequentLiftPR"
        ? Math.max(0, 4 - rankIndex) * 3
        : normalizedCandidateKind === "storyLift"
          ? Math.max(0, 3 - rankIndex) * 2
          : Math.max(0, 4 - rankIndex) * 2;
  const frequencyBonus = Math.min(
    8,
    Math.round(Math.log10((liftFrequency || 1) + 1) * 6),
  );

  const daysAgo = getDaysAgoFromDateStr(lift.date);
  const recencyOrNostalgiaBonus =
    trainingYears >= 3
      ? Math.min(18, Math.round(daysAgo / 180))
      : Math.max(0, 18 - Math.round(daysAgo / 30));

  const repSchemeBonus =
    normalizedCandidateKind === "standoutRep"
      ? Math.max(0, 8 - Math.abs((lift.reps ?? 1) - 5))
      : normalizedCandidateKind === "frequentLiftPR"
        ? Math.max(0, 7 - Math.abs((lift.reps ?? 1) - 4))
        : normalizedCandidateKind === "storyLift"
          ? Math.max(0, 6 - Math.abs((lift.reps ?? 3) - 5))
          : 0;
  const positiveNoteBonus = Math.min(12, noteSignals.positiveMatches.length * 4);
  const battleNoteBonus = Math.min(12, noteSignals.battleMatches.length * 4);
  const noteBonus =
    (noteSignals.hasMeetContext ? 24 : 0) + positiveNoteBonus + battleNoteBonus;
  const { boost: anniversaryBonus, daysAway: anniversaryDaysAway } =
    getAnniversaryBoost(lift.date);

  const total =
    adjustedBase +
    rankBonus +
    ratingScore * 4 +
    frequencyBonus +
    recencyOrNostalgiaBonus +
    repSchemeBonus +
    noteBonus +
    anniversaryBonus;

  return {
    total,
    noteSignals,
    anniversaryDaysAway,
    breakdown: {
      base,
      adjustedBase,
      rankBonus,
      strengthBonus: ratingScore * 4,
      frequencyBonus,
      nostalgiaBonus: recencyOrNostalgiaBonus,
      repSchemeBonus,
      noteBonus,
      anniversaryBonus,
    },
  };
}

function dedupeClassicLiftCandidates(candidates) {
  const bestByLiftKey = new Map();

  (candidates ?? []).forEach((candidate) => {
    if (!candidate?.lift) return;
    const key = buildLiftCandidateId(candidate.lift, "core");
    const existing = bestByLiftKey.get(key);
    if (!existing || candidate.score > existing.score) {
      bestByLiftKey.set(key, candidate);
    }
  });

  return Array.from(bestByLiftKey.values());
}

function buildLiftCandidateId(lift, suffix) {
  return [
    lift?.liftType ?? "Unknown",
    lift?.date ?? "0000-00-00",
    lift?.reps ?? 0,
    lift?.weight ?? 0,
    lift?.unitType ?? "lb",
    suffix,
  ].join("|");
}

function getClassicLiftPoolTargetSize(trainingYears, candidateCount = 0) {
  const count = Math.max(0, candidateCount || 0);

  if (trainingYears >= 10) {
    return clampNumber(Math.round(count * 0.6), 64, 96);
  }
  if (trainingYears >= 5) {
    return clampNumber(Math.round(count * 0.55), 36, 72);
  }
  if (trainingYears >= 3) {
    return clampNumber(Math.round(count * 0.5), 24, 48);
  }
  if (trainingYears >= 1) {
    return clampNumber(Math.round(count * 0.45), 14, 28);
  }
  return clampNumber(Math.round(count * 0.4), 8, 16);
}

function buildClassicLiftSelectionPool(candidates, { trainingYears, targetPoolSize }) {
  const sortedCandidates = [...(candidates ?? [])].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lift?.date !== b.lift?.date) {
      return (a.lift?.date ?? "") > (b.lift?.date ?? "") ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  const targetSize = Math.min(sortedCandidates.length, targetPoolSize);
  if (targetSize <= 0) return [];

  const selected = [];
  const selectedIds = new Set();
  const byLift = new Map();
  const byKind = new Map();

  const addCandidate = (candidate) => {
    if (!candidate || selectedIds.has(candidate.id) || selected.length >= targetSize) {
      return false;
    }
    selected.push(candidate);
    selectedIds.add(candidate.id);
    byLift.set(
      candidate.lift?.liftType ?? "Unknown",
      (byLift.get(candidate.lift?.liftType ?? "Unknown") ?? 0) + 1,
    );
    byKind.set(
      candidate.candidateKind ?? "unknown",
      (byKind.get(candidate.candidateKind ?? "unknown") ?? 0) + 1,
    );
    return true;
  };

  const addByPredicate = (limit, predicate) => {
    if (limit <= 0) return;
    for (let i = 0; i < sortedCandidates.length && selected.length < targetSize; i++) {
      if (limit <= 0) break;
      const candidate = sortedCandidates[i];
      if (selectedIds.has(candidate.id)) continue;
      if (!predicate(candidate)) continue;
      if (addCandidate(candidate)) {
        limit--;
      }
    }
  };

  const minPerBigFour = trainingYears >= 10 ? 3 : trainingYears >= 5 ? 2 : 1;
  BIG_FOUR_LIFTS.forEach((liftType) => {
    const availableForLift = sortedCandidates.filter(
      (candidate) => candidate.lift?.liftType === liftType,
    ).length;
    addByPredicate(Math.min(minPerBigFour, availableForLift), (candidate) => {
      return candidate.lift?.liftType === liftType;
    });
  });

  if (targetSize >= 12) {
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.2)), (candidate) => {
      return candidate.candidateKind === "standoutRep";
    });
  }

  if (targetSize >= 16) {
    addByPredicate(Math.min(8, Math.ceil(targetSize * 0.2)), (candidate) => {
      return candidate.candidateKind === "storyLift";
    });
  }

  if (targetSize >= 16) {
    const frequentLiftTypes = Array.from(
      new Set(
        sortedCandidates
          .filter((candidate) => candidate.candidateKind === "frequentLiftPR")
          .map((candidate) => candidate.frequentLiftType)
          .filter(Boolean),
      ),
    );
    let frequentCoverageRemaining = Math.min(
      Math.ceil(targetSize * 0.45),
      frequentLiftTypes.length * 2,
    );

    for (
      let i = 0;
      i < frequentLiftTypes.length &&
      selected.length < targetSize &&
      frequentCoverageRemaining > 0;
      i++
    ) {
      const liftType = frequentLiftTypes[i];
      const before = selected.length;
      addByPredicate(1, (candidate) => {
        return (
          candidate.candidateKind === "frequentLiftPR" &&
          candidate.frequentLiftType === liftType &&
          candidate.frequentLiftSlot === "single"
        );
      });
      frequentCoverageRemaining -= selected.length > before ? 1 : 0;
    }

    for (
      let i = 0;
      i < frequentLiftTypes.length &&
      selected.length < targetSize &&
      frequentCoverageRemaining > 0;
      i++
    ) {
      const liftType = frequentLiftTypes[i];
      const before = selected.length;
      addByPredicate(1, (candidate) => {
        return (
          candidate.candidateKind === "frequentLiftPR" &&
          candidate.frequentLiftType === liftType &&
          candidate.frequentLiftSlot === "e1rm"
        );
      });
      frequentCoverageRemaining -= selected.length > before ? 1 : 0;
    }
  }

  if (targetSize >= 16) {
    addByPredicate(Math.min(10, Math.ceil(targetSize * 0.28)), (candidate) => {
      return candidate.candidateKind === "frequentLiftPR";
    });
  }

  if (trainingYears >= 3) {
    addByPredicate(Math.min(4, Math.ceil(targetSize * 0.12)), (candidate) => {
      return candidate.noteSignals?.hasMeetContext;
    });
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.18)), (candidate) => {
      return candidate.noteSignals?.positiveMatches?.length > 0;
    });
    addByPredicate(Math.min(4, Math.ceil(targetSize * 0.12)), (candidate) => {
      return (candidate.anniversaryDaysAway ?? 999) <= 14;
    });
  }

  if (trainingYears >= 5) {
    addByPredicate(Math.min(10, Math.ceil(targetSize * 0.3)), (candidate) => {
      return getDaysAgoFromDateStr(candidate.lift?.date) >= 365 * 5;
    });
    addByPredicate(Math.min(8, Math.ceil(targetSize * 0.22)), (candidate) => {
      const daysAgo = getDaysAgoFromDateStr(candidate.lift?.date);
      return daysAgo >= 365 * 2 && daysAgo < 365 * 5;
    });
    addByPredicate(Math.min(6, Math.ceil(targetSize * 0.18)), (candidate) => {
      return getDaysAgoFromDateStr(candidate.lift?.date) < 365 * 2;
    });
  }

  const softPerLiftCap = Math.max(minPerBigFour, Math.ceil(targetSize * 0.4));
  addByPredicate(targetSize, (candidate) => {
    const liftType = candidate.lift?.liftType ?? "Unknown";
    const currentLiftCount = byLift.get(liftType) ?? 0;
    if (currentLiftCount >= softPerLiftCap) return false;

    const standoutCount = byKind.get("standoutRep") ?? 0;
    if (
      candidate.candidateKind === "standoutRep" &&
      targetSize >= 16 &&
      standoutCount >= Math.ceil(targetSize * 0.55)
    ) {
      return false;
    }

    const storyLiftCount = byKind.get("storyLift") ?? 0;
    if (
      candidate.candidateKind === "storyLift" &&
      targetSize >= 16 &&
      storyLiftCount >= Math.ceil(targetSize * 0.35)
    ) {
      return false;
    }

    const frequentLiftPrCount = byKind.get("frequentLiftPR") ?? 0;
    if (
      candidate.candidateKind === "frequentLiftPR" &&
      targetSize >= 16 &&
      frequentLiftPrCount >= Math.ceil(targetSize * 0.42)
    ) {
      return false;
    }

    return true;
  });

  addByPredicate(targetSize, () => true);

  return selected;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildFrequentNonBigFourClassicCandidates({
  topLiftsByTypeAndReps,
  liftTypes,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!topLiftsByTypeAndReps || !Array.isArray(liftTypes) || liftTypes.length === 0) {
    return [];
  }

  const topLiftCount = trainingYears >= 10 ? 15 : trainingYears >= 5 ? 12 : 10;
  const frequentNonBigFour = liftTypes
    .slice(0, topLiftCount + BIG_FOUR_LIFTS.length)
    .filter((liftMeta) => !BIG_FOUR_LIFTS.includes(liftMeta.liftType))
    .slice(0, topLiftCount);

  const candidates = [];

  for (let i = 0; i < frequentNonBigFour.length; i++) {
    const liftMeta = frequentNonBigFour[i];
    const liftType = liftMeta.liftType;
    const repRanges = topLiftsByTypeAndReps[liftType];
    if (!repRanges) continue;

    const liftTotals = {
      totalSets: liftMeta.totalSets ?? 0,
      totalReps: liftMeta.totalReps ?? 0,
    };
    const careBonus = getStoryLiftCareBonus(liftTotals);

    const bestSingle = takeTopUniqueWeightEntries(repRanges[0] ?? [], 1)[0] ?? null;
    if (bestSingle) {
      const strengthRating = getLiftStrengthRating({
        lift: bestSingle,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift: bestSingle,
        candidateKind: "frequentLiftPR",
        rankIndex: 0,
        trainingYears,
        strengthRating,
        liftFrequency: liftTotals.totalSets,
      });
      candidates.push({
        id: buildLiftCandidateId(bestSingle, `frequent-single-${i + 1}`),
        lift: bestSingle,
        score: score.total + careBonus,
        scoreBreakdown: { ...score.breakdown, careBonus },
        strengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "frequentLiftPR",
        frequentLiftType: liftType,
        frequentLiftSlot: "single",
        reasonLabel: "Frequent-lift best single",
      });
    }

    const {
      candidate: bestE1RMCandidate,
      reasonLabel: frequentSecondaryReasonLabel,
      rankIndex: frequentSecondaryRankIndex,
      e1rmIdentityBonus,
    } = chooseFrequentLiftSecondaryClassicCandidate(liftType, repRanges);

    if (bestE1RMCandidate) {
      const e1rmStrengthRating = getLiftStrengthRating({
        lift: bestE1RMCandidate,
        oneRepMaxOverride:
          bestE1RMCandidate.reps > 1
            ? estimateE1RM(
                bestE1RMCandidate.reps,
                bestE1RMCandidate.weight,
                "Brzycki",
              )
            : bestE1RMCandidate.weight,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      const score = scoreClassicLiftCandidate({
        lift: bestE1RMCandidate,
        candidateKind: "frequentLiftPR",
        rankIndex: frequentSecondaryRankIndex,
        trainingYears,
        strengthRating: e1rmStrengthRating,
        liftFrequency: liftTotals.totalSets,
      });
      candidates.push({
        id: buildLiftCandidateId(bestE1RMCandidate, `frequent-e1rm-${i + 1}`),
        lift: bestE1RMCandidate,
        score: score.total + careBonus + e1rmIdentityBonus,
        scoreBreakdown: {
          ...score.breakdown,
          careBonus,
          e1rmIdentityBonus,
        },
        strengthRating: e1rmStrengthRating,
        noteSignals: score.noteSignals,
        anniversaryDaysAway: score.anniversaryDaysAway,
        candidateKind: "frequentLiftPR",
        frequentLiftType: liftType,
        frequentLiftSlot: "e1rm",
        reasonLabel: frequentSecondaryReasonLabel,
      });
    }
  }

  return candidates;
}

function chooseFrequentLiftSecondaryClassicCandidate(liftType, repRanges) {
  let bestE1RMCandidate = null;
  let bestE1RMWeight = 0;
  let topWeightAnyRepCandidate = null;

  for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
    const topAtReps = repRanges[repsIndex]?.[0];
    if (!topAtReps) continue;

    const reps = repsIndex + 1;
    const estimated = estimateE1RM(reps, topAtReps.weight, "Brzycki");
    if (estimated > bestE1RMWeight) {
      bestE1RMWeight = estimated;
      bestE1RMCandidate = topAtReps;
    }

    if (
      !topWeightAnyRepCandidate ||
      topAtReps.weight > topWeightAnyRepCandidate.weight ||
      (topAtReps.weight === topWeightAnyRepCandidate.weight &&
        reps > (topWeightAnyRepCandidate.reps ?? 0))
    ) {
      topWeightAnyRepCandidate = topAtReps;
    }
  }

  if (!bestE1RMCandidate) {
    return { candidate: null, reasonLabel: "", rankIndex: 0, e1rmIdentityBonus: 0 };
  }

  const isFixedImplementLift = /dumbbell|db\b|kettlebell|kb\b|cable|machine/i.test(
    liftType ?? "",
  );
  const sameTopWeightBetterRepStory =
    isFixedImplementLift &&
    topWeightAnyRepCandidate &&
    topWeightAnyRepCandidate.weight === bestE1RMCandidate.weight &&
    (topWeightAnyRepCandidate.unitType || "lb") ===
      (bestE1RMCandidate.unitType || "lb") &&
    (topWeightAnyRepCandidate.reps ?? 0) > (bestE1RMCandidate.reps ?? 0);

  if (sameTopWeightBetterRepStory) {
    return {
      candidate: topWeightAnyRepCandidate,
      reasonLabel: `Frequent-lift top weight reps (${topWeightAnyRepCandidate.reps} reps)`,
      rankIndex: 0,
      e1rmIdentityBonus: 1,
    };
  }

  return {
    candidate: bestE1RMCandidate,
    reasonLabel:
      bestE1RMCandidate.reps === 1
        ? "Frequent-lift best e1RM (single)"
        : `Frequent-lift best e1RM (${bestE1RMCandidate.reps} reps)`,
    rankIndex: bestE1RMCandidate.reps === 1 ? 1 : 0,
    e1rmIdentityBonus: bestE1RMCandidate.reps > 1 ? 3 : 0,
  };
}

function buildNonBigFourStoryCandidates({
  parsedData,
  liftTypes,
  trainingYears,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return [];

  const liftTotalsMap = new Map(
    (liftTypes ?? []).map((lift) => [
      lift.liftType,
      { totalSets: lift.totalSets ?? 0, totalReps: lift.totalReps ?? 0 },
    ]),
  );
  const noteSignalCache = new Map();
  const candidatesByLiftType = new Map();
  const seenLiftKeys = new Set();

  const globalCandidateCap =
    trainingYears >= 10 ? 24 : trainingYears >= 5 ? 18 : trainingYears >= 3 ? 12 : 8;
  const perLiftCap =
    trainingYears >= 10 ? 4 : trainingYears >= 5 ? 3 : trainingYears >= 3 ? 2 : 2;
  const maxReps = trainingYears >= 5 ? 15 : 12;

  for (let i = 0; i < parsedData.length; i++) {
    const lift = parsedData[i];
    if (!lift || lift.isGoal) continue;
    if (!lift.notes || typeof lift.notes !== "string") continue;
    if (!lift.liftType || BIG_FOUR_LIFTS.includes(lift.liftType)) continue;
    if (!lift.date || !lift.weight || !lift.reps) continue;
    if (lift.reps < 1 || lift.reps > maxReps) continue;

    const noteLower = lift.notes.toLowerCase();
    let hasFastHint = false;
    for (let j = 0; j < CLASSIC_LIFT_NOTE_FAST_HINTS.length; j++) {
      if (noteLower.includes(CLASSIC_LIFT_NOTE_FAST_HINTS[j])) {
        hasFastHint = true;
        break;
      }
    }
    if (!hasFastHint) continue;

    const dedupeKey = `${lift.liftType}|${lift.date}|${lift.reps}|${lift.weight}|${lift.unitType || "lb"}`;
    if (seenLiftKeys.has(dedupeKey)) continue;
    seenLiftKeys.add(dedupeKey);

    let noteSignals = noteSignalCache.get(lift.notes);
    if (!noteSignals) {
      noteSignals = analyzeClassicLiftNotes(lift.notes);
      noteSignalCache.set(lift.notes, noteSignals);
    }
    if (!noteSignals.tags?.length) continue;

    const hasStrongStorySignal =
      noteSignals.hasMeetContext ||
      noteSignals.positiveMatches.length > 0 ||
      noteSignals.battleMatches.length > 0;
    if (!hasStrongStorySignal) continue;

    let strengthRating = null;
    if (hasBioData && lift.reps <= 10) {
      const estimatedE1RM = estimateE1RM(lift.reps, lift.weight, "Brzycki");
      strengthRating = getLiftStrengthRating({
        lift,
        oneRepMaxOverride: estimatedE1RM,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
    }

    const liftTotals = liftTotalsMap.get(lift.liftType) ?? {
      totalSets: 0,
      totalReps: 0,
    };
    const score = scoreClassicLiftCandidate({
      lift,
      candidateKind: "storyLift",
      rankIndex: 0,
      trainingYears,
      strengthRating,
      liftFrequency: liftTotals.totalSets,
    });

    const careBonus = getStoryLiftCareBonus(liftTotals);
    const rarityBonus = Math.max(
      0,
      10 - Math.min(10, Math.round(Math.log10((liftTotals.totalSets ?? 1) + 1) * 6)),
    );
    const finalScore = score.total + rarityBonus + careBonus;

    const candidate = {
      id: buildLiftCandidateId(lift, `story-${i}`),
      lift,
      score: finalScore,
      scoreBreakdown: { ...score.breakdown, careBonus, rarityBonus },
      strengthRating,
      noteSignals,
      anniversaryDaysAway: score.anniversaryDaysAway,
      candidateKind: "storyLift",
      reasonLabel: buildStoryLiftReasonLabel(lift, noteSignals),
    };

    const liftBucket = candidatesByLiftType.get(lift.liftType) ?? [];
    liftBucket.push(candidate);
    liftBucket.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.lift.date !== b.lift.date) return a.lift.date > b.lift.date ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    if (liftBucket.length > perLiftCap) {
      liftBucket.length = perLiftCap;
    }
    candidatesByLiftType.set(lift.liftType, liftBucket);
  }

  const flattened = Array.from(candidatesByLiftType.values()).flat();
  flattened.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lift.date !== b.lift.date) return a.lift.date > b.lift.date ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  if (flattened.length > globalCandidateCap) {
    flattened.length = globalCandidateCap;
  }

  return flattened;
}

function buildStoryLiftReasonLabel(lift, noteSignals) {
  if (noteSignals?.hasMeetContext) return `Story lift (${lift.reps} reps · meet)`;
  if (noteSignals?.battleMatches?.length) {
    return `Story lift (${lift.reps} reps · battle)`;
  }
  if (noteSignals?.positiveMatches?.length) {
    return `Story lift (${lift.reps} reps · note)`;
  }
  return `Story lift (${lift.reps} reps)`;
}

function getStoryLiftCareBonus(liftTotals) {
  const totalSets = liftTotals?.totalSets ?? 0;
  const totalReps = liftTotals?.totalReps ?? 0;

  const setsSignal = Math.round(Math.log10(totalSets + 1) * 7);
  const repsSignal = Math.round(Math.log10(totalReps + 1) * 5);

  let milestoneBonus = 0;
  if (totalSets >= 250 || totalReps >= 1000) milestoneBonus += 10;
  else if (totalSets >= 120 || totalReps >= 500) milestoneBonus += 7;
  else if (totalSets >= 60 || totalReps >= 250) milestoneBonus += 4;
  else if (totalSets >= 25 || totalReps >= 100) milestoneBonus += 2;

  return Math.min(22, setsSignal + repsSignal + milestoneBonus);
}

function analyzeClassicLiftNotes(notes) {
  if (!notes || typeof notes !== "string") {
    return {
      hasMeetContext: false,
      meetMatches: [],
      positiveMatches: [],
      battleMatches: [],
      tags: [],
    };
  }

  const normalized = normalizeClassicLiftNoteText(notes);
  const meetMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.meet,
  );
  const positiveMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.positive,
  );
  const battleMatches = matchClassicLiftNoteKeywords(
    normalized,
    CLASSIC_LIFT_NOTE_KEYWORDS.battle,
  );

  const tags = [];
  if (meetMatches.length > 0) tags.push("meet");
  if (positiveMatches.length > 0) tags.push("positive");
  if (battleMatches.length > 0) tags.push("battle");

  return {
    hasMeetContext: meetMatches.length > 0,
    meetMatches,
    positiveMatches,
    battleMatches,
    tags,
  };
}

function normalizeClassicLiftNoteText(notes) {
  return notes
    .toLowerCase()
    .replace(/[^a-z0-9\\s-]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function matchClassicLiftNoteKeywords(normalizedNotes, keywords) {
  if (!normalizedNotes) return [];

  const matches = [];
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const escaped = escapeRegExp(keyword.toLowerCase());
    const pattern = new RegExp(`(^|\\\\s)${escaped}(\\\\s|$)`, "i");
    if (pattern.test(normalizedNotes)) {
      matches.push(keyword);
    }
  }
  return matches;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

function getAnniversaryBoost(dateStr) {
  if (!dateStr) return { boost: 0, daysAway: null };

  const parts = dateStr.split("-");
  if (parts.length !== 3) return { boost: 0, daysAway: null };

  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return { boost: 0, daysAway: null };
  }

  const today = new Date();
  const y = today.getFullYear();
  const todayMidnight = new Date(y, today.getMonth(), today.getDate());
  const candidates = [
    new Date(y - 1, month - 1, day),
    new Date(y, month - 1, day),
    new Date(y + 1, month - 1, day),
  ];
  let minDays = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candidates.length; i++) {
    const diffMs = Math.abs(candidates[i].getTime() - todayMidnight.getTime());
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < minDays) minDays = diffDays;
  }

  let boost = 0;
  if (Number.isFinite(minDays)) {
    if (minDays <= 3) boost = 12;
    else if (minDays <= 7) boost = 8;
    else if (minDays <= 14) boost = 5;
    else if (minDays <= 30) boost = 2;
  }

  return { boost, daysAway: Number.isFinite(minDays) ? minDays : null };
}

function getDaysAgoFromDateStr(dateStr) {
  if (!dateStr) return 0;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes) {
  if (!topLiftsByTypeAndReps || !liftTypes) return null;

  const topFiveLiftTypes = liftTypes.slice(0, 5).map((lift) => lift.liftType);

  let mostRecentPR = null;
  let mostRecentDate = "";

  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    if (!topFiveLiftTypes.includes(liftType)) return;

    const singleReps = repRanges[0];
    if (singleReps && singleReps.length > 0) {
      const topWeight = singleReps[0].weight;
      const pr = singleReps
        .filter((lift) => lift.weight === topWeight)
        .reduce(
          (best, lift) => (lift.date > best.date ? lift : best),
          singleReps[0],
        );
      if (!mostRecentPR || pr.date > mostRecentDate) {
        mostRecentPR = pr;
        mostRecentDate = pr.date;
      }
    }
  });

  return mostRecentPR;
}
