/**
 * Home dashboard staging rules.
 *
 * The dashboard needs two related but distinct concepts:
 * - starterSheetState: whether the linked sheet still looks like the seeded
 *   onboarding example
 * - dashboardStage: which home-dashboard experience should be shown
 *
 * Keep this logic centralized so analytics and UI stay in sync.
 *
 * Stage taxonomy:
 * - `starter_sample`: the linked sheet still looks like the seeded auto-provisioned sample
 * - `first_real_week`: the sample has been replaced, but the user is still in their first ~7 sessions
 * - `first_month`: early real data, enough to coach but not enough to compare meaningfully
 * - `early_base`: real training base exists; some mature visualizations can unlock
 * - `established`: enough history for the full dashboard experience
 */

function getNonGoalEntries(parsedData) {
  if (!Array.isArray(parsedData)) return [];
  return parsedData.filter((entry) => !entry?.isGoal);
}

/**
 * Count unique non-goal training sessions in parsedData.
 *
 * @param {Array|null|undefined} parsedData
 * @returns {number}
 */
export function getNonGoalSessionCount(parsedData) {
  const uniqueDates = new Set();
  getNonGoalEntries(parsedData).forEach((entry) => {
    if (entry?.date) uniqueDates.add(entry.date);
  });
  return uniqueDates.size;
}

/**
 * Detect whether the currently linked sheet still looks like the seeded
 * auto-provisioned starter sample.
 *
 * @param {object} params
 * @param {Array|null|undefined} params.parsedData
 * @param {number|null|undefined} params.rawRows
 * @param {{filename?: string}|null|undefined} params.sheetInfo
 * @returns {"starter_sample"|"active_sheet"}
 */
export function detectStarterSheetState({ parsedData, rawRows, sheetInfo } = {}) {
  const nonGoalEntries = getNonGoalEntries(parsedData);
  const sessionCount = getNonGoalSessionCount(parsedData);
  const firstEntry = nonGoalEntries[0] ?? null;
  const lowerFilename = sheetInfo?.filename?.toLowerCase?.() ?? "";
  const uniqueDates = new Set(nonGoalEntries.map((entry) => entry?.date).filter(Boolean));
  const uniqueLiftTypes = new Set(
    nonGoalEntries.map((entry) => entry?.liftType).filter(Boolean),
  );
  const allEntriesMatchSeed =
    nonGoalEntries.length >= 1 &&
    nonGoalEntries.every(
      (entry) =>
        entry?.liftType === "Back Squat" &&
        entry?.reps === 5 &&
        entry?.weight === 20 &&
        entry?.unitType === "kg",
    );

  // This heuristic is intentionally strict. We only want to call something a
  // starter sample when it still closely resembles the seeded auto-provisioned
  // example, not merely because the user is new.
  //
  // The current starter sheet seeds a single Back Squat session at 4x5@20kg,
  // which arrives in parsedData as multiple non-goal rows on the same date.
  // Match that exact shape so the onboarding dashboard only appears when the
  // sample has not yet been meaningfully personalized.
  const looksLikeSeededSample =
    nonGoalEntries.length <= 4 &&
    sessionCount === 1 &&
    uniqueDates.size === 1 &&
    uniqueLiftTypes.size === 1 &&
    rawRows != null &&
    rawRows <= 5 &&
    firstEntry?.liftType === "Back Squat" &&
    allEntriesMatchSeed &&
    !lowerFilename.includes("sample") &&
    !lowerFilename.includes("demo");

  return looksLikeSeededSample ? "starter_sample" : "active_sheet";
}

/**
 * Derive the current home-dashboard stage from the linked sheet and parsed
 * lifting data.
 *
 * This is the main entrypoint for home-dashboard staging. It returns both the
 * newer `dashboardStage` orchestration signal and the older
 * `dataMaturityStage` compatibility signal used by existing card components.
 *
 * @param {object} params
 * @param {Array|null|undefined} params.parsedData
 * @param {number|null|undefined} params.rawRows
 * @param {{filename?: string}|null|undefined} params.sheetInfo
 * @returns {{
 *   dashboardStage: "starter_sample"|"first_real_week"|"first_month"|"early_base"|"established",
 *   starterSheetState: "starter_sample"|"active_sheet",
 *   sessionCount: number,
 *   dataMaturityStage: "no_sessions"|"first_week"|"first_month"|"mature",
 * }}
 */
export function getDashboardStage({ parsedData, rawRows, sheetInfo } = {}) {
  const sessionCount = getNonGoalSessionCount(parsedData);
  const starterSheetState = detectStarterSheetState({
    parsedData,
    rawRows,
    sheetInfo,
  });

  // `dataMaturityStage` is the legacy coarse-grained signal already consumed by
  // several dashboard cards. `dashboardStage` is the newer orchestration layer
  // that drives onboarding behavior, copy, and analytics.

  if (starterSheetState === "starter_sample") {
    return {
      dashboardStage: "starter_sample",
      starterSheetState,
      sessionCount,
      dataMaturityStage: "first_week",
    };
  }

  if (sessionCount <= 7) {
    return {
      dashboardStage: "first_real_week",
      starterSheetState,
      sessionCount,
      dataMaturityStage: sessionCount === 0 ? "no_sessions" : "first_week",
    };
  }

  if (sessionCount <= 20) {
    return {
      dashboardStage: "first_month",
      starterSheetState,
      sessionCount,
      dataMaturityStage: "first_month",
    };
  }

  if (sessionCount <= 60) {
    return {
      dashboardStage: "early_base",
      starterSheetState,
      sessionCount,
      dataMaturityStage: "mature",
    };
  }

  return {
    dashboardStage: "established",
    starterSheetState,
    sessionCount,
    dataMaturityStage: "mature",
  };
}
