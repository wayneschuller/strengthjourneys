// Shared grade thresholds for consistency analysis. Used by Analyzer and year-recap SessionsCard.
// (for calculateGradeJump tooltips) and CircularProgressWithLetter (for grade + color display).

const HUE_GREEN = 120;
const HUE_YELLOW = 60;
const HUE_ORANGE = 30;
const HUE_RED = 0;

export const CONSISTENCY_GRADE_THRESHOLDS = [
  { minProgress: 100, grade: "A+", hue: HUE_GREEN },
  { minProgress: 90, grade: "A", hue: HUE_GREEN },
  { minProgress: 80, grade: "A-", hue: HUE_GREEN },
  { minProgress: 70, grade: "B+", hue: HUE_YELLOW },
  { minProgress: 59, grade: "B", hue: HUE_YELLOW },
  { minProgress: 50, grade: "B-", hue: HUE_YELLOW },
  { minProgress: 42, grade: "C+", hue: HUE_ORANGE },
  { minProgress: 36, grade: "C", hue: HUE_ORANGE },
  { minProgress: 30, grade: "C-", hue: HUE_ORANGE },
  { minProgress: 0, grade: ".", hue: HUE_RED }, // Red for low progress
];

// --- The training target ---

// One model, stated the way a lifter would state it: three sessions a week, with a
// fortnight off a year. Everybody takes a holiday, gets sick, or goes away for
// Christmas, and the evidence is clear that a couple of weeks off costs a trained
// lifter almost nothing in strength. Grading as though those weeks should have been
// training makes an A+ reachable only by someone who never has a life.
//
// The fortnight is deducted pro rata rather than only from windows a year or longer,
// so a six month ring is never graded harder than the Year ring beside it. At short
// windows the deduction rounds away to nothing, which is correct: "a fortnight a
// year" has nothing to say about how this particular week went.
export const TARGET_SESSIONS_PER_WEEK = 3;
export const REST_WEEKS_PER_YEAR = 2;

const WEEKS_PER_YEAR = 365.25 / 7;
const EFFECTIVE_SESSIONS_PER_WEEK =
  TARGET_SESSIONS_PER_WEEK *
  ((WEEKS_PER_YEAR - REST_WEEKS_PER_YEAR) / WEEKS_PER_YEAR);

/**
 * Sessions a lifter is graded against over a span of days. The single source of
 * truth for the target, so the Long Game rings and the year recap cannot disagree
 * about what an A means.
 *
 * @param {number} days
 * @returns {number}
 */
export function getTargetSessions(days) {
  return Math.round((days / 7) * EFFECTIVE_SESSIONS_PER_WEEK);
}

// The rate that holds a grade steady on a window still growing into the lifter: the
// target grows every week, so keeping the same ratio means matching this pace.
export function getHoldSessionsPerWeek(percentage) {
  return (EFFECTIVE_SESSIONS_PER_WEEK * percentage) / 100;
}

export function getGradeAndColor(progress) {
  for (let i = 0; i < CONSISTENCY_GRADE_THRESHOLDS.length; i++) {
    if (progress >= CONSISTENCY_GRADE_THRESHOLDS[i].minProgress) {
      const saturation = 90;
      const lightness = 10 + progress / 2; // Increase lightness as progress increases
      const color = `hsl(${CONSISTENCY_GRADE_THRESHOLDS[i].hue}, ${saturation}%, ${lightness}%)`;
      return { grade: CONSISTENCY_GRADE_THRESHOLDS[i].grade, color };
    }
  }
}

// --- Long Game ring palette ---

// The rings on the Long Game card need more than the single flat colour above.
// getGradeAndColor() fixes saturation at 90% and drives lightness straight off
// progress, which lands on neon greens that glare on a white card and near-black
// reds at the bottom of the scale. Rather than change a colour helper that the
// year recap also depends on, the rings get their own palette: same thresholds
// and same hue families, but hues nudged off the pure HSL primaries and split
// into light/dark variants so the arc stays vivid while the letter underneath
// stays readable on either background.
const RING_HUE_BY_THRESHOLD_HUE = {
  [HUE_GREEN]: 142, // emerald rather than pure 120 green
  [HUE_YELLOW]: 44, // amber rather than pure 60 yellow
  [HUE_ORANGE]: 24,
  [HUE_RED]: 358,
};

/**
 * Returns the drawing colours for one consistency ring.
 *
 * Each variant carries a gradient pair (`from`/`to`) for the arc, an `ink`
 * colour for the centred letter grade, and a translucent `glow` for the halo.
 * Vividness rises slightly with progress inside a band so a 95% ring reads
 * stronger than an 80% one even though both are graded "A-".
 */
export function getConsistencyRingPalette(progress) {
  const threshold =
    CONSISTENCY_GRADE_THRESHOLDS.find(
      (candidate) => progress >= candidate.minProgress,
    ) ?? CONSISTENCY_GRADE_THRESHOLDS[CONSISTENCY_GRADE_THRESHOLDS.length - 1];
  const { grade, hue } = threshold;

  const ringHue = RING_HUE_BY_THRESHOLD_HUE[hue] ?? hue;
  const intensity = Math.min(Math.max(progress, 0), 100) / 100;

  return {
    grade,
    light: {
      from: `hsl(${ringHue}, ${62 + 18 * intensity}%, ${52 - 6 * intensity}%)`,
      to: `hsl(${ringHue}, ${78 + 14 * intensity}%, ${39 - 5 * intensity}%)`,
      ink: `hsl(${ringHue}, ${58 + 16 * intensity}%, ${31 - 5 * intensity}%)`,
      glow: `hsla(${ringHue}, 85%, 45%, ${(0.05 + 0.09 * intensity).toFixed(3)})`,
    },
    dark: {
      from: `hsl(${ringHue}, ${70 + 20 * intensity}%, ${64 + 4 * intensity}%)`,
      to: `hsl(${ringHue}, ${82 + 12 * intensity}%, ${48 + 5 * intensity}%)`,
      ink: `hsl(${ringHue}, ${72 + 16 * intensity}%, ${70 + 8 * intensity}%)`,
      glow: `hsla(${ringHue}, 90%, 60%, ${(0.07 + 0.13 * intensity).toFixed(3)})`,
    },
  };
}
