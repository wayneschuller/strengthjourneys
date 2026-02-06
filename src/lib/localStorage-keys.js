/**
 * LocalStorage key constants – single source of truth.
 * Import from here when reading/writing localStorage to avoid typos and collisions.
 *
 *
 * Common `usehooks-ts` patterns:
 * - **Read/write preference with `useLocalStorage` (SSR‑safe)**:
 *   - Use `initializeWithValue: false` so the hook doesn’t touch `window` during SSR.
 *   - Example:
 *     const [isMetricPreference, setIsMetricPreference] = useLocalStorage(
 *       LOCAL_STORAGE_KEYS.CALC_IS_METRIC,
 *       false,
 *       { initializeWithValue: false },
 *     );
 *
 * - **Read‑only value with `useReadLocalStorage` (SSR‑safe)**:
 *   - Also pass `{ initializeWithValue: false }` and provide a fallback.
 *   - Example:
 *     const e1rmFormula =
 *       useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, { initializeWithValue: false }) ??
 *       "Brzycki";
 *
 * We also have a dedicated hook, `useStateFromQueryOrLocalStorage`, for values that should be
 * both persisted in localStorage and shareable via URL query params (calculators, biodata, etc.).
 *
 * Following these patterns keeps pages SSR‑safe and avoids hydration warnings while still
 * benefiting from client‑side persistence.
 */

export const LOCAL_STORAGE_KEYS = {
  // Theme
  THEME: "theme",
  ANIMATED_BACKGROUND: "sj-animated-background",

  // Lift colors
  LIFT_COLOR_OVERRIDES: "liftColorOverrides",

  // Selected lifts (use getSelectedLiftsKey helper for demo vs auth)
  SELECTED_LIFTS: "selectedLifts",
  SELECTED_LIFTS_DEMO: "selectedLifts_demoMode",

  // E1RM calculator
  REPS: "reps",
  WEIGHT: "weight",
  FORMULA: "formula",
  WARMUP_REPS: "warmupReps",
  WARMUP_WEIGHT: "warmupWeight",
  CALC_IS_METRIC: "calcIsMetric",
  E1RM_ADVANCED_ANALYSIS: "SJ_E1RMAdvancedAnalysis",

  // Warm-up calculator
  WARMUPS_BAR_TYPE: "SJ_WarmupsBarType",
  WARMUPS_PLATE_PREFERENCE: "SJ_WarmupsPlatePreference",
  WARMUPS_SET_COUNT: "SJ_WarmupsSetCount",

  // Athlete biodata
  ATHLETE_AGE: "AthleteAge",
  ATHLETE_SEX: "AthleteSex",
  ATHLETE_BODY_WEIGHT: "AthleteBodyWeight",
  ATHLETE_LIFT_TYPE: "AthleteLiftType",
  ATHLETE_HEIGHT: "AthleteHeight",

  // Google Sheet / data source
  SSID: "ssid",
  SHEET_URL: "sheetURL",
  SHEET_FILENAME: "sheetFilename",

  // 1000 lb club
  THOUSAND_SQUAT: "SJ_thousand_squat",
  THOUSAND_BENCH: "SJ_thousand_bench",
  THOUSAND_DEADLIFT: "SJ_thousand_deadlift",

  // Playlist leaderboard
  PLAYLIST_VOTES: "SJ_playlistVotes",
  SAVED_PLAYLISTS: "SJ_savedPlaylists",

  // Visualizer
  TIME_RANGE: "SJ_timeRange",
  SHOW_LABEL_VALUES: "SJ_showLabelValues",
  SHOW_ALL_DATA: "SJ_showAllData",
  VIS_MINI_SHOW_STANDARDS: "SJ_VisMiniShowStandards",
  VIS_MINI_SHOW_BODYWEIGHT_MULTIPLES: "SJ_VisMiniShowBodyweightMultiples",
  TONNAGE_AGGREGATION_TYPE: "SJ_tonnageAggregationType",

  // AI assistant
  USER_LIFTING_METADATA: "userLiftingMetadata-selected-options",
  SHARE_BIO_DETAILS_AI: "SJ_ShareBioDetailsAI",
};

/**
 * Returns the appropriate selected lifts key based on auth status.
 * @param {boolean} isDemoMode - Whether user is in demo mode (unauthenticated)
 * @returns {string}
 */
export const getSelectedLiftsKey = (isDemoMode) =>
  isDemoMode
    ? LOCAL_STORAGE_KEYS.SELECTED_LIFTS_DEMO
    : LOCAL_STORAGE_KEYS.SELECTED_LIFTS;
