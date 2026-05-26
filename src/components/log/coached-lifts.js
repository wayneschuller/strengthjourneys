/**
 * Log-page coaching metadata for lift suggestions and technique assistance.
 * Canonical Big Four identity/path/icon data lives in src/lib/big-four-lifts.js.
 */

import { BIG_FOUR_LIFT_TYPE_SET } from "@/lib/big-four-lifts";

export const COACHED_LIFTS = [
  {
    liftType: "Back Squat",
    slug: "progress-guide/squat",
    cues: [
      "Root your whole foot and brace hard before every rep.",
      "Sit between your hips while the bar stays balanced over mid-foot.",
      "Drive straight up out of the hole and finish tall.",
    ],
    videoUrl: "https://www.youtube.com/embed/jyopTyOjXb0", // "Gym Shorts (How To): The Squat" - Barbell Logic
  },
  {
    liftType: "Bench Press",
    slug: "progress-guide/bench-press",
    cues: [
      "Set your shoulder blades first, then keep the upper back pinned tight.",
      "Plant your feet and stay tight from the handoff to lockout.",
      "Touch the bar low on the chest and press back toward the shoulders.",
    ],
    videoUrl: "https://www.youtube.com/embed/t3f2L7NRRUY", // "Gym Shorts (How To):  Bench Press" - Barbell Logic
  },
  {
    liftType: "Deadlift",
    slug: "progress-guide/deadlift",
    cues: [
      "Start with the bar over mid-foot and bring your shins in only after you hinge down.",
      "Brace, squeeze the bar, and pull the slack out before the floor breaks.",
      "Keep the bar close up the legs and finish tall without leaning back.",
    ],
    videoUrl: "https://www.youtube.com/embed/3oMjoOm5O18", // "Gym Shorts (How To): The Deadlift" - Barbell Logic
  },
  {
    liftType: "Strict Press",
    slug: "progress-guide/strict-press",
    cues: [
      "Squeeze glutes and abs so the ribs stay down before the press starts.",
      "Stack wrists over elbows and begin with forearms close to vertical.",
      "Move your head back to clear the bar, then punch through to lockout.",
    ],
    videoUrl: "https://www.youtube.com/embed/AhGW3XFG3M8", // "Gym Shorts (How To): The Press" - Barbell Logic
  },
  {
    liftType: "Power Snatch",
    standardsRef: { liftType: "Strict Press", ratio: 0.85 },
    cues: [
      "Stay over the bar off the floor and keep the bar close as it passes the knees.",
      "Finish tall through the hips before you pull under.",
      "Punch fast into a stable overhead catch and stand under control.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=7Jn6uNdmbc0",
  },
  {
    liftType: "Romanian Deadlift",
    standardsRef: { liftType: "Deadlift", ratio: 0.7 },
    cues: [
      "Push the hips back and keep a soft bend in the knees.",
      "Let the bar trace the thighs and stay close to the legs the whole way down.",
      "Stop when the hamstrings are loaded, then drive the hips through to stand tall.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=amLSSb8cXok",
  },
  {
    liftType: "Power Clean",
    standardsRef: { liftType: "Deadlift", ratio: 0.6 },
    cues: [
      "Push through the floor smoothly and keep the bar close from mid-shin to hip.",
      "Finish the pull with violent leg and hip extension before the elbows turn over.",
      "Catch high on the shoulders with fast elbows and a solid front rack.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=mLoPwZx90SI",
  },
  {
    liftType: "Rack Pull",
    standardsRef: { liftType: "Deadlift", ratio: 1.1 },
    cues: [
      "Set the lats first and wedge into the bar before it leaves the pins.",
      "Keep the bar glued to the thighs and lock out by driving the hips through.",
      "Finish tall without leaning back or turning it into a backbend.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=0nJs6Cnfv3M",
  },
  {
    liftType: "Front Squat",
    standardsRef: { liftType: "Back Squat", ratio: 0.85 },
    cues: [
      "Keep the elbows high so the bar stays stacked on the shoulders.",
      "Brace hard and sit straight down between the hips instead of folding forward.",
      "Drive up with the chest tall and keep the rack position all the way through the rep.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=feGKhZ7unUg",
  },
  {
    liftType: "Barbell Row",
    standardsRef: { liftType: "Bench Press", ratio: 0.8 },
    cues: [
      "Set the back tight before the first rep and hold the torso angle steady.",
      "Pull the bar into the lower chest or upper stomach without jerking the hips.",
      "Lower the bar under control and re-brace before the next rep.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=qbES7k4HDf8",
  },
];

export const DEFAULT_ADD_LIFT_CHIPS = COACHED_LIFTS.filter(
  ({ liftType }) => !BIG_FOUR_LIFT_TYPE_SET.has(liftType),
).map(({ liftType }) => ({ name: liftType, icon: null }));
