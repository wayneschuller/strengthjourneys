/**
 * Rotating subtitle for the Big Four section heading on the landing page.
 *
 * Audience note: these are aimed at the curious, not the converted. The reader
 * we want is someone who runs but has never loaded a bar, or who has spent
 * years on cable machines without getting stronger, or who has heard something
 * vague about lifting and living longer. The voice stays dry rather than
 * preachy — this is one muted line under a heading, not a manifesto.
 *
 * Health claims are kept to ground that is genuinely well supported (loading
 * builds bone density; grip strength tracks with healthy ageing; adults lose
 * muscle mass each decade from about 30 and resistance training is the direct
 * counter). A single sentence has no room to qualify anything, so nothing here
 * touches injury, rehab, or any claim that would need a caveat to be honest —
 * and superlatives stay hedged ("little else", "one of the few") rather than
 * absolute, because the reader we want is the skeptical one.
 *
 * Keep every line under ~90 characters. The subtitle reserves two lines of
 * height so the cards below hold still during the delayed reveal, and a longer
 * line wraps to three on a phone and reintroduces the jump.
 */

export const BIG_FOUR_SUBTITLES = [
  "Four movements, most of the muscle you own, two sessions a week. That is the whole trick.",
  "If you have been running for years and still feel weak, this is the part that was missing.",
  "Years of cable machines and nothing to show? Machines hold you steady. Barbells don't.",
  "Loading your spine and hips is one of the few things that builds bone, not just keeps it.",
  "Grip strength tracks with healthy ageing better than almost anything else in a gym.",
  "Standing up, pushing, pulling, reaching overhead: the strength you notice losing first.",
  "Everyone starts these unimpressive. The empty bar is 20kg and a legitimate place to begin.",
  "Small jumps across a year add up to a number you would not have believed in January.",
  "There is no shortcut to a body that looks trained. There is a barbell.",
  "Nothing else asks your whole body to cooperate quite like a loaded bar.",
  "Being able to put something heavy on a high shelf at 75. That is what this is for.",
  "Runners and cyclists build strong legs in one narrow range. These cover the rest.",
  "Four lifts, one bar, and a number that goes up. That is the entire sport.",
  "Learn these four lifts properly once and you have them for the rest of your life.",
  "Four lifts, a few months, and most people stop recognising their old self.",
  "Nobody expects a barbell to change much beyond their body. It usually does.",
  "The point is not lifting at 40. The point is still lifting at 80.",
  "Muscle is the tissue you spend your last decades either keeping or missing.",
  "Strength is one of the few things about ageing you get a real say in.",
  "Adults lose muscle every decade after 30. Barbells are the most direct way back.",
  "Little else builds muscle per hour like a heavy compound lift with a barbell.",
  "Four compound lifts recruit more muscle per session than a circuit of machines.",
];

/**
 * Milliseconds per rotation step. An hour is long enough that nobody sees the
 * copy change while reading the page, and short enough that a return visit
 * tomorrow reads differently.
 */
const ROTATION_MS = 60 * 60 * 1000;

/**
 * Current rotation key. Client only — the landing page is statically generated,
 * so reading a clock during render would bake build-time copy into the HTML.
 * The subtitle reveals after mount anyway, so there is no server variant.
 */
export function getSubtitleRotationKey(now = Date.now()) {
  return Math.floor(now / ROTATION_MS);
}

/**
 * Pick the subtitle for a rotation key.
 *
 * The key is hashed rather than used directly so consecutive hours jump around
 * the list instead of stepping through it in order, which would make the
 * rotation obvious to anyone reloading.
 *
 * @param {number} rotationKey - Seed, from getSubtitleRotationKey().
 * @returns {string} The line to show.
 */
export function getBigFourSubtitle(rotationKey) {
  // djb2 over the stringified key.
  let hash = 5381;
  const seed = `big-four:${rotationKey}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return BIG_FOUR_SUBTITLES[Math.abs(hash) % BIG_FOUR_SUBTITLES.length];
}
