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
  SHOW_BACKGROUND: "sj-show-background",
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
  // Set to "1" when the user (or a shared URL) explicitly provides a unit preference.
  // Prevents the data-driven auto-init from overriding an intentional choice.
  UNIT_PREFERENCE_SET: "SJ_unitPreferenceSet",

  // Google Sheet / data source
  SHEET_INFO: "SJ_sheetInfo",
  SSID: "ssid", // deprecated — migrated to SHEET_INFO
  SHEET_URL: "sheetURL", // deprecated — migrated to SHEET_INFO
  SHEET_FILENAME: "sheetFilename", // deprecated — migrated to SHEET_INFO

  // 1000 lb club
  THOUSAND_SQUAT: "SJ_thousand_squat",
  THOUSAND_BENCH: "SJ_thousand_bench",
  THOUSAND_DEADLIFT: "SJ_thousand_deadlift",

  // Gorilla comparison
  GORILLA_IS_METRIC: "SJ_gorilla_is_metric",
  GORILLA_BODY_WEIGHT: "SJ_gorilla_body_weight",
  GORILLA_BENCH: "SJ_gorilla_bench",
  GORILLA_PRESS: "SJ_gorilla_press",

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

  // Session analysis – creative ratings cache (per date, auth only)
  SESSION_RATING_CACHE: "sj-session-rating-cache",

  // Analyzer
  HEATMAP_VIEW_MODE: "SJ_heatmapViewMode",

};

export const SESSION_STORAGE_KEYS = {
  FEEDBACK_TRIGGER_LABEL_INDEX: "sj-feedback-trigger-label-index",
  FEEDBACK_GIVEN: "sj-feedback-given",
  ARTICLE_FEEDBACK_PREFIX: "article_feedback_",
  MINI_FEEDBACK_PREFIX: "mini_feedback_",
  MINI_FEEDBACK_REASON_PREFIX: "mini_feedback_reason_",
  MINI_FEEDBACK_PROMPT_INDEX_PREFIX: "mini_feedback_prompt_index_",
};

/**
 * Returns the appropriate selected lifts key based on auth status and optional prefix.
 * Use a prefix when the lift selector is scoped to a specific component (e.g. "visualizer").
 * @param {boolean} isDemoMode - Whether user is in demo mode (unauthenticated)
 * @param {string|null} [prefix] - Optional prefix for component-scoped keys (e.g. "visualizer" → "visualizer_selectedLifts")
 * @returns {string}
 */
export const getSelectedLiftsKey = (isDemoMode, prefix = null) => {
  if (prefix) {
    return isDemoMode
      ? `${prefix}_selectedLifts_demo`
      : `${prefix}_selectedLifts`;
  }
  return isDemoMode
    ? LOCAL_STORAGE_KEYS.SELECTED_LIFTS_DEMO
    : LOCAL_STORAGE_KEYS.SELECTED_LIFTS;
};
