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
 * Reads the public RSS feeds, which need no credentials. The .json endpoints
 * return 403 to unauthenticated clients, and new Data API apps now need Reddit's
 * approval, which is granted for moderation use cases rather than this one.
 *
 * The feeds allow roughly one request a minute, so a full run over the default
 * subreddits takes several minutes. They also carry no comment counts, so thread
 * traffic is not part of the score.
 *
 * Usage:
 *   node scripts/find-reddit-candidates.mjs
 *   node scripts/find-reddit-candidates.mjs --subs Stronglifts5x5,Deadlifts
 *   node scripts/find-reddit-candidates.mjs --json
 */

// The target audience comes first, so a crosspost is reported under it.
const DEFAULT_SUBS = [
  "strength_training",
  "Stronglifts5x5",
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
  [
    "Strict Press",
    /\b(?:strict\s*press|overhead\s*press|ohp|military\s*press|shoulder\s*press)\b/i,
  ],
];

/**
 * "185 BW", "BW 64 kgs", "at 187 lbs bodyweight", "72kg BW".
 * Two directions because writers put the marker on either side of the number.
 * A number directly before the marker is tried first: reading forward from
 * "bw" catches whatever comes next, as in "190lbs bw. Road to 400lbs". A
 * number after a slash is a unit conversion of the load, as in
 * "157.5kg/346.5lbs Bw 105.8kg", so it is not read as the bodyweight.
 */
const BODYWEIGHT_PATTERNS = [
  /(?<![\d./])(\d{2,3}(?:\.\d)?)\s*(kg|kgs|lbs?|#)?\s*\b(?:bw|body\s?weight)\b/i,
  /\b(?:bw|body\s?weight)\b[^\d]{0,14}(\d{2,3}(?:\.\d)?)\s*(kg|kgs|lbs?|#)?/i,
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
const BARE_LOAD_RE = /(\d{2,4}(?:\.\d)?)\s*(kg|kgs|lbs?|#)\b/gi;

const QUESTION_RE =
  /\?|\bam i\b|\bis (?:this|that|it)\b|\bhow (?:strong|much|many|good)\b|\bgood\b|\bweak\b|\bimpressive\b|\bwhat'?s your\b|\bdo you (?:guys )?think\b|\bworth\b/i;

// Form and injury threads are a bad fit: there is nothing to compute and health
// advice from a linked account is how an account gets reported.
const SKIP_RE =
  /\bform\s*check\b|\btendinitis\b|\bherniat|\binjur|\bpain\b|\bphysio\b|\bsurgery\b|\btear\b/i;

// Only the title, since a lift log often invites form critiques in passing.
const FORM_TITLE_RE = /\bform\b/i;

// Sets on these cannot be placed against big four standards. Only consulted
// when no big four lift is named, so a bench session with pull-ups still counts.
const ACCESSORY_RE =
  /\b(?:dumbbells?|db|curls?|pull[\s-]?ups?|chin[\s-]?ups?|dips?|lat\s*pull(?:down)?s?|leg\s*press|machine|cable|kettlebells?|kb)\b/i;

// Variants whose names contain a big four lift but which have no standards of
// their own. They are stripped before lift detection, so "RDL" or "trap bar
// deadlift" alone is an accessory while "deadlift 500, RDL 300" is a deadlift.
const VARIANT_RE =
  /\b(?:rdls?|(?:romanian|stiff[\s-]?leg(?:ged)?|trap[\s-]?bar|hex[\s-]?bar)(?:\s*dead\s*lifts?)?|(?:front|hack|goblet|split|bulgarian)\s*squats?|(?:incline|decline)\s*bench(?:\s*press)?)\b/gi;

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

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

export function findSet(text, bodyWeight = null) {
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

  // The stated bodyweight also looks like a bare load, as in "196lb body weight 315lb".
  // Only the first load that matches it is skipped, and only when the units
  // agree, so "100 kg BW, benched 100 kg" still reports the bench. An unlabelled
  // bodyweight, as in "185 BW", has no unit to compare and falls back to value.
  let skippedBodyWeight = false;
  for (const bare of text.matchAll(BARE_LOAD_RE)) {
    const weight = Number(bare[1]);
    const unit = normaliseUnit(bare[2], weight);
    const isBodyWeight =
      bodyWeight != null &&
      weight === bodyWeight.value &&
      (bodyWeight.unit === "?" || unit === bodyWeight.unit);
    if (isBodyWeight && !skippedBodyWeight) {
      skippedBodyWeight = true;
      continue;
    }
    if (weight >= 20 && weight <= 1000) {
      return { weight, reps: 1, unit, assumedReps: true };
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
  if (SKIP_RE.test(text) || FORM_TITLE_RE.test(post.title)) return null;

  const withoutVariants = text.replace(VARIANT_RE, " ");
  const lift = detectLift(withoutVariants);
  if (!lift && (withoutVariants !== text || ACCESSORY_RE.test(text))) return null;

  const bodyWeight = findBodyWeight(text);
  const set = findSet(text, bodyWeight);
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
  // A reply lands near the top of a young thread and is buried in an old one.
  if (post.ageHours <= 48) {
    score += 1;
    why.push("fresh");
  }

  return { ...post, score, why, bodyWeight, set, lift };
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === "x";
    return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function readTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}

/**
 * Turn a subreddit Atom feed into posts. Reddit escapes the entry HTML inside
 * the XML and then escapes text again inside that HTML, hence two decodes. A
 * self post's body sits between the SC_OFF and SC_ON comments; link and image
 * posts have none, so their selftext is empty.
 */
export function parseFeed(xml, sub) {
  const posts = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const html = decodeEntities(readTag(entry, "content") ?? "");
    const body = html.match(/<!-- SC_OFF -->([\s\S]*?)<!-- SC_ON -->/)?.[1] ?? "";
    const selftext = decodeEntities(
      body
        .replace(/<\/(?:p|li|h\d|blockquote|pre)>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    ).trim();
    const posted = Date.parse(readTag(entry, "published") ?? readTag(entry, "updated"));

    posts.push({
      sub,
      id: (readTag(entry, "id") ?? "").replace(/^t3_/, ""),
      author: (readTag(entry, "name") ?? "").replace(/^\/u\//, ""),
      title: decodeEntities(decodeEntities(readTag(entry, "title") ?? "")).trim(),
      selftext,
      ageHours: (Date.now() - posted) / 3_600_000,
      url: entry.match(/<link href="([^"]+)"/)?.[1] ?? "",
    });
  }
  return posts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextRequestAt = 0;

/**
 * Fetch while honouring Reddit's rate-limit headers. The anonymous budget is
 * about one request per window, so the wait comes from x-ratelimit-reset rather
 * than a fixed delay, and a 429 waits out the window and tries again.
 */
async function politeFetch(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wait = nextRequestAt - Date.now();
    if (wait > 0) {
      console.error(`  waiting ${Math.ceil(wait / 1000)}s for Reddit's rate limit`);
      await sleep(wait);
    }

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? 0);
    const resetSeconds = Number(res.headers.get("x-ratelimit-reset") ?? 60);
    if (res.status === 429 || remaining < 1) {
      nextRequestAt = Date.now() + (resetSeconds + 1) * 1000;
    }
    if (res.status !== 429) return res;
  }
  return null;
}

async function fetchSub(sub, limit) {
  const results = [];
  for (const listing of ["hot", "new"]) {
    const url = `https://www.reddit.com/r/${sub}/${listing}/.rss?limit=${limit}`;
    const res = await politeFetch(url);
    if (!res?.ok) {
      console.error(`  ! r/${sub}/${listing} returned ${res?.status ?? "429 three times"}`);
      continue;
    }
    results.push(...parseFeed(await res.text(), sub));
  }
  // hot and new overlap heavily.
  return [...new Map(results.map((p) => [p.id, p])).values()];
}

/**
 * Fold crossposts into one candidate. The same author reporting the same set
 * and bodyweight in another subreddit is one post shared twice, so the first
 * subreddit fetched keeps it and the others are listed. Repeats within one
 * subreddit are separate sessions and stay.
 */
export function mergeCrossposts(candidates) {
  const merged = [];
  const firstByKey = new Map();
  for (const candidate of candidates) {
    const post = { ...candidate, alsoIn: [] };
    const { set, bodyWeight } = candidate;
    const key =
      set || bodyWeight
        ? [candidate.author, set && `${set.weight}x${set.reps}`, bodyWeight?.value].join("|")
        : null;
    const first = key ? firstByKey.get(key) : null;
    if (first && first.sub !== candidate.sub) {
      if (!first.alsoIn.includes(candidate.sub)) first.alsoIn.push(candidate.sub);
      continue;
    }
    if (key && !first) firstByKey.set(key, post);
    merged.push(post);
  }
  return merged;
}

async function main() {
  const { subs, limit, json } = parseArgs(process.argv.slice(2));
  const candidates = [];

  for (const sub of subs) {
    console.error(`Fetching r/${sub}...`);
    const posts = await fetchSub(sub, limit);
    for (const post of posts) {
      const scored = scorePost(post);
      if (scored) candidates.push(scored);
    }
  }

  const merged = mergeCrossposts(candidates);
  merged.sort((a, b) => b.score - a.score || a.ageHours - b.ageHours);

  if (json) {
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  console.log(`\n${merged.length} candidates\n`);
  for (const c of merged.slice(0, 25)) {
    const bw = c.bodyWeight ? `bw ${c.bodyWeight.value}${c.bodyWeight.unit}` : "no bodyweight";
    const also = c.alsoIn.length ? `  also r/${c.alsoIn.join(", r/")}` : "";
    console.log(
      `[${String(c.score).padStart(2)}] r/${c.sub}  ${Math.round(c.ageHours)}h  (${bw})${also}`,
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
