import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { estimateE1RM } from "@/lib/estimate-e1rm";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useStateFromQueryOrLocalStorage } from "./use-state-from-query-or-localStorage";

/** Emoji for each strength level, shared across UI */
export const STRENGTH_LEVEL_EMOJI = {
  "Physically Active": "🏃",
  Beginner: "🌱",
  Intermediate: "💪",
  Advanced: "🔥",
  Elite: "👑",
};

/**
 * Returns strength rating (Physically Active, Beginner, Intermediate, Advanced, Elite)
 * for a given e1RM based on standards. Shared by session analysis, lift PRs, etc.
 */
export function getStrengthRatingForE1RM(oneRepMax, standard) {
  if (!standard) return null;
  const { beginner, intermediate, advanced, elite } = standard;
  if (oneRepMax < beginner) return "Physically Active";
  if (oneRepMax < intermediate) return "Beginner";
  if (oneRepMax < advanced) return "Intermediate";
  if (oneRepMax < elite) return "Advanced";
  return "Elite";
}

/**
 * From topLiftsByTypeAndReps format (array of rep-range arrays, best lift at [0]),
 * returns best e1RM, best raw weight, and strength rating. Used by StandardsSlider
 * and strength-level-calculator.
 */
export function getTopLiftStats(
  topLifts,
  liftType,
  standards,
  e1rmFormula = "Brzycki",
) {
  let bestE1RM = 0;
  let bestWeight = 0;
  if (Array.isArray(topLifts)) {
    for (let repsIdx = 0; repsIdx < topLifts.length; repsIdx++) {
      const topSet = topLifts[repsIdx]?.[0];
      if (!topSet) continue;
      const reps = repsIdx + 1;
      const weight = topSet.weight || 0;
      if (weight > bestWeight) bestWeight = weight;
      const e1rm = estimateE1RM(reps, weight, e1rmFormula);
      if (e1rm > bestE1RM) bestE1RM = e1rm;
    }
  }
  const standard = standards?.[liftType];
  const strengthRating =
    standard && bestE1RM > 0
      ? getStrengthRatingForE1RM(bestE1RM, standard)
      : null;
  return { bestE1RM, bestWeight, strengthRating };
}

/**
 * Finds the highest e1RM across workout sets and returns the corresponding
 * strength rating. Handles drop sets where an earlier set may beat the last.
 */
export function getStrengthLevelForWorkouts(
  workouts,
  liftType,
  standards,
  e1rmFormula = "Brzycki",
) {
  const standard = standards?.[liftType];
  if (!standard || !workouts?.length) return null;

  let bestE1RM = 0;
  for (const lift of workouts) {
    const reps = lift.reps ?? 0;
    const weight = lift.weight ?? 0;
    if (reps === 0) continue;
    const e1rm = estimateE1RM(reps, weight, e1rmFormula);
    if (e1rm > bestE1RM) bestE1RM = e1rm;
  }
  if (bestE1RM === 0) return null;

  return getStrengthRatingForE1RM(bestE1RM, standard);
}

const ADVANCED_QUERY_PARAM = "advanced";

// A custom hook to get and store the athlete provided bio data in localStorage
// Also provide some custom strength levels for the main lifts based on this bio data.
// modifyURLQuery controls whether query parameters are updated (defaults to false)
// options.isAdvancedAnalysis: when false (e.g. calculator with advanced off), age/sex/bodyWeight/liftType
// are not synced to URL. When true or undefined, they sync together so shared URLs are complete.
export const useAthleteBioData = (modifyURLQuery = false, options = {}) => {
  const router = useRouter();
  const { isAdvancedAnalysis = true } = options;
  const syncAdvancedParams = modifyURLQuery && isAdvancedAnalysis;
  // Gate URL sync: only after user changes a value, never on initial load (avoids polluting shared links)
  const hasAdvancedInteractedRef = useRef(false);

  // Advanced params: syncQuery=false here; we sync all four together in the effect below
  const [age, setAgeBase] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.ATHLETE_AGE,
    30,
    false,
  );
  const [isMetric, setIsMetric] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.CALC_IS_METRIC,
    false,
    modifyURLQuery,
  );
  const [sex, setSexBase] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.ATHLETE_SEX,
    "male",
    false,
  );
  const [bodyWeight, setBodyWeightBase] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.ATHLETE_BODY_WEIGHT,
    200,
    false,
  );
  const [liftType, setLiftTypeBase] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.ATHLETE_LIFT_TYPE,
    "Back Squat",
    false,
  );

  // Wrappers mark "user interacted" so the sync effect knows it's safe to write to URL
  const setAge = useCallback(
    (v) => {
      hasAdvancedInteractedRef.current = true;
      setAgeBase(v);
    },
    [setAgeBase],
  );
  const setSex = useCallback(
    (v) => {
      hasAdvancedInteractedRef.current = true;
      setSexBase(v);
    },
    [setSexBase],
  );
  const setBodyWeight = useCallback(
    (v) => {
      hasAdvancedInteractedRef.current = true;
      setBodyWeightBase(v);
    },
    [setBodyWeightBase],
  );
  const setLiftType = useCallback(
    (v) => {
      hasAdvancedInteractedRef.current = true;
      setLiftTypeBase(v);
    },
    [setLiftTypeBase],
  );

  // Sync all advanced params together when any change. Keeps shared URLs complete (age without
  // bodyweight etc. would be meaningless). Include unit type so bodyWeight is interpretable (kg vs lb).
  // Only runs after user interaction, never on load.
  useEffect(() => {
    if (
      !syncAdvancedParams ||
      !hasAdvancedInteractedRef.current ||
      !router.isReady
    )
      return;

    router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          [LOCAL_STORAGE_KEYS.ATHLETE_AGE]: JSON.stringify(age),
          [LOCAL_STORAGE_KEYS.ATHLETE_SEX]: JSON.stringify(sex),
          [LOCAL_STORAGE_KEYS.ATHLETE_BODY_WEIGHT]: JSON.stringify(bodyWeight),
          [LOCAL_STORAGE_KEYS.ATHLETE_LIFT_TYPE]: JSON.stringify(liftType),
          [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: JSON.stringify(isMetric),
          [ADVANCED_QUERY_PARAM]: "true", // Explicit flag so recipient knows to show advanced UI
        },
      },
      undefined,
      { shallow: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router excluded to prevent infinite loop
  }, [age, sex, bodyWeight, liftType, isMetric, syncAdvancedParams, router.isReady]);

  const [standards, setStandards] = useState({});

  // FIXME: It may be better to convert the standards to lb in the component rather than in the state

  useEffect(() => {
    const bodyWeightKG = isMetric
      ? bodyWeight
      : Math.round(bodyWeight / 2.2046);

    const uniqueLiftNames = Array.from(
      new Set(LiftingStandardsKG.map((item) => item.liftType)),
    );
    const newStandards = {};

    uniqueLiftNames.forEach((liftType) => {
      const standard = interpolateStandardKG(
        age,
        bodyWeightKG,
        sex,
        liftType,
        LiftingStandardsKG,
      );

      if (isMetric) {
        newStandards[liftType] = standard || {};
      } else {
        newStandards[liftType] = {
          physicallyActive: Math.round(standard?.physicallyActive * 2.2046),
          beginner: Math.round(standard?.beginner * 2.2046),
          intermediate: Math.round(standard?.intermediate * 2.2046),
          advanced: Math.round(standard?.advanced * 2.2046),
          elite: Math.round(standard?.elite * 2.2046),
        };
      }
    });

    setStandards(newStandards);
  }, [age, sex, bodyWeight, isMetric]);

  // Helper function - if user toggles unit type, update isMetric and bodyweight state
  const toggleIsMetric = (isMetric) => {
    let newBodyWeight;

    if (!isMetric) {
      // Going from kg to lb
      newBodyWeight = Math.round(bodyWeight * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newBodyWeight = Math.round(bodyWeight / 2.2046);
      setIsMetric(true);
    }

    // Delay setting bodyWeight state by 100ms
    // This hack allows the query params to update the above isMetric value before we update other values
    // We have race conditions with router updates and useEffects - please don't judge me, this works
    setTimeout(() => {
      setBodyWeight(newBodyWeight);
    }, 100); // Adjust delay as needed
  };

  return {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
    liftType,
    setLiftType,
  };
};
