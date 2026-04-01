/**
 * Shared helpers for 1000lb club totals and lift-balance guidance.
 * Keeps the ratio-based "biggest opportunity" recommendation consistent between
 * the dedicated calculator and lightweight preview surfaces.
 */

const IDEAL_SBD_RATIO = { squat: 0.36, bench: 0.24, deadlift: 0.4 };
const LIFT_LABELS = { squat: "Squat", bench: "Bench", deadlift: "Deadlift" };

export function getWeakestLiftHint(squat, bench, deadlift) {
  const total = squat + bench + deadlift;
  if (total === 0) return null;

  const gaps = {
    squat: IDEAL_SBD_RATIO.squat * total - squat,
    bench: IDEAL_SBD_RATIO.bench * total - bench,
    deadlift: IDEAL_SBD_RATIO.deadlift * total - deadlift,
  };

  const worst = Object.entries(gaps).reduce(
    (best, [key, gap]) => (gap > best.gap ? { key, gap } : best),
    { key: null, gap: 0 },
  );

  if (!worst.key || worst.gap < 10) return null;
  return {
    lift: LIFT_LABELS[worst.key],
    gapLbs: Math.round(worst.gap),
  };
}
