/**
 * Rotating "why you'd care" lines for the Big Four cards on the landing page.
 *
 * Audience note: these are aimed at the curious, not the converted. The reader
 * we want is someone who runs but has never loaded a bar, or who has spent
 * years on cable machines without getting stronger, or who has heard something
 * vague about lifting and living longer. So the angles deliberately spread
 * across health, longevity, aesthetics, capability, and "the machine version of
 * this is not the same thing" — and the voice stays dry rather than preachy.
 *
 * Health claims are kept to ground that is genuinely well supported (loading
 * builds bone density; grip strength tracks with healthy ageing; pressing
 * preserves overhead range). Nothing here should drift into medical advice or
 * promise an outcome — if a line cannot be said plainly to a skeptical reader,
 * it does not belong in the list.
 *
 * Every line carries an `angle` so the four cards on screen at once can be kept
 * to four different pitches — without it the hash happily lands "machine" on
 * two adjacent cards and the row reads like it is repeating itself.
 */

export const BIG_FOUR_BENEFITS = {
  "Back Squat": [
    {
      angle: "longevity",
      text: "Can you still get out of a chair unaided at 80? This is that question, answered early.",
    },
    {
      angle: "bone",
      text: "Loading your hips and spine is one of the few things that builds bone rather than just slowing its loss.",
    },
    {
      angle: "runner",
      text: "Runners: a lot of what gets called a knee problem is a quad and hip that were never asked to get strong.",
    },
    {
      angle: "machine",
      text: "Years on the leg press and nothing changed? The machine held you steady. The bar makes you hold yourself.",
    },
    {
      angle: "aesthetic",
      text: "There is no shortcut to legs that look trained. There is a squat rack.",
    },
    {
      angle: "capability",
      text: "Nothing else asks your whole body to cooperate quite like standing back up with a loaded bar.",
    },
    {
      angle: "simplicity",
      text: "Two sessions a week, most of the muscle you own, one movement. That is close to the whole trick.",
    },
  ],
  "Bench Press": [
    {
      angle: "machine",
      text: "The chest press machine picks the path for you. The barbell makes you find it, and that is the part that builds strength.",
    },
    {
      angle: "capability",
      text: "The most honest test of upper body pushing strength anyone has come up with.",
    },
    {
      angle: "falls",
      text: "Pushing strength is what catches you when you fall. Worth having before you need it.",
    },
    {
      angle: "beginner",
      text: "Everyone starts here unimpressive. The empty bar is 20kg and a completely legitimate place to begin.",
    },
    {
      angle: "progress",
      text: "Small jumps, tracked across a year, add up to a number you would not have believed in January.",
    },
    {
      angle: "ageing",
      text: "Upper body pressing strength is among the first things to fade with age, and among the easiest to keep.",
    },
  ],
  Deadlift: [
    {
      angle: "capability",
      text: "Picking heavy things up off the floor is what backs are for. This is how you get good at it.",
    },
    {
      angle: "grip",
      text: "Grip strength tracks with healthy ageing better than almost anything else you can measure in a gym.",
    },
    {
      angle: "runner",
      text: "Hamstrings that keep complaining are usually hamstrings that have never been asked to do anything hard.",
    },
    {
      angle: "machine",
      text: "No machine trains the whole back of your body at once. The floor does it for free.",
    },
    {
      angle: "aesthetic",
      text: "Builds the back that rows alone never quite will.",
    },
    {
      angle: "beginner",
      text: "The most intimidating lift on paper and the simplest in practice: bar on the floor, stand up with it.",
    },
  ],
  "Strict Press": [
    {
      angle: "unfashionable",
      text: "The least fashionable of the four, and the one that changes shoulders fastest.",
    },
    {
      angle: "longevity",
      text: "Being able to put something heavy on a high shelf at 75 is not a small thing. This is how you keep it.",
    },
    {
      angle: "machine",
      text: "The machine trains your shoulders. The bar trains your shoulders and everything holding you upright.",
    },
    {
      angle: "aesthetic",
      text: "Shoulders are what make a physique read as built. This is the lift that builds them.",
    },
    {
      angle: "honesty",
      text: "No leg drive, no momentum, nowhere to hide. Just you and the bar going overhead.",
    },
    {
      angle: "reach",
      text: "Overhead reach is one of the first things people quietly lose. Pressing is how you keep it.",
    },
  ],
};

/**
 * Milliseconds per rotation step. An hour is long enough that nobody sees copy
 * change while reading the page, and short enough that a return visit tomorrow
 * reads differently.
 */
const ROTATION_MS = 60 * 60 * 1000;

/**
 * Stable seed used for server rendering. The landing page is statically
 * generated, so a live clock here would bake build-time copy into the HTML and
 * then mismatch on hydration. Server and first client paint both use this seed;
 * the live rotation is swapped in after mount. It also means slot 0 of each
 * list is the variant search engines index, so keep slot 0 strong.
 */
export const BENEFIT_SSR_KEY = 0;

/**
 * Current rotation key. Call only on the client — see BENEFIT_SSR_KEY.
 */
export function getBenefitRotationKey(now = Date.now()) {
  return Math.floor(now / ROTATION_MS);
}

// djb2. Hashing liftType together with the rotation key (rather than taking the
// key modulo the list length) decorrelates the four cards, so they don't all
// advance in lockstep and land on the same slot as each other every hour.
function hashToIndex(seed, length) {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/**
 * Pick one benefit line per lift, keeping the angles distinct across the row.
 *
 * Each lift picks by hash from the lines whose angle no earlier card has taken.
 * Two details stop this from going lopsided, both measured over 24k rotations:
 * the pick order rotates with the key so no lift is always last and stuck with
 * the leftovers, and each lift hashes uniformly across whatever is still
 * available rather than walking forward from a fixed offset — walking made
 * whichever line happened to follow a contested angle come up 31% of the time.
 * As it stands no line exceeds ~22% and none falls below ~7.5%, against an even
 * split of 16.7%. Deterministic for a given rotation key.
 *
 * @param {string[]} liftTypes - Lift names in render order.
 * @param {number} [rotationKey=BENEFIT_SSR_KEY] - Rotation seed. Pass
 *   getBenefitRotationKey() on the client; leave as the default on the server.
 * @returns {Record<string, string|null>} Lift name to line.
 */
export function getBigFourBenefits(liftTypes, rotationKey = BENEFIT_SSR_KEY) {
  const usedAngles = new Set();
  const result = {};

  const pickOrder = liftTypes.map(
    (_, i) => liftTypes[(i + rotationKey) % liftTypes.length],
  );

  for (const liftType of pickOrder) {
    const lines = BIG_FOUR_BENEFITS[liftType];
    if (!lines?.length) {
      result[liftType] = null;
      continue;
    }

    const available = lines.filter((line) => !usedAngles.has(line.angle));
    const pool = available.length > 0 ? available : lines;
    const chosen = pool[hashToIndex(`${liftType}:${rotationKey}`, pool.length)];

    usedAngles.add(chosen.angle);
    result[liftType] = chosen.text;
  }

  return result;
}
