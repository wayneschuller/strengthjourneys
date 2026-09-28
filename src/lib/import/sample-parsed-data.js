/**
 * The demo lifter every signed-out visitor sees: eight weeks of a novice linear
 * progression, three sessions a week, with the notes and form-check videos a
 * real log collects. Sessions are stored as days before the most recent one,
 * so the log always ends near today and reads like someone training this week.
 */

import { formatDateToYmdUtc, subtractDaysFromStr } from "@/lib/date-utils";

const DEMO_UNIT = "lb";

/**
 * The date the demo's most recent session falls on: today in UTC-12, the last
 * time zone to reach each new day. No visitor sees it in the future. In the
 * Americas it is today for most of the day, in Asia-Pacific it is yesterday.
 *
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD
 */
export function getDemoAnchorDate(now = new Date()) {
  return formatDateToYmdUtc(new Date(now.getTime() - 12 * 60 * 60 * 1000));
}

/**
 * The demo log as parsedData, sorted date ascending, its latest session on
 * anchorDate. The same anchor always gives the same rows, so a page rendered
 * on the server hydrates to exactly the sets it painted.
 *
 * @param {string} [anchorDate] - YYYY-MM-DD, see getDemoAnchorDate.
 * @returns {Array<{date, liftType, reps, weight, unitType, notes?, URL?}>}
 */
export function getDemoParsedData(anchorDate = getDemoAnchorDate()) {
  return DEMO_SESSIONS.flatMap(({ daysAgo, lifts }) => {
    const date = subtractDaysFromStr(anchorDate, daysAgo);
    return Object.entries(lifts).flatMap(([liftType, sets]) =>
      sets.map(([reps, weight, notes, URL]) => ({
        date,
        liftType,
        reps,
        weight,
        unitType: DEMO_UNIT,
        ...(notes && { notes }),
        ...(URL && { URL }),
      })),
    );
  });
}

// Oldest first. Each set is [reps, weight, notes?, videoUrl?], weights in lb.
// The last session is the one /log opens on, so it carries the showpieces: a
// squat PR, a press PR, a lift beyond the Big Four, and two filmed sets.
const DEMO_SESSIONS = [
  {
    daysAgo: 53,
    lifts: {
      "Back Squat": [
        [10, 45, "Empty bar feels heavier than I expected."],
        [5, 95],
        [5, 135],
        [5, 135],
        [5, 135, "First time under a barbell. Nervous but it felt natural."],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Watched a YouTube tutorial on bench setup during rest. Arch, retract, leg drive.",
        ],
        [5, 45],
        [5, 45, "Just the bar for now. Need to work on bar path."],
      ],
      Deadlift: [
        [10, 45],
        [
          5,
          95,
          "Deadlift grip already slipping at 95. Need chalk or something.",
        ],
        [5, 145, "Grip was the limiting factor, not legs."],
      ],
    },
  },
  {
    daysAgo: 51,
    lifts: {
      "Back Squat": [
        [10, 45, "6am session. Gym was empty. Just me and the janitor."],
        [5, 95],
        [5, 145, "Knees caving on the way up. Gotta push them out."],
        [5, 145],
        [5, 145, "Added 10lb since Monday. Feels like I could keep going."],
      ],
      "Strict Press": [
        [5, 45, "Why is the empty bar so heavy overhead??"],
        [
          5,
          45,
          "Big dude in a singlet squatted 500 like it was nothing. Life goals.",
        ],
        [5, 45, "Press is humbling. Hardest lift to progress."],
      ],
    },
  },
  {
    daysAgo: 49,
    lifts: {
      "Back Squat": [
        [10, 45, "Morning crew is growing on me. Same five guys every day."],
        [5, 95],
        [5, 155],
        [5, 155],
        [5, 155, "Bought a belt. Bracing feels way more solid now."],
      ],
      "Bench Press": [
        [10, 45, "Bench arch feels weird but it works. Trust the process."],
        [5, 55],
        [5, 55],
        [5, 55, "First time adding weight to bench. Small win."],
      ],
      Deadlift: [
        [10, 45],
        [5, 95, "Hook grip hurts but it holds. Pain is temporary."],
        [5, 170, "Pulled 170. Back felt fine. Focused on keeping it close."],
      ],
    },
  },
  {
    daysAgo: 46,
    lifts: {
      "Back Squat": [
        [10, 45, "Slept 9 hours. Warm-ups feel like butter today."],
        [5, 95],
        [3, 135, "135 is starting to feel light on squats. Wild."],
        [5, 160],
        [5, 160],
        [5, 160, "Legs still sore from Friday. Warm-ups helped."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Strict press warm-up is basically my working weight from last week.",
        ],
        [
          5,
          55,
          "Guy next to me was grunting so loud I almost laughed mid-set.",
        ],
        [5, 55],
        [5, 55, "Press at 55 now. Every pound is earned on this lift."],
      ],
    },
  },
  {
    daysAgo: 44,
    lifts: {
      "Back Squat": [
        [10, 45, "Forgot my belt at home. Bracing without it feels naked."],
        [3, 95],
        [2, 135],
        [5, 165],
        [5, 165],
        [
          5,
          165,
          "Two weeks in. Starting to understand what bracing really means.",
        ],
      ],
      "Bench Press": [
        [10, 45],
        [
          5,
          65,
          "Older guy gave me a nod after my set. Felt like a graduation.",
        ],
        [5, 65],
        [5, 65, "Bench at 65. Learning to use leg drive."],
      ],
      Deadlift: [
        [10, 45, "Deadlift day is best day. Fight me."],
        [5, 95],
        [
          5,
          135,
          "Mixed grip kicks in at 135. Need to train double overhand more.",
        ],
        [5, 190, "Almost at two plates. Can feel it coming."],
      ],
    },
  },
  {
    daysAgo: 42,
    lifts: {
      "Back Squat": [
        [10, 45, "Pre-workout hitting different today. Tingling everywhere."],
        [3, 95],
        [2, 135],
        [5, 170],
        [5, 170],
        [5, 170, "170 felt heavy today. Need more sleep."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Press warm-ups are basically meditation. Slow, controlled, painful.",
        ],
        [5, 60],
        [
          5,
          60,
          "Third set of press warm-ups. Arms already shaking. This lift humbles everyone.",
        ],
        [5, 60, "Finally got 60 overhead for all sets."],
      ],
    },
  },
  {
    daysAgo: 39,
    lifts: {
      "Back Squat": [
        [10, 45, "Foam rolled for 10 minutes before squats. Hips feel open."],
        [5, 95],
        [3, 135],
        [2, 160],
        [5, 175],
        [5, 175],
        [5, 175, "175. Slow grind on the last rep."],
      ],
      "Bench Press": [
        [10, 45, "Bench warm-up felt smooth. Good day incoming."],
        [5, 75, "Saw someone benching with their feet up. Chaotic energy."],
        [5, 75],
        [5, 75, "Bench is crawling but at least it is moving."],
      ],
      Deadlift: [
        [10, 45],
        [5, 95],
        [
          3,
          135,
          "135 deadlift used to be hard. Now it's a warm-up. Progress is real.",
        ],
        [5, 200, "200lb deadlift. Two plates next week?"],
      ],
    },
  },
  {
    daysAgo: 37,
    lifts: {
      "Back Squat": [
        [10, 45, "Forgot headphones. Gym music is... questionable."],
        [5, 95],
        [3, 135],
        [2, 160, "160 double feels crispy. Good speed off the bottom."],
        [5, 180],
        [5, 180],
        [5, 180, "180. Getting comfortable in the hole."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Honestly this is still kind of hard."],
        [5, 60, "Dude doing curls in the squat rack. Classic."],
        [5, 60],
        [5, 60, "Press stuck at 60 again. Third session in a row."],
      ],
    },
  },
  {
    daysAgo: 35,
    lifts: {
      "Back Squat": [
        [
          10,
          45,
          "Filmed my warm-up set for a form check.",
          "https://youtu.be/2kEC7X1FUIg?t=36",
        ],
        [5, 95, "Wrist wraps for squat day. Elbows thank me."],
        [3, 135],
        [2, 160],
        [5, 185],
        [5, 185],
        [5, 185, "185 for fives. A plate and change."],
      ],
      "Bench Press": [
        [
          10,
          45,
          "Empty bar bench. 50 reps to warm up the shoulders. Prehab is real.",
        ],
        [5, 80, "Guy in the corner deadlifting 600. The whole floor shook."],
        [5, 80],
        [5, 80, "Bench at 80. Tried pausing reps. Harder but cleaner."],
      ],
      Deadlift: [
        [10, 45],
        [5, 95],
        [3, 135, "135 deadlift triple. Beltless. Working on that brace."],
        [2, 185],
        [5, 215, "Switched to mixed grip. Night and day difference."],
      ],
    },
  },
  {
    daysAgo: 32,
    lifts: {
      "Back Squat": [
        [10, 45, "Coffee plus creatine plus a banana. The holy trinity."],
        [5, 95],
        [3, 135],
        [2, 160, "160 double. Paused at the bottom. Depth check: passed."],
        [2, 185],
        [5, 195],
        [5, 195],
        [5, 195, "Almost at 200. Can taste it."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Empty bar press. It's a relationship. We tolerate each other.",
        ],
        [
          5,
          65,
          "Regular crew is starting to recognize me. Head nods all around.",
        ],
        [5, 65],
        [5, 65, "Finally broke through 65. Microplates would help."],
      ],
    },
  },
  {
    daysAgo: 30,
    lifts: {
      "Back Squat": [
        [10, 45, "Knee sleeves on. War paint basically."],
        [5, 95],
        [3, 135],
        [2, 185],
        [5, 205],
        [5, 205],
        [5, 205],
        [5, 205, "Two plates on squat! Huge milestone. Took a month."],
      ],
      "Bench Press": [
        [
          10,
          45,
          "Empty bar bench. Shoulders clicking less these days. Warm-ups work.",
        ],
        [5, 95, "Someone asked ME for a spot. I have officially made it."],
        [5, 95],
        [5, 95, "Bench at 95. One plate per side on bench soon."],
      ],
      Deadlift: [
        [10, 45],
        [5, 95],
        [3, 135],
        [2, 185, "185 deadlift double. Straps or chalk? The eternal debate."],
        [5, 225, "Two plates on deadlift too. Good day."],
      ],
    },
  },
  {
    daysAgo: 28,
    lifts: {
      "Back Squat": [
        [10, 45, "Saturday morning. Gym is packed. Had to wait for a rack."],
        [5, 95],
        [3, 135],
        [2, 160],
        [2, 185, "185 double squat. Two plates is close. So close."],
        [5, 225],
        [5, 225],
        [5, 225, "225 for reps. A month ago I was squatting 135."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Press warm-up. Deep breath. Brace like your life depends on it.",
        ],
        [
          5,
          65,
          "Old guy in knee wraps told me my squat depth was good. Made my week.",
        ],
        [5, 65],
        [5, 65, "Press still at 65. Not giving up."],
      ],
    },
  },
  {
    daysAgo: 25,
    lifts: {
      "Back Squat": [
        [10, 45, "Holiday Monday. Gym was a ghost town. Had the whole place."],
        [5, 95],
        [
          3,
          135,
          "135 squat triple feels like a feather now. Body adapts fast.",
        ],
        [2, 185],
        [5, 235],
        [5, 235],
        [5, 235, "235. Every set felt solid. Recovery is good."],
      ],
      "Bench Press": [
        [
          10,
          45,
          "Empty bar bench. Thinking about grip width. Pinkies on the rings.",
        ],
        [
          5,
          105,
          "Gym buddy offered me chalk. This is what community feels like.",
        ],
        [5, 105],
        [5, 105, "Bench at 105. Slow and steady."],
      ],
    },
  },
  {
    daysAgo: 23,
    lifts: {
      "Back Squat": [
        [10, 45, "New playlist. PR energy. Let's go."],
        [5, 95],
        [3, 135],
        [2, 185],
        [5, 245],
        [5, 245],
        [5, 245, "245 felt like a wall. Finished but ugly."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Empty bar press. If you can press your bodyweight you're basically a god.",
        ],
        [5, 65],
        [5, 65],
        [5, 65, "Press stuck at 65. Going to try microplates."],
      ],
      Deadlift: [
        [10, 45],
        [5, 95, "Deadlift warm-ups feel snappy. Must be the sleep."],
        [3, 135],
        [2, 185],
        [5, 235, "Deadlift at 235. Chalk makes a difference."],
      ],
    },
  },
  {
    daysAgo: 21,
    lifts: {
      "Back Squat": [
        [10, 45, "Brought a buddy today. He lasted 45 minutes. Rookie."],
        [5, 95],
        [3, 135],
        [2, 185],
        [5, 255],
        [5, 255],
        [5, 255, "255. New PR. Had to grind the last rep."],
      ],
      "Bench Press": [
        [10, 45, "Bench warm-up. Spotted a guy doing 315. Someday."],
        [
          2,
          95,
          "Big dude asked to work in on squats. We pushed each other. Best session yet.",
        ],
        [5, 115],
        [5, 115, "Second set of bench. Groove is locked in today."],
        [5, 115, "Bench 115. Getting serious about arch and setup."],
      ],
    },
  },
  {
    daysAgo: 18,
    lifts: {
      "Back Squat": [
        [
          10,
          45,
          "Started stretching hip flexors before squats. Why didn't I do this sooner.",
        ],
        [5, 95],
        [3, 135],
        [2, 185],
        [
          1,
          225,
          "225 single. Two plates on the bar for the first time in squats. Paused for a photo.",
        ],
        [5, 265],
        [5, 265],
        [5, 265, "265! Heaviest squat ever. Walked it out clean."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Press warm-up. Elbows tucked. Squeeze glutes. Whole body lift.",
        ],
        [5, 70],
        [5, 70],
        [5, 70, "Press finally at 70. Microplates arrived."],
      ],
    },
  },
  {
    daysAgo: 16,
    lifts: {
      "Back Squat": [
        [
          10,
          45,
          "Deload week but still showing up. Discipline over motivation.",
        ],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 245],
        [5, 245],
        [5, 245, "Slept terribly. Dropped weight 20lb and focused on form."],
      ],
      "Bench Press": [
        [10, 45, "Empty bar bench. Recovery week. Ego stays at the door."],
        [
          2,
          95,
          "Older lifter showed me how to set my shoulder blades for bench. Game changer.",
        ],
        [5, 115],
        [5, 115],
        [5, 115, "Bench holding at 115. Not forcing it today."],
      ],
      Deadlift: [
        [10, 45, "Deadlift warm-ups on deload feel like playing with toys."],
        [5, 95],
        [3, 135],
        [2, 185],
        [5, 245, "245 deadlift. Straps on back-off sets."],
      ],
    },
  },
  {
    daysAgo: 14,
    lifts: {
      "Back Squat": [
        [10, 45, "Back from deload. Feeling fresh and angry. Good combo."],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 255],
        [5, 255],
        [5, 255, "255 again. Rebuilt after the deload. Felt better this time."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Press warm-up. The bar path is finally starting to make sense.",
        ],
        [5, 75],
        [5, 75, "Second press warm-up. Lockout is getting stronger."],
        [5, 75, "Press hit 75! Five pounds from a plate."],
      ],
      "Power Clean": [
        [3, 45, "First power cleans. Think jump, not curl."],
        [3, 65],
        [3, 65],
        [3, 65, "Mostly a high pull so far. It will come."],
      ],
    },
  },
  {
    daysAgo: 11,
    lifts: {
      "Back Squat": [
        [
          10,
          45,
          "Gym smells like victory and old rubber. Wouldn't have it any other way.",
        ],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 260],
        [5, 260],
        [5, 260, "260. Inching forward."],
      ],
      "Bench Press": [
        [
          10,
          45,
          "Empty bar bench. Scapula pinch is automatic now. Muscle memory.",
        ],
        [2, 95, "Morning crew is the best crew. Everyone just gets after it."],
        [5, 120],
        [5, 120, "Bench is clicking. Elbows at 45 degrees. Smooth."],
        [5, 120, "Bench moving again. 135 feels close."],
      ],
    },
  },
  {
    daysAgo: 9,
    lifts: {
      "Back Squat": [
        [10, 45, "5am alarm. No snooze. This is who I am now."],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 265],
        [5, 265],
        [5, 265, "265 again. Matched my PR. Felt easier this time."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Press warm-up. Breathing and bracing pattern finally feels natural.",
        ],
        [5, 75],
        [5, 75],
        [5, 75, "Held at 75. Not every session is a PR."],
      ],
      Deadlift: [
        [
          10,
          45,
          "Deadlift warm-up. Hinging feels completely different than week one.",
        ],
        [5, 95],
        [3, 135],
        [2, 185],
        [5, 265, "Deadlift flying past squat now. Three plates is the goal."],
      ],
    },
  },
  {
    daysAgo: 7,
    lifts: {
      "Back Squat": [
        [10, 45, "Put chalk on before warm-ups now. It's a ritual."],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 270],
        [5, 270],
        [5, 270, "270. New territory. Walked it out with confidence."],
      ],
      "Bench Press": [
        [
          10,
          45,
          "Empty bar bench. Focused on tempo. 2 seconds down, pause, explode up.",
        ],
        [
          2,
          95,
          "Guy complimented my Rippetoe shirt. We talked programming for 20 minutes.",
        ],
        [5, 125],
        [
          5,
          125,
          "Third set bench warm-up. Shoulder health has never been better.",
        ],
        [5, 125, "Bench at 125. Ten pounds from a plate per side."],
      ],
    },
  },
  {
    daysAgo: 4,
    lifts: {
      "Back Squat": [
        [
          10,
          45,
          "Rest day yesterday. Legs feel springy. Squats gonna move today.",
        ],
        [5, 95],
        [3, 135],
        [2, 185],
        [1, 225],
        [5, 275],
        [5, 275],
        [5, 275, "275. Five more pounds to three plates."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Empty bar press. Starting to enjoy this lift. Stockholm syndrome maybe.",
        ],
        [5, 75],
        [
          5,
          75,
          "Press warm-up. 75 used to be my working weight. Now it's a warm-up set.",
        ],
        [5, 75, "Press holding at 75. Patience."],
      ],
      "Power Clean": [
        [3, 45],
        [3, 75],
        [3, 75],
        [
          3,
          75,
          "Caught it in a quarter squat for once. That snap is addictive.",
        ],
      ],
    },
  },
  {
    daysAgo: 2,
    lifts: {
      "Back Squat": [
        [10, 45, "Wore my lucky socks. Yes it matters. Don't question it."],
        [5, 95],
        [3, 135],
        [2, 185],
        [2, 225],
        [1, 255],
        [5, 280],
        [5, 280],
        [5, 280, "280 squat. 300 by end of summer is happening."],
      ],
      "Bench Press": [
        [10, 45],
        [2, 95, "The regulars cheer when someone hits a PR. This gym rules."],
        [5, 125],
        [5, 125],
        [
          5,
          125,
          "Filmed bench for form check. Setup is getting dialed in.",
          "https://www.youtube.com/watch?v=jTQTiW_g2pU",
        ],
      ],
      Deadlift: [
        [
          10,
          45,
          "Deadlift warm-up. Lat engagement cue finally clicked. Pull the slack out.",
        ],
        [5, 95],
        [3, 135],
        [
          2,
          185,
          "185 deadlift double. This is just a warm-up now. Absolutely wild.",
        ],
        [
          5,
          265,
          "265 again. Smooth lockout. Filmed it.",
          "https://www.youtube.com/watch?v=2kEC7X1FUIg",
        ],
      ],
    },
  },
  {
    daysAgo: 0,
    lifts: {
      "Back Squat": [
        [10, 45, "Eight weeks in. This program is working."],
        [5, 95],
        [
          3,
          135,
          "Two months ago the empty bar felt heavy. Now 135 is a warm-up.",
        ],
        [2, 185],
        [2, 225],
        [1, 255],
        [5, 285],
        [5, 285],
        [
          5,
          285,
          "285 for three sets of five. 300 is right there. Best session yet.",
          "https://www.youtube.com/watch?v=qgbnLdH4qjc",
        ],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Still humbling, and I keep showing up."],
        [5, 65],
        [5, 80, "Microplates paid off."],
        [5, 80],
        [
          5,
          80,
          "80 for all three sets. First press PR in two weeks.",
          "https://www.youtube.com/watch?v=WnJd42b3EfI",
        ],
      ],
      "Power Clean": [
        [3, 45],
        [3, 65],
        [3, 85],
        [3, 85],
        [3, 85, "Racking it on the shoulders now, not the wrists."],
      ],
    },
  },
];
