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
