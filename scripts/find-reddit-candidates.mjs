/**
 * Find Reddit threads where a Strength Journeys analysis can actually be computed.
 *
 * The useful comments are the ones that answer with a number, which needs a set
 * (weight and reps) and ideally a bodyweight. Guessing bodyweight makes the
 * answer worthless, so posts that state it rank highest.
 *
 * This only reads public listings and ranks them. It does not post anything, and
 * it should stay that way: automated commenting breaks Reddit's rules and would
 * cost the account.
 *
 * Reddit now returns 403 to unauthenticated clients on the public .json
 * endpoints, so this reads through the OAuth API instead. One-time setup:
 *
 *   1. https://www.reddit.com/prefs/apps -> "create another app..."
 *   2. Choose "script", any name, redirect URI http://localhost:8080
 *   3. Put the id (under the app name) and the secret in .env as:
 *        REDDIT_CLIENT_ID=...
 *        REDDIT_CLIENT_SECRET=...
 *
 * Free, and allows 100 requests per minute, far more than this needs.
 *
 * Usage:
 *   node --env-file=.env scripts/find-reddit-candidates.mjs
 *   node --env-file=.env scripts/find-reddit-candidates.mjs --subs Stronglifts5x5,Deadlifts
 *   node --env-file=.env scripts/find-reddit-candidates.mjs --json
 */

const DEFAULT_SUBS = [
  "Stronglifts5x5",
  "strength_training",
  "Deadlifts",
  "StartingStrength",
];

// Reddit blocks unidentified clients. Anything descriptive is accepted.
const USER_AGENT =
  "strengthjourneys-thread-finder/1.0 (by u/ConstructionPlus8561; contact via strengthjourneys.xyz)";

const LIFTS = [
  ["Bench Press", /\bbench(?:\s*press)?\b/i],
  ["Back Squat", /\b(?:back\s*)?squat\b/i],
  ["Deadlift", /\b(?:dead\s*lift|deadlift|dl)\b/i],
  ["Strict Press", /\b(?:strict\s*press|overhead\s*press|ohp|military\s*press)\b/i],
];

/**
 * "185 BW", "BW 64 kgs", "at 187 lbs bodyweight", "@180lbs", "72kg BW".
 * Two directions because writers put the marker on either side of the number.
 */
const BODYWEIGHT_PATTERNS = [
  /\b(?:bw|body\s?weight)\b[^\d]{0,14}(\d{2,3}(?:\.\d)?)\s*(kg|kgs|lbs?|#)?/i,
  /(\d{2,3}(?:\.\d)?)\s*(kg|kgs|lbs?|#)?\s*\b(?:bw|body\s?weight)\b/i,
];

/**
 * "315 x 5", "315x5", "8@100kg", "315 for 2", "270lbs x8".
 * Captures whichever of the pair is the load and which is the rep count by
 * magnitude: reps are small, loads are not.
 */
const SET_PATTERNS = [
  /(\d{2,4}(?:\.\d)?)\s*(?:kg|kgs|lbs?|#)?\s*(?:x|×|for)\s*(\d{1,2})\b/i,
  /(\d{1,2})\s*(?:x|×|@|reps?\s*(?:at|@|of))\s*(\d{2,4}(?:\.\d)?)\s*(?:kg|kgs|lbs?|#)/i,
];

/**
 * A bare load with no rep scheme, as in "Bench: 535 lbs" or "445 lb deadlift".
 * PR posts are usually singles, so this is read as one rep and flagged assumed
 * so the output never implies the poster said so.
 */
const BARE_LOAD_RE = /(\d{2,4}(?:\.\d)?)\s*(kg|kgs|lbs?|#)\b/i;

const QUESTION_RE =
  /\?|\bam i\b|\bis (?:this|that|it)\b|\bhow (?:strong|much|many|good)\b|\bgood\b|\bweak\b|\bimpressive\b|\bwhat'?s your\b|\bdo you (?:guys )?think\b|\bworth\b/i;

// Form and injury threads are a bad fit: there is nothing to compute and health
// advice from a linked account is how an account gets reported.
const SKIP_RE =
  /\bform\s*check\b|\btendinitis\b|\bherniat|\binjur|\bpain\b|\bphysio\b|\bsurgery\b|\btear\b/i;

function parseArgs(argv) {
  const args = { subs: DEFAULT_SUBS, limit: 60, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--subs") args.subs = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

export function findBodyWeight(text) {
  for (const re of BODYWEIGHT_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const value = Number(m[1]);
    // Plausible adult bodyweight in either unit. Filters out rep counts and years.
    if (value >= 40 && value <= 400) {
      return { value, unit: normaliseUnit(m[2], value) };
    }
  }
  return null;
}

export function findSet(text) {
  for (const re of SET_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Whichever number is small is the rep count.
    const [weight, reps] = a > b ? [a, b] : [b, a];
    if (reps >= 1 && reps <= 20 && weight >= 20 && weight <= 1000) {
      return { weight, reps, unit: normaliseUnit(null, weight), assumedReps: false };
    }
  }

  const bare = text.match(BARE_LOAD_RE);
  if (bare) {
    const weight = Number(bare[1]);
    if (weight >= 20 && weight <= 1000) {
      return { weight, reps: 1, unit: normaliseUnit(bare[2], weight), assumedReps: true };
    }
  }
  return null;
}

/** Loads above ~230 are almost certainly pounds; below that, guess from the label. */
function normaliseUnit(label, value) {
  if (label) return /kg/i.test(label) ? "kg" : "lb";
  return value > 230 ? "lb" : "?";
}

export function detectLift(text) {
  for (const [name, re] of LIFTS) if (re.test(text)) return name;
  return null;
}

export function scorePost(post) {
  const text = `${post.title}\n${post.selftext ?? ""}`;
  if (SKIP_RE.test(text)) return null;

  const bodyWeight = findBodyWeight(text);
  const set = findSet(text);
  const lift = detectLift(text);
  const isQuestion = QUESTION_RE.test(post.title);

  // A stated bodyweight is the scarce signal, so it alone is enough to keep a
  // post. Otherwise there must be a set to compute from or a question to answer.
  if (!bodyWeight && !set && !isQuestion) return null;

  let score = 0;
  const why = [];
  if (bodyWeight) {
    score += 4;
    why.push("bodyweight stated");
  }
  if (set) {
    score += set.assumedReps ? 1 : 3;
    why.push(
      `set ${set.weight}${set.unit === "?" ? "" : set.unit}x${set.reps}${set.assumedReps ? " (reps assumed)" : ""}`,
    );
  }
  if (isQuestion) {
    score += 2;
    why.push("question");
  }
  if (lift) score += 1;
  // A reply lands near the top of a quiet thread and is buried in a busy one.
  if (post.num_comments <= 25) {
    score += 2;
    why.push("low traffic");
  }
  if (post.ageHours <= 48) {
    score += 1;
    why.push("fresh");
  }

  return { ...post, score, why, bodyWeight, set, lift };
}

/**
 * Exchange the script app's credentials for a read-only token. Reddit's
 * client_credentials grant needs no user login and no scopes for public data.
 */
async function getAccessToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are not set. See the setup notes\n" +
        "at the top of this file, then run with: node --env-file=.env scripts/find-reddit-candidates.mjs",
    );
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(
      `Token request failed with ${res.status}. Check the id and secret, and that the app type is "script".`,
    );
  }
  const { access_token: token } = await res.json();
  return token;
}

async function fetchSub(sub, limit, token) {
  const results = [];
  for (const listing of ["hot", "new"]) {
    const url = `https://oauth.reddit.com/r/${sub}/${listing}?limit=${limit}&raw_json=1`;
    const res = await fetch(url, {
      headers: { Authorization: `bearer ${token}`, "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      console.error(`  ! r/${sub}/${listing} returned ${res.status}`);
      continue;
    }
    const json = await res.json();
    for (const child of json.data.children) {
      const d = child.data;
      if (d.stickied) continue;
      results.push({
        sub,
        id: d.id,
        title: d.title,
        selftext: d.selftext,
        num_comments: d.num_comments,
        score_reddit: d.score,
        ageHours: Math.round(Date.now() / 1000 - d.created_utc) / 3600,
        url: `https://www.reddit.com${d.permalink}`,
      });
    }
    await new Promise((r) => setTimeout(r, 1200)); // stay well under Reddit's rate limit
  }
  // hot and new overlap heavily.
  return [...new Map(results.map((p) => [p.id, p])).values()];
}

async function main() {
  const { subs, limit, json } = parseArgs(process.argv.slice(2));
  const token = await getAccessToken();
  const candidates = [];

  for (const sub of subs) {
    if (!json) console.error(`Fetching r/${sub}...`);
    const posts = await fetchSub(sub, limit, token);
    for (const post of posts) {
      const scored = scorePost(post);
      if (scored) candidates.push(scored);
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.num_comments - b.num_comments);

  if (json) {
    console.log(JSON.stringify(candidates, null, 2));
    return;
  }

  console.log(`\n${candidates.length} candidates\n`);
  for (const c of candidates.slice(0, 25)) {
    const bw = c.bodyWeight ? `bw ${c.bodyWeight.value}${c.bodyWeight.unit}` : "no bodyweight";
    console.log(
      `[${String(c.score).padStart(2)}] r/${c.sub}  ${Math.round(c.ageHours)}h  ${c.num_comments} comments  (${bw})`,
    );
    console.log(`     ${c.title}`);
    console.log(`     ${c.why.join(", ")}`);
    console.log(`     ${c.url}\n`);
  }
}

// Only run when invoked directly, so the parsing helpers stay importable.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
