/**
 * Home dashboard staging rules.
 *
 * The dashboard needs two related but distinct concepts:
 * - starterSheetState: whether the linked sheet still looks like the seeded
 *   onboarding example
 * - dashboardStage: which home-dashboard experience should be shown
 *
 * Keep this logic centralized so analytics and UI stay in sync.
 */

function getNonGoalEntries(parsedData) {
  if (!Array.isArray(parsedData)) return [];
  return parsedData.filter((entry) => !entry?.isGoal);
}

export function getNonGoalSessionCount(parsedData) {
  const uniqueDates = new Set();
  getNonGoalEntries(parsedData).forEach((entry) => {
    if (entry?.date) uniqueDates.add(entry.date);
  });
  return uniqueDates.size;
}

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
  const looksLikeSeededSample =
    nonGoalEntries.length <= 3 &&
    sessionCount === 1 &&
    uniqueDates.size === 1 &&
    uniqueLiftTypes.size === 1 &&
    rawRows != null &&
    rawRows <= 4 &&
    firstEntry?.liftType === "Back Squat" &&
    allEntriesMatchSeed &&
    !lowerFilename.includes("sample") &&
    !lowerFilename.includes("demo");

  return looksLikeSeededSample ? "starter_sample" : "active_sheet";
}

export function getDashboardStage({ parsedData, rawRows, sheetInfo } = {}) {
  const sessionCount = getNonGoalSessionCount(parsedData);
  const starterSheetState = detectStarterSheetState({
    parsedData,
    rawRows,
    sheetInfo,
  });

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
