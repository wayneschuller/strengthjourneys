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
