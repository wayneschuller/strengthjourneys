/**
 * Rotating examples under the catch-all tile of the log's read-only lift
 * gallery, where a demo visitor learns the drawings are not the whole list.
 *
 * Each line names four real lifts that have no drawing (so it never repeats a
 * tile above it), then ends on one everyday lift to keep it light. Every
 * example has reps and a weight, since that is the promise the tile makes, so
 * distance work like sled pushes stays out. Keep the "even ..." ending, and
 * keep lines about this length so the tile holds its height.
 */

export const ANY_LIFT_EXAMPLES = [
  "Barbell rows, weighted chin-ups, hex bar deadlifts, dumbbell curls, even carrying all the groceries in one trip.",
  "Push presses, weighted dips, Bulgarian split squats, kettlebell swings, even lifting the dog onto the couch.",
  "Sumo deadlifts, incline bench presses, lat pulldowns, good mornings, even deadlifting the couch to find the remote.",
  "Pendlay rows, close-grip bench presses, walking lunges, calf raises, even crushing watermelons with your thighs.",
  "Rack pulls, landmine presses, goblet squats, skull crushers, even carrying a sleeping kid up the stairs.",
];

/**
 * Milliseconds per rotation step. An hour is long enough that the line never
 * changes while someone reads it, short enough that a return visit differs.
 */
const ROTATION_MS = 60 * 60 * 1000;

/**
 * The examples line for the hour containing `now`. The hour is hashed rather
 * than used directly, so consecutive hours jump around the list instead of
 * stepping through it in order. Client only, like the gallery that shows it:
 * reading the clock in a server render would bake one line into the HTML.
 *
 * @param {number} [now] - Epoch milliseconds.
 * @returns {string}
 */
export function getAnyLiftExamples(now = Date.now()) {
  // djb2 over the stringified hour.
  let hash = 5381;
  const seed = `any-lift:${Math.floor(now / ROTATION_MS)}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  // djb2 alone moves by one when the hour's last digit does, which walks the
  // list in order. One multiply-xorshift round scatters neighbouring hours.
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash ^= hash >>> 16;
  return ANY_LIFT_EXAMPLES[Math.abs(hash) % ANY_LIFT_EXAMPLES.length];
}
