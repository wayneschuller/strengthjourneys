/**
 * The demo lifter every signed-out visitor sees: a man twelve weeks into
 * Starting Strength, the classic novice linear progression. Workouts A (squat,
 * press, deadlift) and B (squat, bench, deadlift) alternate three days a week;
 * from week seven power cleans replace the deadlift on B days. Every working
 * set goes up each session, with the stalls and one reset a real novice hits.
 *
 * Sessions are stored as days before the most recent one, so the log always
 * ends near today and reads like someone training this week.
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
// Warm-ups climb the plates the way a lifter loads them.
//
// Every lift opens with a note on its first set, the first thing a demo
// visitor reads, and two or three notes per lift tell the story as the lifter
// lived it: the empty 6am gym, the morning crew, buying a belt and chalk, the
// first failed squat and the reset that got him through.
//
// The last session is the one /log opens on: a filmed squat PR, the press
// finally beating 120, and a deadlift PR. The "form check" videos are famous
// record lifts, a joke for whoever taps one to see what a video link does.
const DEMO_SESSIONS = [
  {
    daysAgo: 81,
    lifts: {
      "Back Squat": [
        [
          5,
          45,
          "Day one of Starting Strength. Read the book twice. The empty bar is heavier than it looks.",
        ],
        [5, 45],
        [2, 95, "First plates on the bar. Hips back, bar over midfoot."],
        [5, 135],
        [5, 135],
        [5, 135, "135 for three sets of five. Nervous, but it felt natural."],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Watched a bench setup video last night. Shoulder blades back, feet planted.",
        ],
        [5, 45],
        [2, 95, "Bar touches just below the chest. Feels weird, works."],
        [5, 115],
        [5, 115],
        [5, 115, "115 for 3x5. Starting light like the book says."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Bar over midfoot, shins touching it."],
        [5, 185, "One set of five. The book says that is all it takes."],
      ],
    },
  },
  {
    daysAgo: 79,
    lifts: {
      "Back Squat": [
        [
          5,
          45,
          "Sore everywhere from the first session. The empty bar sets helped.",
        ],
        [5, 45],
        [2, 95, "Warm-ups loosened the soreness right up."],
        [5, 145],
        [5, 145],
        [5, 145, "145. Knees caved on the way up. Knees out next time."],
      ],
      "Strict Press": [
        [5, 45, "Why is the empty bar so heavy overhead?"],
        [5, 45],
        [2, 65, "Elbows in front of the bar. Chest up."],
        [5, 75],
        [5, 75],
        [5, 75, "75 for three sets. The press is humbling."],
      ],
      Deadlift: [
        [5, 135, "Grip already tired from the press. Chalk might be a thing."],
        [
          5,
          200,
          "200 for five. Dragged the bar up my legs like the book says.",
        ],
      ],
    },
  },
  {
    daysAgo: 77,
    lifts: {
      "Back Squat": [
        [5, 45, "6am session. The gym was empty. Just me and the cleaner."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 155, "155. Knees out and it went up straight."],
        [5, 155],
        [5, 155, "Rest days are doing their job. Legs felt good."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Shoulders click a little. Warm-ups help."],
        [5, 45],
        [2, 95, "95 feels solid now. Leg drive on."],
        [5, 120],
        [5, 120],
        [5, 120, "120 for 3x5. Smooth."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Big breath in and hold it."],
        [2, 185, "185 for two. Fast off the floor."],
        [5, 215, "215. Grip was the limit, not my legs."],
      ],
    },
  },
  {
    daysAgo: 74,
    lifts: {
      "Back Squat": [
        [5, 45, "Week two. Same 6am crew. Nobody talks, everyone nods."],
        [5, 45],
        [3, 95, "Pushing my knees out on every warm-up rep now."],
        [2, 135],
        [5, 165],
        [5, 165, "Knees out fixed it. Every rep came up straight."],
        [5, 165],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Chin back, bar back over my head."],
        [5, 45],
        [2, 65],
        [5, 80],
        [
          5,
          80,
          "Lost the bar forward on a rep. Squeezed my glutes and it fixed it.",
        ],
        [5, 80, "Press at 80. Every pound is earned on this lift."],
      ],
      Deadlift: [
        [
          5,
          135,
          "Deadlift warm-up. Hips higher than a squat, that is the trick.",
        ],
        [2, 185, "185 double. Fast."],
        [5, 225, "225. Two plates on the deadlift in week two."],
      ],
    },
  },
  {
    daysAgo: 72,
    lifts: {
      "Back Squat": [
        [
          5,
          45,
          "Same five people here every morning. Starting to recognize faces.",
        ],
        [5, 45],
        [3, 95, "The bar sits on my back better now."],
        [2, 135],
        [5, 175],
        [5, 175],
        [
          5,
          175,
          "175. Hips back, chest up, drive the hips. It is starting to click.",
        ],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Empty bar bench. Arch and pin the shoulders before unracking.",
        ],
        [5, 45],
        [2, 95, "Warm-ups feel smooth today."],
        [5, 125],
        [5, 125],
        [5, 125, "125. Leg drive makes the bench feel way more stable."],
      ],
      Deadlift: [
        [5, 135, "135 warm-up. Pull the slack out, then pull the bar."],
        [2, 185, "185 for two. The bar clicks when the slack comes out."],
        [5, 235, "235 for five. Back stayed flat the whole way."],
      ],
    },
  },
  {
    daysAgo: 70,
    lifts: {
      "Back Squat": [
        [5, 45, "Pre-workout hitting different today. Tingling everywhere."],
        [5, 45, "Slept nine hours. Warm-ups felt like butter."],
        [3, 95],
        [2, 135],
        [5, 185],
        [5, 185],
        [5, 185, "185 for three sets. Last ten pound jump, fives from here."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Starting to groove the bar path."],
        [5, 45],
        [2, 65, "65 double. Tight from head to toe."],
        [5, 85],
        [5, 85],
        [5, 85, "85 overhead. Squeezing my glutes stops me leaning back."],
      ],
      Deadlift: [
        [5, 135, "135 used to be heavy. Now it is the first warm-up."],
        [2, 185, "185 feels like nothing today."],
        [5, 245, "245. Grip hung on for the last rep."],
      ],
    },
  },
  {
    daysAgo: 67,
    lifts: {
      "Back Squat": [
        [5, 45, "Bought a belt. Bracing feels way more solid."],
        [5, 45],
        [3, 95, "Figuring out the belt. One notch looser than I thought."],
        [2, 135],
        [5, 190],
        [5, 190],
        [5, 190, "190. The belt made the last set feel easy."],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Empty bar bench. Big guy in a singlet benched 405 next to me. Life goals.",
        ],
        [5, 45],
        [2, 95, "95 warm-up. Wrists stacked over elbows."],
        [5, 130],
        [5, 130],
        [
          5,
          130,
          "130. Older guy gave me a nod after my last set. Felt like a graduation.",
        ],
      ],
      Deadlift: [
        [5, 135, "Deadlift day is the best day."],
        [3, 185],
        [2, 225, "225 double. Bar close, lats tight."],
        [5, 255, "255 for five. Easy speed."],
      ],
    },
  },
  {
    daysAgo: 65,
    lifts: {
      "Back Squat": [
        [5, 45, "Legs still sore from last session. Warm-ups helped."],
        [5, 45],
        [3, 95, "95 for five. Staying patient with the warm-ups."],
        [2, 135],
        [5, 195],
        [5, 195],
        [5, 195, "195. Slow grind on the last rep, but it came up."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press is basically meditation now."],
        [5, 45],
        [2, 65, "Slow and controlled on the warm-ups."],
        [5, 90],
        [5, 90],
        [5, 90, "Press at 90. Every rep is a fight at the top."],
      ],
      Deadlift: [
        [5, 135, "Dude doing curls in the squat rack. Classic."],
        [3, 185],
        [2, 225],
        [5, 265, "265. My grip is starting to get tested."],
      ],
    },
  },
  {
    daysAgo: 63,
    lifts: {
      "Back Squat": [
        [5, 45, "Three weeks in. Starting to look forward to 6am."],
        [5, 45],
        [3, 95, "The warm-ups feel like a ritual now."],
        [2, 135],
        [5, 200],
        [5, 200],
        [5, 200, "Squatted 200 for the first time. Week three."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Shoulders clicking less these days."],
        [5, 45],
        [2, 95, "95 for two. Setup feels automatic now."],
        [5, 135],
        [5, 135],
        [5, 135, "135 for three sets. A plate on each side!"],
      ],
      Deadlift: [
        [
          5,
          135,
          "Deadlift warm-up. Hinging feels completely different than week one.",
        ],
        [3, 185],
        [2, 225],
        [
          5,
          275,
          "275 moved fast. Someone in the corner pulled 600 and the floor shook.",
        ],
      ],
    },
  },
  {
    daysAgo: 60,
    lifts: {
      "Back Squat": [
        [5, 45, "Coffee, creatine and a banana. The holy trinity."],
        [5, 45],
        [3, 95, "95. Depth feels automatic now."],
        [2, 135],
        [5, 205],
        [5, 205],
        [5, 205, "205. Getting comfortable in the hole."],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Empty bar press. It is a relationship. We tolerate each other.",
        ],
        [5, 45],
        [3, 65, "65 warm-up. Breathing and bracing finally feel natural."],
        [2, 85],
        [5, 95],
        [5, 95],
        [5, 95, "95 on the press. Five pounds from a plate."],
      ],
      Deadlift: [
        [
          5,
          135,
          "Deadlift warm-up. Beltless on purpose, working on the brace.",
        ],
        [3, 185],
        [2, 225],
        [5, 280, "280. Grip slipped on the last rep. Buying chalk."],
      ],
    },
  },
  {
    daysAgo: 58,
    lifts: {
      "Back Squat": [
        [5, 45, "Foam rolled before squats. Why didn't I do this sooner?"],
        [5, 45],
        [5, 95],
        [3, 135, "135 for three. That was my working weight on day one."],
        [2, 185],
        [5, 210],
        [5, 210],
        [5, 210, "210. Asked a regular to watch my depth. All below parallel."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Pinkies on the rings, grip feels right."],
        [5, 45],
        [2, 95, "95. Bar path is a straight line now."],
        [5, 140],
        [5, 140],
        [
          5,
          140,
          "140. Someone asked ME for a spot. I have officially made it.",
        ],
      ],
      Deadlift: [
        [5, 135, "Bought chalk on the way here."],
        [3, 185],
        [2, 225],
        [5, 285, "Chalk works. 285 stayed in my hands."],
      ],
    },
  },
  {
    daysAgo: 56,
    lifts: {
      "Back Squat": [
        [5, 45, "Forgot my headphones. The gym music is questionable."],
        [5, 45],
        [5, 95],
        [3, 135, "135 triple. Feels light now."],
        [2, 185],
        [5, 215],
        [5, 215],
        [5, 215, "215. Belt, brace, down, up."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Microplates in my gym bag."],
        [5, 45],
        [3, 65],
        [2, 85],
        [5, 97.5, "Microplates arrived. The press goes up 2.5 at a time now."],
        [5, 97.5],
        [5, 97.5, "97.5 for three sets. Small jumps work."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Chalk on first."],
        [3, 185],
        [2, 225],
        [5, 290, "290. The deadlift is flying past the squat."],
      ],
    },
  },
  {
    daysAgo: 53,
    lifts: {
      "Back Squat": [
        [5, 45, "Eating a lot more. Up six pounds of bodyweight."],
        [5, 45],
        [5, 95, "Warm-ups feel strong. The food is working."],
        [3, 135],
        [2, 185],
        [5, 220],
        [5, 220],
        [5, 220, "220 and the squat keeps moving."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Two seconds down on every rep."],
        [5, 45],
        [2, 95, "95 warm-up. Straight bar path from the rack."],
        [5, 145],
        [5, 145],
        [5, 145, "145. Pausing the bar on my chest keeps it honest."],
      ],
      Deadlift: [
        [
          5,
          135,
          "Deadlift warm-up. Pull the slack out, then push the floor away.",
        ],
        [3, 185],
        [2, 225, "225 double. Chalk everywhere."],
        [5, 295, "295. Five short of 300."],
      ],
    },
  },
  {
    daysAgo: 51,
    lifts: {
      "Back Squat": [
        [5, 45, "Knee sleeves on. War paint, basically."],
        [5, 45],
        [5, 95],
        [3, 135, "Paused the 135 at the bottom. Depth check passed."],
        [2, 185],
        [5, 225],
        [5, 225],
        [5, 225, "225 for all three sets. Two plates on the squat!"],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Triple digits today, I can feel it."],
        [5, 45],
        [3, 65],
        [2, 85],
        [5, 100],
        [5, 100, "Second set at 100. Lockout is getting stronger."],
        [5, 100, "100 overhead. Triple digits on the press."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Lats tight, bar close."],
        [3, 185],
        [2, 225],
        [5, 300, "Deadlift 300. Did not expect that this soon."],
      ],
    },
  },
  {
    daysAgo: 49,
    lifts: {
      "Back Squat": [
        [5, 45, "Had to wait for a rack today. Busy morning."],
        [5, 45],
        [5, 95, "Got the old rack by the window. Sunrise squats."],
        [3, 135],
        [2, 185],
        [5, 230],
        [5, 230],
        [5, 230, "230. Strong from start to finish."],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Empty bar bench. A new guy asked me how to set up. I showed him.",
        ],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 150],
        [5, 150, "Second set at 150 had the best bar speed yet."],
        [5, 150, "150 for three sets. The bench is really moving now."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. The lat cue finally clicked."],
        [3, 185],
        [2, 225],
        [5, 305, "305. Slack out before it leaves the floor. That cue works."],
      ],
    },
  },
  {
    daysAgo: 46,
    lifts: {
      "Back Squat": [
        [5, 45, "Foam rolled for ten minutes first. Hips feel open."],
        [5, 45],
        [5, 95],
        [3, 135, "135 feels like a feather now."],
        [2, 185],
        [5, 235],
        [5, 235],
        [
          5,
          235,
          "235. Older lifter in knee wraps said my depth looks good. Made my week.",
        ],
      ],
      "Strict Press": [
        [
          5,
          45,
          "Empty bar press. Elbows tucked, glutes squeezed, whole body lift.",
        ],
        [5, 45],
        [3, 65, "65. Crisp."],
        [2, 85],
        [5, 102.5],
        [5, 102.5],
        [5, 102.5, "102.5. Small jumps, still jumps."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. 135 barely feels like weight."],
        [5, 185],
        [3, 225],
        [2, 275, "275 for two. Snappy."],
        [5, 310, "310. Three plates is next."],
      ],
    },
  },
  {
    daysAgo: 44,
    lifts: {
      "Back Squat": [
        [5, 45, "Brought a buddy today. He lasted 45 minutes."],
        [5, 45],
        [5, 95, "Showed my buddy how to warm up. He is sore already."],
        [3, 135],
        [2, 185],
        [5, 240],
        [5, 240],
        [5, 240, "240. Buddy says he is coming back. We'll see."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Buddy is watching from the next bench."],
        [5, 45],
        [3, 95, "95. Setup is automatic now."],
        [2, 135],
        [5, 155],
        [5, 155],
        [
          5,
          155,
          "155. A regular showed me how to pin my shoulder blades. Game changer.",
        ],
      ],
      Deadlift: [
        [5, 135, "Three plates day. Chalk, belt, deep breath."],
        [5, 185],
        [3, 225],
        [2, 275, "275 double. Ready."],
        [5, 315, "315 for five. Three plates on the deadlift!"],
      ],
    },
  },
  {
    daysAgo: 42,
    lifts: {
      "Back Squat": [
        [5, 45, "Rest day yesterday. Legs feel springy."],
        [5, 45],
        [5, 95],
        [3, 135, "135 for three. Feels light, which is funny."],
        [2, 185],
        [5, 245],
        [5, 245],
        [5, 245, "Six weeks in and the squat is up 110 pounds."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Starting to enjoy this lift."],
        [5, 45],
        [3, 65, "65 warm-up. The bar path finally makes sense."],
        [2, 85],
        [5, 105],
        [5, 105],
        [5, 105, "105 for three sets. Grinding, but every rep went up."],
      ],
      Deadlift: [
        [5, 135, "Last deadlift day before power cleans come in."],
        [5, 185],
        [3, 225],
        [2, 275],
        [5, 320, "320. Straps stayed in the bag."],
      ],
    },
  },
  {
    daysAgo: 39,
    lifts: {
      "Back Squat": [
        [5, 45, "Long day at work. Came in anyway."],
        [5, 45],
        [5, 95, "The warm-ups shook the day off."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 250],
        [5, 250],
        [5, 250, "250. Every rep, no excuses."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Microplates for the bench now too."],
        [5, 45],
        [3, 95, "95. Speed off the chest."],
        [2, 135],
        [5, 157.5],
        [5, 157.5],
        [5, 157.5, "157.5. Small jumps on the bench from here."],
      ],
      "Power Clean": [
        [
          3,
          45,
          "Power cleans start today. Jump, shrug, catch it on the shoulders.",
        ],
        [3, 45],
        [1, 75, "75. More reverse curl than clean, honestly."],
        [3, 95],
        [3, 95],
        [3, 95],
        [3, 95],
        [
          3,
          95,
          "Five sets of three at 95. Mostly high pulls, but I racked a few.",
        ],
      ],
    },
  },
  {
    daysAgo: 37,
    lifts: {
      "Back Squat": [
        [5, 45, "Slept badly. Took the warm-ups slow."],
        [5, 45],
        [5, 95],
        [5, 135, "135 felt heavy today. Kept going."],
        [3, 185],
        [2, 225],
        [5, 255],
        [5, 255],
        [5, 255, "255. Slept badly, finished every rep anyway."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. The regulars know my name now."],
        [5, 45],
        [3, 65, "65. Straight up past my face."],
        [2, 85],
        [5, 107.5],
        [5, 107.5],
        [5, 107.5, "107.5. Ground out the last rep."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Missed pulling last session."],
        [5, 185],
        [3, 225],
        [2, 275],
        [5, 325, "325. Chalk everywhere. Worth it."],
      ],
    },
  },
  {
    daysAgo: 35,
    lifts: {
      "Back Squat": [
        [5, 45, "Someone curling in the squat rack again. Classic."],
        [5, 45],
        [5, 95, "Waited for the rack, then warmed up. Patience."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 260],
        [5, 260],
        [5, 260, "260. Worth the wait."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. My shoulders have never felt better."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 160],
        [5, 160, "The second set at 160 felt easier than the first."],
        [5, 160, "160 for three sets."],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Jump, don't pull with the arms."],
        [3, 45],
        [1, 75, "75. Getting the elbows round faster."],
        [3, 100],
        [3, 100],
        [3, 100],
        [3, 100],
        [3, 100, "100. Catching the clean on my shoulders now, not my wrists."],
      ],
    },
  },
  {
    daysAgo: 32,
    lifts: {
      "Back Squat": [
        [
          5,
          45,
          "Gym smells like old rubber and chalk. Wouldn't have it any other way.",
        ],
        [5, 45],
        [5, 95],
        [5, 135, "135 for five. Sat right back into it."],
        [3, 185],
        [2, 225],
        [5, 265],
        [5, 265],
        [5, 265, "265. Heaviest squat yet, walked it out clean."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Still humbling, and I keep showing up."],
        [5, 45],
        [3, 65, "65 warm-up. Fast off the shoulders."],
        [2, 85],
        [5, 110],
        [5, 110],
        [5, 110, "110 overhead. Every rep a fight."],
      ],
      Deadlift: [
        [5, 135, "Trying the hook grip today. Thumbs under the fingers."],
        [5, 185],
        [3, 225],
        [2, 275, "275 double with the hook grip. It hurts. It holds."],
        [
          5,
          330,
          "Hook grip at 330. Thumbs hurt, the bar did not move in my hands.",
        ],
      ],
    },
  },
  {
    daysAgo: 30,
    lifts: {
      "Back Squat": [
        [5, 45, "Resting five minutes between work sets now."],
        [5, 45],
        [5, 95, "Warm-ups: bar, 95, 135, 185, 225. The ritual."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 270],
        [5, 270],
        [5, 270, "270. Five minutes rest and every set went up."],
      ],
      "Bench Press": [
        [
          5,
          45,
          "Empty bar bench. The 600 pound deadlifter is back in the corner.",
        ],
        [5, 45],
        [3, 95, "95. Two seconds down, then drive."],
        [2, 135],
        [5, 162.5],
        [5, 162.5],
        [5, 162.5, "162.5. Solid."],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Bar close, jump, elbows fast."],
        [3, 45],
        [1, 75, "75. Starting to feel the hip snap."],
        [3, 105],
        [3, 105],
        [3, 105],
        [3, 105],
        [3, 105, "105. The snap under the bar is addictive."],
      ],
    },
  },
  {
    daysAgo: 28,
    lifts: {
      "Back Squat": [
        [5, 45, "5am alarm, no snooze. This is who I am now."],
        [5, 45],
        [5, 95],
        [5, 135, "135. Warm-ups on autopilot."],
        [3, 185],
        [2, 225],
        [5, 275],
        [5, 275],
        [5, 275, "275. 5am squats hit different."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Deep breath, brace, drive."],
        [5, 45],
        [3, 65, "65. Every rep crisp."],
        [2, 85],
        [5, 112.5],
        [5, 112.5],
        [
          5,
          112.5,
          "112.5 for three sets. The microplates are doing their job.",
        ],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Set my phone on the floor to film today."],
        [5, 185],
        [3, 225],
        [2, 275],
        [
          5,
          335,
          "Filmed my deadlift for a form check. Lockout looks solid.",
          "https://www.youtube.com/watch?v=2kEC7X1FUIg",
        ],
      ],
    },
  },
  {
    daysAgo: 25,
    lifts: {
      "Back Squat": [
        [5, 45, "The regulars cheer when someone PRs. This gym rules."],
        [5, 45],
        [5, 95, "Warm-ups with the morning crew watching."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 280],
        [5, 280],
        [5, 280, "280. Got a cheer on the last rep."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Propped my phone on a plate to film."],
        [5, 45],
        [3, 95, "95. Checked the camera angle."],
        [2, 135],
        [5, 165],
        [5, 165],
        [
          5,
          165,
          "Filmed my last set of bench. Arch and leg drive feel dialed in.",
          "https://www.youtube.com/watch?v=jTQTiW_g2pU",
        ],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Elbows fast."],
        [3, 45],
        [3, 75, "75 for three. Smooth."],
        [1, 95],
        [3, 110],
        [3, 110],
        [3, 110],
        [3, 110],
        [3, 110, "110 cleans. Racking them clean now."],
      ],
    },
  },
  {
    daysAgo: 23,
    lifts: {
      "Back Squat": [
        [5, 45, "Every set is a real effort now. Big breakfast."],
        [5, 45],
        [5, 95],
        [5, 135, "135. Moving well."],
        [3, 185],
        [2, 225],
        [5, 285],
        [5, 285],
        [5, 285, "285. Heavy, but all fifteen reps."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. 115 on the bar today."],
        [5, 45],
        [3, 65],
        [2, 85],
        [5, 115],
        [5, 115, "The second set at 115 was a real grind."],
        [
          4,
          115,
          "First missed rep on the press. Four on the last set. Same weight next time.",
        ],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Shook off the press."],
        [5, 185],
        [3, 225],
        [2, 275],
        [5, 340, "340. The deadlift does not care how the press went."],
      ],
    },
  },
  {
    daysAgo: 21,
    lifts: {
      "Back Squat": [
        [5, 45, "Wore my lucky socks. Yes, it matters."],
        [5, 45],
        [5, 95, "Warm-ups in the lucky socks. Feeling good."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 290],
        [5, 290],
        [5, 290, "290. These are getting heavy."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Still the first thing I do, every time."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 167.5],
        [5, 167.5, "167.5 for five. The groove is locked in."],
        [5, 167.5, "167.5. Two months ago 115 felt heavy."],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Hips through, then drop."],
        [3, 45],
        [3, 75, "75. Getting faster under the bar."],
        [1, 95],
        [3, 115],
        [3, 115],
        [3, 115],
        [3, 115],
        [3, 115, "115. Racked every rep."],
      ],
    },
  },
  {
    daysAgo: 18,
    lifts: {
      "Back Squat": [
        [5, 45, "One more jump to three plates."],
        [5, 45],
        [5, 95],
        [5, 135, "135 warm-up. Picturing 300."],
        [3, 185],
        [2, 225],
        [5, 295],
        [5, 295],
        [5, 295, "295. Three plates next session."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Rematch with 115 today."],
        [5, 45],
        [3, 65],
        [2, 85],
        [5, 115],
        [5, 115, "The second set at 115 went up easier than last time."],
        [5, 115, "115 for all fifteen reps. Beat it."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. The hook grip is automatic now."],
        [5, 185],
        [3, 225],
        [2, 275],
        [5, 345, "345. Hips and shoulders rise together now."],
      ],
    },
  },
  {
    daysAgo: 16,
    lifts: {
      "Back Squat": [
        [5, 45, "Three plates on the squat today. Nervous."],
        [5, 45],
        [5, 95],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 300, "300 on the bar. Three plates a side for the first time."],
        [5, 300],
        [3, 300, "Missed the last two reps at 300. First failed squat."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Legs cooked from the squats."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 170],
        [5, 170, "170 for five. Heavy."],
        [
          4,
          170,
          "One rep short at 170. Shoulders still tired from the last press day.",
        ],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Shaking off the missed squat."],
        [3, 45],
        [3, 75, "75. Clean and fast."],
        [1, 95],
        [3, 120],
        [3, 120],
        [3, 120],
        [3, 120],
        [3, 120, "120. The cleans still move when the squat does not."],
      ],
    },
  },
  {
    daysAgo: 14,
    lifts: {
      "Back Squat": [
        [5, 45, "300 again. Deep breath."],
        [5, 45],
        [5, 95],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 300, "First set at 300 went up."],
        [4, 300],
        [
          4,
          300,
          "Missed at 300 again. The book says reset 10% and build back.",
        ],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Focus on what I can control."],
        [5, 45],
        [5, 65, "65 warm-up. Clean."],
        [3, 85],
        [2, 105],
        [5, 117.5],
        [5, 117.5],
        [5, 117.5, "117.5 for all fifteen. The press is still going."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Grumpy about the squat."],
        [5, 185],
        [5, 225],
        [3, 275],
        [2, 315],
        [5, 350, "350. At least the deadlift is happy."],
      ],
    },
  },
  {
    daysAgo: 11,
    lifts: {
      "Back Squat": [
        [5, 45, "Back to 275 today. Feeling fresh."],
        [5, 45],
        [5, 95, "Warm-ups feel light after the reset."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 275],
        [5, 275],
        [5, 275, "Reset to 275 and it flew. Good call."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Rematch with 170."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 170],
        [5, 170, "Second set at 170. Feeling it."],
        [5, 170, "All fifteen reps at 170 this time."],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Hips are snapping."],
        [3, 45],
        [3, 75, "75 for three, easy."],
        [1, 95],
        [3, 125],
        [3, 125],
        [3, 125],
        [3, 125],
        [3, 125, "125. Fast elbows."],
      ],
    },
  },
  {
    daysAgo: 9,
    lifts: {
      "Back Squat": [
        [5, 45, "Squats feel fun again after the reset."],
        [5, 45],
        [5, 95],
        [5, 135, "135 for five. Fast."],
        [3, 185],
        [2, 225],
        [5, 285],
        [5, 285],
        [5, 285, "285 moves fast after the reset."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. 120 on the bar today."],
        [5, 45],
        [5, 65],
        [3, 85],
        [2, 105],
        [5, 120],
        [4, 120, "Second set at 120: four reps."],
        [3, 120, "120 won today. Five, four, three."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Chalk, hook, breathe."],
        [5, 185],
        [5, 225],
        [3, 275],
        [2, 315],
        [5, 355, "355. The deadlift keeps climbing."],
      ],
    },
  },
  {
    daysAgo: 7,
    lifts: {
      "Back Squat": [
        [5, 45, "295 again, second time around."],
        [5, 45],
        [5, 95, "Warm-ups are all business now."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 295],
        [5, 295],
        [5, 295, "295 felt better than the first time around."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. The morning crew is here early."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 172.5],
        [5, 172.5, "172.5. Second set smooth."],
        [5, 172.5, "172.5. The morning crew yelled me through the last rep."],
      ],
      "Power Clean": [
        [
          3,
          45,
          "Power clean warm-up. Seven weeks of cleans. They feel athletic now.",
        ],
        [3, 45],
        [5, 75, "75. Crisp."],
        [3, 95],
        [1, 115],
        [3, 130],
        [3, 130],
        [3, 130],
        [3, 130],
        [3, 130, "130 cleans, fast under the bar."],
      ],
    },
  },
  {
    daysAgo: 4,
    lifts: {
      "Back Squat": [
        [5, 45, "Three plates today. Chalk, belt, sleeves, lucky socks."],
        [5, 45],
        [5, 95],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 300, "300 for five. First set in the bag."],
        [5, 300],
        [5, 300, "300 for three sets of five. Three plates on the squat."],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Round two with 120."],
        [5, 45],
        [5, 65],
        [3, 85],
        [2, 105],
        [5, 120],
        [5, 120, "The second set at 120 went up clean."],
        [4, 120, "One rep short at 120 again. So close."],
      ],
      Deadlift: [
        [5, 135, "Deadlift warm-up. Celebrating the squat with a big pull."],
        [5, 185],
        [5, 225],
        [3, 275],
        [2, 315],
        [5, 360, "360. My grip is the strongest it has ever been."],
      ],
    },
  },
  {
    daysAgo: 2,
    lifts: {
      "Back Squat": [
        [5, 45, "Legs feel fresh since the reset."],
        [5, 45],
        [5, 95, "Warm-ups flying today."],
        [5, 135],
        [3, 185],
        [2, 225],
        [5, 305],
        [5, 305],
        [5, 305, "305. New squat PR."],
      ],
      "Bench Press": [
        [5, 45, "Empty bar bench. Last bench day of the twelve weeks."],
        [5, 45],
        [3, 95],
        [2, 135],
        [5, 175],
        [5, 175, "175 for five. Strong."],
        [5, 175, "175 for three sets. 60 pounds on the bench in twelve weeks."],
      ],
      "Power Clean": [
        [3, 45, "Power clean warm-up. Phone propped up to film the top sets."],
        [3, 45],
        [5, 75, "75. Fast."],
        [3, 95],
        [1, 115],
        [3, 135],
        [3, 135],
        [3, 135],
        [3, 135],
        [
          3,
          135,
          "Got my cleans on video. Fast under the bar.",
          "https://www.youtube.com/watch?v=WnJd42b3EfI",
        ],
      ],
    },
  },
  {
    daysAgo: 0,
    lifts: {
      "Back Squat": [
        [
          5,
          45,
          "Twelve weeks since my first session. Same gym, same morning crew.",
        ],
        [5, 45],
        [5, 95],
        [5, 135, "135 for five. That was my working weight on day one."],
        [5, 185],
        [3, 225],
        [2, 275],
        [5, 310],
        [5, 310],
        [
          5,
          310,
          "310 for three sets of five, filmed the last one. Twelve weeks ago I squatted 135.",
          "https://www.youtube.com/watch?v=qgbnLdH4qjc",
        ],
      ],
      "Strict Press": [
        [5, 45, "Empty bar press. Still humbling, always humbling."],
        [5, 45],
        [5, 65, "65. Third try at 120 today. Staying calm."],
        [3, 85],
        [2, 105],
        [5, 120],
        [5, 120],
        [5, 120, "Every rep at 120 after two tries. Worth the wait."],
      ],
      Deadlift: [
        [5, 135, "Last deadlift of the twelve weeks. Chalk, hook, breathe."],
        [5, 185],
        [5, 225],
        [3, 275],
        [2, 315, "315 double. Used to be my top set. Now it is a warm-up."],
        [5, 365, "365 for five. 180 pounds on the deadlift in twelve weeks."],
      ],
    },
  },
];
