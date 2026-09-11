/**
 * Log-page coaching metadata for lift suggestions and technique assistance.
 * Canonical Big Four identity/path/icon data lives in src/lib/big-four-lifts.js.
 *
 * Each `summary` is one plain sentence for someone who has never seen the lift:
 * the artwork is all they have (and not every lift is drawn), so it says where
 * the bar starts and what a full rep looks like before the cues refine it.
 */

import { BIG_FOUR_LIFT_TYPE_SET } from "@/lib/big-four-lifts";

export const COACHED_LIFTS = [
  {
    liftType: "Back Squat",
    slug: "progress-guide/squat",
    summary:
      "Take the bar from a rack onto your upper back, squat until your hips sink below your knees, then stand back up.",
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
    summary:
      "Lie on a flat bench, unrack the bar over your chest at arm's length, lower it to touch your chest, then press it back up.",
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
    summary:
      "Grip the bar on the floor just outside your legs, stand up tall with it, then lower it back to the floor.",
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
    summary:
      "Standing, take the bar from a rack onto the front of your shoulders and press it straight overhead to locked arms, with no help from your legs.",
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
    summary:
      "In one fast pull, take the bar from the floor straight overhead on a wide grip, catch it on locked arms in a half squat, then stand up.",
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
    summary:
      "Start standing with the bar at your hips, push your hips back so it slides down your legs until your hamstrings stretch, then stand back up.",
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
    summary:
      "In one fast pull, take the bar from the floor onto the front of your shoulders, catch it with elbows up in a half squat, then stand up.",
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
    summary:
      "Rest the bar on rack pins or blocks around knee height, grip it, and stand up tall, like the top half of a deadlift.",
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
    summary:
      "Take the bar from a rack onto the front of your shoulders with elbows pointing forward, squat until your hips sink below your knees, then stand back up.",
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
    summary:
      "Hold the bar at arm's length, lean forward from the hips with a flat back, then pull the bar up to your stomach and lower it again.",
    cues: [
      "Set the back tight before the first rep and hold the torso angle steady.",
      "Pull the bar into the lower chest or upper stomach without jerking the hips.",
      "Lower the bar under control and re-brace before the next rep.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=qbES7k4HDf8",
  },
  {
    liftType: "Hip Thrust",
    // Most lifters thrust more than they squat, so 1.0 starts on the light side.
    standardsRef: { liftType: "Back Squat", ratio: 1.0 },
    summary:
      "Sit on the floor with your upper back against a bench and the bar across your hips, then drive your hips up until shoulders, hips and knees line up.",
    cues: [
      "Rest the bench just under your shoulder blades and pad the bar in the hip crease.",
      "Tuck the chin and keep the ribs down so the hips do the work, not the lower back.",
      "Drive through the heels to full lockout with shins vertical, then lower under control.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=pF17m_CXfL0", // "Hip Thrust Tutorial - Proper Form and Technique" - Runna
  },
  {
    liftType: "Overhead Squat",
    // Mobility caps this well below the back squat for most people starting out.
    standardsRef: { liftType: "Back Squat", ratio: 0.5 },
    summary:
      "Take the bar from a rack onto your back, press it overhead on a wide grip, then squat until your hips sink below your knees and stand back up, arms locked throughout.",
    cues: [
      "Take a wide grip, lock the elbows, and press up into the bar before you descend.",
      "Keep the bar stacked over mid-foot and sit straight down between the hips.",
      "Keep pushing up into the bar and stand without letting it drift forward.",
    ],
    videoUrl: "https://www.youtube.com/watch?v=pn8mqlG0nkE", // "The Overhead Squat" - CrossFit
  },
];

export const DEFAULT_ADD_LIFT_CHIPS = COACHED_LIFTS.filter(
  ({ liftType }) => !BIG_FOUR_LIFT_TYPE_SET.has(liftType),
).map(({ liftType }) => ({ name: liftType, icon: null }));
