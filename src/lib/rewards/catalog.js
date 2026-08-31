/**
 * Defines the ordered app reward catalog independently from progress logic.
 * Add future cosmetic or celebratory rewards here without changing consumers.
 */

// Calibration (2026-09-01). Every reward now unlocks on ALL of its criteria,
// not any one of them, because a single criterion could be satisfied by data
// that represents no training at all: one fabricated old date gave a lifter a
// history span of years and, with it, every theme on the ladder. Requiring all
// three means thin-but-old data earns nothing while a genuine multi-year import
// still earns everything.
//
// With "all" in force the three numbers have to describe the same lifter, so
// they are pegged to a modest 3x/week hour: 10 sets and ~35 reps a session, or
// 30 sets and 100 reps a week. Each rung is two more weeks of that — +60 sets,
// +200 reps, +14 days — which keeps the calendar the visible pacer for anyone
// training properly and leaves the volume gates to bite only when the training
// is thinner than the dates claim. Reps are deliberately pegged at a bit over
// 3x sets rather than 5x so a lifter working heavy triples is not held back by
// a threshold built for sets of five.
//
// Blueprint is the exception: no history requirement at all, so an honest first
// session still earns something on day one.
//
// Running order is a judgement about the themes themselves, not their cost to
// build: the early rungs are the ones most lifters will ever see, so they carry
// the themes worth showing off (Retro Arcade moved up on 2026-09-01 for exactly
// this reason), while the loudest, most divisive themes sit at the top where
// being polarising reads as a badge. Reordering here reorders the ladder — the
// thresholds belong to the position, not to the theme — so keep the themes list
// in _app.js in the same order, since that is what the pickers render.
export const THEME_REWARDS = [
  createThemeReward("blueprint", "Blueprint", 10, 40, 0),
  createThemeReward("blueprint-dark", "Blueprint Dark", 60, 200, 14),
  createThemeReward("retro-arcade", "Retro Arcade", 120, 400, 28),
  createThemeReward("retro-arcade-dark", "Retro Arcade Dark", 180, 600, 42),
  createThemeReward("starry-night", "Starry Night", 240, 800, 56),
  createThemeReward("starry-night-dark", "Starry Night Dark", 300, 1000, 70),
  createThemeReward("neo-brutalism", "Neo Brutalism", 360, 1200, 84),
  createThemeReward(
    "neo-brutalism-dark",
    "Neo Brutalism Dark",
    420,
    1400,
    98,
  ),
];

export const REWARD_CATALOG = [...THEME_REWARDS];

export function getRewardsByCategory(category) {
  if (!category) return REWARD_CATALOG;
  return REWARD_CATALOG.filter((reward) => reward.category === category);
}

function createThemeReward(theme, label, sets, reps, historyDays) {
  return {
    id: `theme:${theme}`,
    category: "theme",
    value: theme,
    label,
    unlockMode: "all",
    criteria: [
      { metric: "setCount", threshold: sets },
      { metric: "repCount", threshold: reps },
      { metric: "historyDays", threshold: historyDays },
    ],
  };
}
