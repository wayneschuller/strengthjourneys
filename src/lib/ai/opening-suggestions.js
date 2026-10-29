/**
 * The AI coach's opening suggestions: the chips on the blank chat page.
 *
 * Each audience (what the athlete shares with the coach) gets four fixed
 * prompts and a few adaptive slots. The adaptive slots are chosen per visit by
 * Thompson sampling over how often each prompt started a chat when shown, so
 * the prompts athletes pick show up more while new or rarely seen ones still
 * get their turn. The counts live in KV (opening-suggestion-stats.js) and
 * reach the page through its hourly static props, so choosing costs no
 * request and no wait.
 *
 * Prompts are templates. {lift} and {lift2} are the athlete's two most
 * trained lifts, {age} their age, {session} their latest session ("today's
 * training session"). A prompt is counted with its lift names filled in, so
 * "for Bench Press" and "for Deadlift" are counted apart, but {age} and
 * {session} stay placeholders, so no age reaches KV. The server keeps a lift
 * name only when it is a registry lift; a custom name from someone's sheet is
 * counted as {lift}. The sampler scores the template, across every lift.
 *
 * Client-safe: no KV client and no lift registry. The server passes its own
 * registry check into canonicalOpeningKey.
 */

import { AI_REVIEW_PROMPTS } from "@/lib/ai/review-prompts";

export const OPENING_AUDIENCES = ["first", "bio", "partial", "full"];

// Counted for the PR chip, whose wording changes daily.
export const CELEBRATION_KEY = "Celebrate {PR}";

// What a prompt draws on, for its icon: the log, the body, general lifting
// knowledge, or just fun.
const DATA = "data";
const HEALTH = "health";
const GENERAL = "general";
const PLAYFUL = "playful";

/**
 * @param {string} kind
 * @param {string[]} variants Tried in order; the first whose placeholders can
 *   all be filled is shown.
 * @param {boolean} [bio] true: only when bio details are shared. false: only
 *   when they are not.
 */
function entry(kind, variants, bio) {
  return { kind, variants, bio };
}

const general = (text) => entry(GENERAL, [text]);
const health = (...variants) => entry(HEALTH, variants);
const playful = (text) => entry(PLAYFUL, [text]);
const data = (...variants) => entry(DATA, variants);

const HEALTH_PROMPTS = [
  health(
    "Why does strength training matter at {age}?",
    "Why does strength training matter?",
  ),
  health("How should recovery change at {age}?", "How should recovery change?"),
  health("How much protein should I eat?"),
  health("Should I lift every day?"),
  health("Can I lift weights and still lose weight?"),
  health("How important is sleep for getting stronger?"),
  health("What should I eat before a workout?"),
  health("How do I recover faster between sessions?"),
  health("Is lifting good for my bones and joints?"),
];

const GENERAL_PROMPTS = [
  general("Why lift weights?"),
  general("What should I do in my first gym session?"),
  general("How often should I deadlift?"),
  general("I'm female, will I get bulky lifting weights?"),
  general("How do I choose a gym?"),
  general("Isn't deadlifting dangerous?"),
  general("What are the health benefits for women who lift?"),
  general("Can I start lifting in my 50s?"),
  general("Write me a simple three-day beginner program"),
  general("How many sets and reps should a beginner do?"),
  general("What is progressive overload?"),
  general("How long until I notice strength gains?"),
  general("Should I test my one-rep max?"),
  general("Should I wear a lifting belt?"),
  general("How do I warm up for a heavy squat?"),
  general("How deep should I squat?"),
  general("Free weights or machines for a beginner?"),
  general("How do I get my bench press moving again?"),
  general("How long should I rest between sets?"),
  general("What does RPE mean?"),
  general("Strength or hypertrophy training: what's the difference?"),
  general("How do I fit lifting into a busy week?"),
  general("What makes a good deadlift setup?"),
  general("How do I train for my first powerlifting meet?"),
  general("Low bar or high bar squat?"),
  general("What's a good first strength goal?"),
];

const PLAYFUL_PROMPTS = [
  playful("Write me a motivational rap."),
  playful("Give me a riddle about lifting weights."),
  playful("Hype me up for leg day."),
  playful("Write a haiku about the deadlift."),
  playful("Tell me your best gym dad joke."),
  playful("Narrate my squat like a nature documentary."),
  playful("Write a pep talk from my barbell."),
  playful("Invent a new lifting holiday."),
];

// Questions the coach can answer from the full lifting summary: per-lift
// bests and six-week trends, rep-range records, consistency and tonnage.
const TRAINING_PROMPTS = [
  data("Is my {lift} still climbing?"),
  data("Set me a realistic {lift} goal for the next three months"),
  data("Which rep ranges could I explore on {lift}?"),
  data("Compare my {lift} and {lift2} progress"),
  data("Where is my training inconsistent?"),
  data("What am I doing well right now?"),
  data("Which lift has the most room to grow?"),
  data("Which lift has improved the most this year?"),
  data("How has my training load changed this year?"),
  data("Am I training often enough to keep progressing?"),
  data("Do I need a deload?"),
  data("Which PRs could I chase next?"),
  data("Tell me something I might not have noticed about my training"),
  entry(DATA, ["How strong am I for my age?"], true),
  entry(DATA, ["How strong am I?"], false),
  entry(DATA, ["Which of my lifts is strongest for my bodyweight?"], true),
];

// Partial sharing may leave out consistency or load, so these stay general.
const PARTIAL_TRAINING_PROMPTS = [
  data("What am I doing well right now?"),
  data("Which lift has the most room to grow?"),
  data("Which PRs could I chase next?"),
];

/**
 * Per audience: four fixed prompts, always shown first, then the adaptive
 * slots as [pool, count] for bio shared or not. Slots keep the mix of kinds;
 * the sampler picks the best within each.
 */
const AUDIENCE_PLANS = {
  first: {
    anchors: [
      general("Why lift weights?"),
      general("What should I do in my first gym session?"),
      general("Write me a simple three-day beginner program"),
      general("I'm female, will I get bulky lifting weights?"),
    ],
    slots: () => [
      [GENERAL_PROMPTS, 2],
      [HEALTH_PROMPTS, 1],
      [PLAYFUL_PROMPTS, 1],
    ],
  },
  bio: {
    anchors: [
      health(
        "Why does strength training matter at {age}?",
        "Why does strength training matter?",
      ),
      health(
        "How should recovery change at {age}?",
        "How should recovery change?",
      ),
      health("How much protein should I eat?"),
      health("Should I lift every day?"),
    ],
    slots: () => [
      [HEALTH_PROMPTS, 1],
      [GENERAL_PROMPTS, 2],
      [PLAYFUL_PROMPTS, 1],
    ],
  },
  partial: {
    anchors: [
      data("Review the training data I've shared"),
      data(
        "What does my {lift} data suggest?",
        "What does my shared training data suggest?",
      ),
      data(
        "Compare my {lift} and {lift2} progress",
        "What should I focus on next from my shared data?",
      ),
      entry(DATA, ["How strong am I for my age?"], true),
      entry(DATA, ["How strong am I?"], false),
    ],
    slots: (hasBio) => [
      [PARTIAL_TRAINING_PROMPTS, 1],
      [hasBio ? HEALTH_PROMPTS : GENERAL_PROMPTS, 1],
      [GENERAL_PROMPTS, 1],
      [PLAYFUL_PROMPTS, 1],
    ],
  },
  full: {
    anchors: [
      data("Review {session}"),
      data(AI_REVIEW_PROMPTS.week),
      data(AI_REVIEW_PROMPTS.month),
      data(
        "What should I focus on next for {lift}?",
        "What lift should I focus on next?",
      ),
    ],
    slots: (hasBio) => [
      [TRAINING_PROMPTS, 2],
      [hasBio ? HEALTH_PROMPTS : GENERAL_PROMPTS, 1],
      [GENERAL_PROMPTS, 1],
      [PLAYFUL_PROMPTS, 1],
    ],
  },
};

/** Which pools the athlete gets, from what they share with the coach. */
export function getOpeningAudience({
  hasSharedBioData,
  hasSharedTrainingData,
  hasSharedFullTrainingData,
}) {
  if (hasSharedFullTrainingData) return "full";
  if (hasSharedTrainingData) return "partial";
  if (hasSharedBioData) return "bio";
  return "first";
}

/**
 * The opening chips for one visit: the four fixed prompts, then the adaptive
 * picks in a shuffled order so no prompt wins clicks for sitting first.
 * @param {Object} args
 * @param {string} args.audience One of OPENING_AUDIENCES.
 * @param {boolean} args.hasSharedBioData
 * @param {{ lift?: string, lift2?: string, age?: number, session?: string }} args.context
 * @param {Record<string, [number, number]>} [args.scores] This audience's
 *   [picked, shown] per template.
 * @param {string} args.seed Fresh per visit; the same seed gives the same set.
 * @returns {{ text: string, key: string, kind: string }[]}
 */
export function getOpeningSuggestions({
  audience,
  hasSharedBioData,
  context,
  scores,
  seed,
}) {
  const plan = AUDIENCE_PLANS[audience] ?? AUDIENCE_PLANS.first;
  const next = seededRandoms(hashString(`${seed}|${audience}`));
  const prior = getPrior(scores);
  const used = new Set();

  const anchors = resolveEntries(plan.anchors, hasSharedBioData, context);
  anchors.forEach((suggestion) => used.add(suggestion.template));

  const adaptive = [];
  for (const [pool, count] of plan.slots(hasSharedBioData)) {
    const candidates = resolveEntries(pool, hasSharedBioData, context)
      .filter((suggestion) => !used.has(suggestion.template))
      .map((suggestion) => {
        const [picked = 0, shown = 0] = scores?.[suggestion.template] ?? [];
        const hits = Math.min(picked, shown);
        return {
          suggestion,
          draw: sampleBeta(
            prior.alpha + hits,
            prior.beta + Math.max(0, shown - hits),
            next,
          ),
        };
      })
      .sort((a, b) => b.draw - a.draw)
      .slice(0, count);
    for (const { suggestion } of candidates) {
      used.add(suggestion.template);
      adaptive.push(suggestion);
    }
  }

  return [...anchors, ...shuffle(adaptive, next)].map(
    ({ text, key, kind }) => ({ text, key, kind }),
  );
}

function resolveEntries(entries, hasSharedBioData, context) {
  return entries
    .filter((item) => item.bio === undefined || item.bio === hasSharedBioData)
    .map((item) => {
      for (const template of item.variants) {
        const text = fillTemplate(template, context);
        if (text) {
          return {
            text,
            template,
            key: fillTemplate(template, context, LIFT_PLACEHOLDERS),
            kind: item.kind,
          };
        }
      }
      return null;
    })
    .filter(Boolean);
}

const LIFT_PLACEHOLDERS = new Set(["lift", "lift2"]);

/**
 * Fills a template's placeholders from the context, or returns null when one
 * has no value. With `only`, fills just those and leaves the rest as written.
 */
function fillTemplate(template, context, only) {
  let missing = false;
  const text = template.replace(/\{(\w+)\}/g, (placeholder, name) => {
    if (only && !only.has(name)) return placeholder;
    const value = context?.[name];
    if (value === null || value === undefined || value === "") {
      missing = true;
      return placeholder;
    }
    return String(value);
  });
  return missing ? null : text;
}

/**
 * The prior every prompt starts from: this audience's average pick rate,
 * worth ten showings, so one lucky click cannot crown a new prompt.
 */
const PRIOR_SHOWINGS = 10;
const DEFAULT_PICK_RATE = 0.1;

function getPrior(scores) {
  let picked = 0;
  let shown = 0;
  for (const [p, s] of Object.values(scores ?? {})) {
    picked += Math.min(p, s);
    shown += s;
  }
  const rate =
    shown > 0
      ? Math.min(0.5, Math.max(0.02, picked / shown))
      : DEFAULT_PICK_RATE;
  return {
    alpha: rate * PRIOR_SHOWINGS,
    beta: (1 - rate) * PRIOR_SHOWINGS,
  };
}

/**
 * Matches a counted key against an audience's templates, for the server to
 * accept and store it. Lift names are kept only when isKnownLift says so.
 * @param {string} audience
 * @param {string} key
 * @param {(liftType: string) => boolean} isKnownLift
 * @returns {{ key: string, template: string }|null} null for anything that is
 *   not one of our prompts.
 */
export function canonicalOpeningKey(audience, key, isKnownLift) {
  if (typeof key !== "string" || key.length > 200) return null;
  const matchers = getAudienceMatchers(audience);
  if (!matchers) return null;
  for (const { template, pattern, lifts } of matchers) {
    const match = pattern.exec(key);
    if (!match) continue;
    let canonical = template;
    lifts.forEach((name, index) => {
      const lift = match[index + 1];
      canonical = canonical.replace(
        `{${name}}`,
        isKnownLift(lift) ? lift : `{${name}}`,
      );
    });
    return { key: canonical, template };
  }
  return null;
}

const matcherCache = new Map();

function getAudienceMatchers(audience) {
  const plan = AUDIENCE_PLANS[audience];
  if (!plan) return null;
  if (matcherCache.has(audience)) return matcherCache.get(audience);

  const templates = new Set();
  const pools = [
    plan.anchors,
    ...plan.slots(true).map(([pool]) => pool),
    ...plan.slots(false).map(([pool]) => pool),
  ];
  for (const pool of pools) {
    for (const item of pool) item.variants.forEach((t) => templates.add(t));
  }
  if (audience === "partial" || audience === "full") {
    templates.add(CELEBRATION_KEY);
  }

  const matchers = [...templates].map((template) => {
    const lifts = [];
    const source = template
      .split(/(\{lift2?\})/)
      .map((part) => {
        const name = part.match(/^\{(lift2?)\}$/)?.[1];
        if (!name) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        lifts.push(name);
        return "(.{1,60})";
      })
      .join("");
    return { template, pattern: new RegExp(`^${source}$`), lifts };
  });
  // Literal prompts first: "What does my shared training data suggest?" would
  // otherwise read as the {lift} template with a lift called "shared training".
  matchers.sort((a, b) => a.lifts.length - b.lifts.length);
  matcherCache.set(audience, matchers);
  return matchers;
}

// A seeded shuffle, so a render never reorders what the athlete is reading.
function shuffle(items, next) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A stream of numbers in [0, 1) from one seed (mulberry32).
function seededRandoms(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Beta(a, b) as the ratio of two gamma draws.
function sampleBeta(a, b, next) {
  const x = sampleGamma(a, next);
  const y = sampleGamma(b, next);
  return x / (x + y);
}

// Marsaglia and Tsang's method; shapes under 1 are boosted by one and scaled.
function sampleGamma(shape, next) {
  if (shape < 1) {
    return sampleGamma(shape + 1, next) * Math.pow(next() || 1e-12, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = sampleNormal(next);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// Box-Muller.
function sampleNormal(next) {
  const u = next() || 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}
