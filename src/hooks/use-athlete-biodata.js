import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useContext,
  createContext,
} from "react";
import { useRouter } from "next/router";
import { differenceInCalendarYears } from "date-fns";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { estimateE1RM } from "@/lib/estimate-e1rm";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useStateFromQueryOrLocalStorage } from "./use-state-from-query-or-localStorage";
import { useUserLiftingData } from "./use-userlift-data";

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
 * Returns standards interpolated for the athlete's age at the time of a lift.
 * Use this when rating historical PRs: user's current age minus years since the
 * lift date gives the correct age for age-adjusted strength standards.
 *
 * @param {number} currentAge - Athlete's age as of today
 * @param {string} liftDate - Date of the lift (ISO string or parseable)
 * @param {number} bodyWeight - Body weight (kg or lb based on isMetric)
 * @param {string} sex - "male" or "female"
 * @param {string} liftType - e.g. "Back Squat"
 * @param {boolean} isMetric - Whether bodyWeight is in kg
 * @returns {Object|null} Standard { beginner, intermediate, advanced, elite } or null
 */
export function getStandardForLiftDate(
  currentAge,
  liftDate,
  bodyWeight,
  sex,
  liftType,
  isMetric,
) {
  if (!currentAge || !liftDate || !bodyWeight || !sex || !liftType) return null;
  const today = new Date();
  const date = new Date(liftDate);
  if (isNaN(date.getTime())) return null;
  const yearsAgo = differenceInCalendarYears(today, date);
  const ageAtLift = Math.max(0, currentAge - yearsAgo);
  const bodyWeightKG = isMetric
    ? bodyWeight
    : Math.round(bodyWeight / 2.2046);
  const gender = sex === "female" ? "female" : "male";
  const standard = interpolateStandardKG(
    ageAtLift,
    bodyWeightKG,
    gender,
    liftType,
    LiftingStandardsKG,
  );
  if (!standard) return null;
  if (isMetric) return standard;
  return {
    physicallyActive: Math.round(standard.physicallyActive * 2.2046),
    beginner: Math.round(standard.beginner * 2.2046),
    intermediate: Math.round(standard.intermediate * 2.2046),
    advanced: Math.round(standard.advanced * 2.2046),
    elite: Math.round(standard.elite * 2.2046),
  };
}

/**
 * From topLiftsByTypeAndReps format (array of rep-range arrays, best lift at [0]),
 * returns best e1RM, best raw weight, and strength rating. Used by StandardsSlider
 * and strength-level-calculator.
 * When bioForDateRating is provided, uses age at the best lift's date for accurate rating.
 */
export function getTopLiftStats(
  topLifts,
  liftType,
  standards,
  e1rmFormula = "Brzycki",
  bioForDateRating = null,
) {
  let bestE1RM = 0;
  let bestWeight = 0;
  let bestLiftDate = null;
  let bestWeightTuple = null;
  let bestE1RMTuple = null;
  if (Array.isArray(topLifts)) {
    for (let repsIdx = 0; repsIdx < topLifts.length; repsIdx++) {
      const topSet = topLifts[repsIdx]?.[0];
      if (!topSet) continue;
      const reps = repsIdx + 1;
      const weight = topSet.weight || 0;
      const e1rm = estimateE1RM(reps, weight, e1rmFormula);
      if (weight > bestWeight) {
        bestWeight = weight;
        bestWeightTuple = {
          weight,
          reps,
          date: topSet.date || null,
        };
      }
      if (e1rm > bestE1RM) {
        bestE1RM = e1rm;
        bestLiftDate = topSet.date || null;
        bestE1RMTuple = { weight, reps, date: topSet.date || null, e1rm };
      }
    }
  }
  let standard = standards?.[liftType];
  if (
    bioForDateRating &&
    bestLiftDate &&
    bioForDateRating.age &&
    bioForDateRating.bodyWeight != null &&
    bioForDateRating.sex != null
  ) {
    standard = getStandardForLiftDate(
      bioForDateRating.age,
      bestLiftDate,
      bioForDateRating.bodyWeight,
      bioForDateRating.sex,
      liftType,
      bioForDateRating.isMetric ?? false,
    );
  }
  const strengthRating =
    standard && bestE1RM > 0
      ? getStrengthRatingForE1RM(bestE1RM, standard)
      : null;
  return {
    bestE1RM,
    bestWeight,
    strengthRating,
    bestWeightTuple,
    bestE1RMTuple,
  };
}

/**
 * Finds the highest e1RM across workout sets and returns the corresponding
 * strength rating and best e1RM. Handles drop sets where an earlier set may beat the last.
 * Returns { rating, bestE1RM } or null.
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

  const rating = getStrengthRatingForE1RM(bestE1RM, standard);
  return { rating, bestE1RM };
}

// -----------------------------------------------------------------------------
// Shared context so athlete biodata can be edited in one place (e.g. nav)
// and used across the app (calculators, analyzers, etc.).
// -----------------------------------------------------------------------------

const AthleteBioContext = createContext(null);

export const AthleteBioProvider = ({ children }) => {
  // Global shared state for age/sex/bodyWeight/isMetric/liftType.
  // We seed from query/localStorage once, then keep everything in sync via context.
  // URL syncing for specific pages (like calculators) can be handled separately.
  // Import parsedData here so we can auto-initialize isMetric from the user's data.
  // AthleteBioProvider is nested inside UserLiftingDataProvider so this hook call is valid.
  const { parsedData } = useUserLiftingData();
  const value = useAthleteBioData(false, { parsedData });
  return (
    <AthleteBioContext.Provider value={value}>
      {children}
    </AthleteBioContext.Provider>
  );
};

export const useAthleteBio = (options = {}) => {
  const { modifyURLQuery = false, isAdvancedAnalysis = true } = options;
  const ctx = useContext(AthleteBioContext);
  const router = useRouter();
  const syncAdvancedParams = modifyURLQuery && isAdvancedAnalysis;
  const hasAdvancedInteractedRef = useRef(false);

  if (!ctx) {
    throw new Error(
      "useAthleteBio must be used within an AthleteBioProvider (see _app.js).",
    );
  }

  const setAge = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      ctx.setAge(value);
    },
    [ctx],
  );
  const setSex = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      ctx.setSex(value);
    },
    [ctx],
  );
  const setBodyWeight = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      ctx.setBodyWeight(value);
    },
    [ctx],
  );
  const setLiftType = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      ctx.setLiftType(value);
    },
    [ctx],
  );
  const setIsMetric = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      // Mark explicit user preference so auto-init from data doesn't override it later
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET, "1");
      }
      ctx.setIsMetric(value);
    },
    [ctx],
  );
  const toggleIsMetric = useCallback(
    (value) => {
      hasAdvancedInteractedRef.current = true;
      ctx.toggleIsMetric(value);
    },
    [ctx],
  );

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
          [LOCAL_STORAGE_KEYS.ATHLETE_AGE]: JSON.stringify(ctx.age),
          [LOCAL_STORAGE_KEYS.ATHLETE_SEX]: JSON.stringify(ctx.sex),
          [LOCAL_STORAGE_KEYS.ATHLETE_BODY_WEIGHT]: JSON.stringify(
            ctx.bodyWeight,
          ),
          [LOCAL_STORAGE_KEYS.ATHLETE_LIFT_TYPE]: JSON.stringify(ctx.liftType),
          [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: JSON.stringify(ctx.isMetric),
          [ADVANCED_QUERY_PARAM]: "true",
        },
      },
      undefined,
      { shallow: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router excluded to prevent infinite loop
  }, [
    ctx.age,
    ctx.sex,
    ctx.bodyWeight,
    ctx.liftType,
    ctx.isMetric,
    syncAdvancedParams,
    router.isReady,
  ]);

  return {
    ...ctx,
    setAge,
    setSex,
    setBodyWeight,
    setLiftType,
    setIsMetric,
    toggleIsMetric,
  };
};

const ADVANCED_QUERY_PARAM = "advanced";

// A custom hook to get and store the athlete provided bio data in localStorage
// Also provide some custom strength levels for the main lifts based on this bio data.
// modifyURLQuery controls whether query parameters are updated (defaults to false)
// options.isAdvancedAnalysis: when false (e.g. calculator with advanced off), age/sex/bodyWeight/liftType
// are not synced to URL. When true or undefined, they sync together so shared URLs are complete.
// options.parsedData: when provided, auto-initializes isMetric from the majority unit in the data
//   (only on first load, before the user has explicitly set a preference).
export const useAthleteBioData = (modifyURLQuery = false, options = {}) => {
  const router = useRouter();
  const { isAdvancedAnalysis = true, parsedData = null } = options;
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

  // Auto-initialize isMetric from the majority unit in the user's data.
  //
  // WHY: new users land with isMetric=false (lb) by default because the app
  // was originally US-focused. But kg users shouldn't have to manually toggle
  // the setting on first visit — if their data is clearly in kg, we set isMetric
  // automatically so every chart, PR, and analyzer display is correct from the start.
  //
  // Priority chain (highest wins):
  //   1. SJ_unitPreferenceSet flag in localStorage — user has explicitly toggled the button
  //   2. URL query param (calcIsMetric=true/false) — shared links from calculator pages
  //   3. Majority unit from parsedData — this auto-init (runs once on first data load)
  //   4. false (lb) — no data, demo mode, or 50/50 split defaults to lb
  //
  // The SJ_unitPreferenceSet flag is set by any explicit user action (toggleIsMetric,
  // setIsMetric, UnitChooser button, or URL param detection). Once set, this block
  // never overrides it — the user's choice is permanent until they toggle again.
  const hasAutoInitRef = useRef(false);
  useEffect(() => {
    if (hasAutoInitRef.current) return;
    if (!parsedData?.length) return;
    if (typeof window === "undefined") return;
    hasAutoInitRef.current = true;

    // Skip if user (or URL param) has already set an explicit preference
    if (localStorage.getItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET)) return;

    // Skip if the current URL has a calcIsMetric param (shared link) — respect it
    if (router.isReady && router.query[LOCAL_STORAGE_KEYS.CALC_IS_METRIC] !== undefined) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET, "1");
      return;
    }

    // Count units across all lifts and use the majority
    let kgCount = 0;
    let lbCount = 0;
    parsedData.forEach((lift) => {
      if (lift.unitType === "kg") kgCount++;
      else lbCount++;
    });

    if (kgCount > lbCount) {
      setIsMetric(true);
    }
    // Mark as initialized so future loads don't override the user's subsequent choices
    localStorage.setItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET, "1");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router excluded to prevent infinite loop
  }, [parsedData, router.isReady]);

  // Helper function - if user toggles unit type, update isMetric and bodyweight state
  const toggleIsMetric = (isMetric) => {
    // Mark that the user has consciously chosen their unit preference
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET, "1");
    }

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
