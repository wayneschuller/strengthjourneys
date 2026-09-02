/** @format */

/**
 * Copy for the 404 page, kept in lib rather than the component so the wording
 * lives beside the rest of the app's variant sets and can be reviewed in one
 * place.
 *
 * The tone here is deliberately blunter than the rest of the product: a dead
 * URL is the one moment where a dry coaching voice reads as charm rather than
 * nagging. The lines stay aimed at the broken link, never at the reader's
 * training, and every one of them ends by pointing at something real to do.
 *
 * Selection is seeded by the path the visitor actually asked for, so the line
 * is stable for a given URL (a reload says the same thing, which stops it
 * looking like a slot machine) while two different typos read differently.
 */

const NOT_FOUND_LINES = Object.freeze([
  "The bar is empty and so is this URL. Go and load something that exists.",
  "This is not a page. This is what a page looks like when nobody wrote it.",
  "Nothing here to press, pull, or squat. The doors below all lead somewhere real.",
  "Somebody sent you a link we do not have. Bad bar path. Correct it and continue.",
  "You have found the only part of this site with no weight on it. Congratulations.",
  "404 is not a lift, a program, or a page. Pick a real one and go to work.",
]);

/**
 * Pick the line for a requested path.
 *
 * The seed is hashed rather than used directly so that neighbouring paths
 * (/timr and /timre, say) land on different lines instead of stepping through
 * the list in order.
 *
 * @param {string} [path] - The path the visitor asked for, e.g. "/timr".
 * @returns {string} One line from the set.
 */
export function getNotFoundLine(path = "") {
  // djb2 over the requested path.
  let hash = 5381;
  const seed = `not-found:${path}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return NOT_FOUND_LINES[Math.abs(hash) % NOT_FOUND_LINES.length];
}

export { NOT_FOUND_LINES };
