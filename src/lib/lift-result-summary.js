/** @format */

/**
 * Shared model for a single calculator result.
 *
 * The same result gets rendered in two places that must never drift:
 * - as text, for the "Copy Text" button (pasted into Reddit/X/forums)
 * - as an image, for the dynamic Open Graph card
 *
 * Both consume buildLiftResultSummary(), so a phrasing or ordering change
 * happens once. This module is deliberately pure — callers pass values that
 * are already computed, so it can run on the client or in an edge OG route
 * without pulling in the standards/percentile data sets.
 */

// Cohorts worth quoting publicly. The percentile data set defines four
// (see UNIVERSES in strength-percentile-data.js); these two are the pair that
// reads well in a comment — one relatable, one aspirational.
export const SHAREABLE_UNIVERSES = ["Gym-Goers", "Powerlifting Culture"];

/**
 * @param {object} input
 * @param {string|null} input.liftName - "Bench Press" etc, or null on the generic calculator.
 * @param {number} input.reps
 * @param {number} input.weight
 * @param {string} input.unit - "kg" or "lb".
 * @param {number} input.e1rm
 * @param {string} input.formula - "Brzycki" etc.
 * @param {number|null} [input.bodyWeight] - Same unit as weight. Null/0 when unknown.
 * @param {{rating: string, emoji: string}|null} [input.liftData] - From getLiftBarData().
 * @param {Record<string, number>|null} [input.percentiles] - From getLiftPercentiles().
 * @param {{name: string, emoji: string, diff: number|string}|null} [input.nextTier]
 * @param {string} input.sourceUrl
 * @returns {object} Normalised summary, safe to render as text or image.
 */
export function buildLiftResultSummary({
  liftName = null,
  reps,
  weight,
  unit,
  e1rm,
  formula,
  bodyWeight = null,
  liftData = null,
  percentiles = null,
  nextTier = null,
  sourceUrl,
}) {
  const hasBodyWeight = typeof bodyWeight === "number" && bodyWeight > 0;

  return {
    liftName,
    reps,
    weight,
    unit,
    e1rm,
    formula,
    bodyweightMultiple: hasBodyWeight ? Number((e1rm / bodyWeight).toFixed(2)) : null,
    rating: liftData ? { name: liftData.rating, emoji: liftData.emoji } : null,
    percentiles: percentiles
      ? SHAREABLE_UNIVERSES.filter((u) => percentiles[u] != null).map((u) => ({
          universe: u,
          value: percentiles[u],
        }))
      : [],
    nextTier,
    sourceUrl,
  };
}

/**
 * Render the summary as the text block used by "Copy Text".
 *
 * Blocks are joined with blank lines rather than single newlines: Reddit's
 * markdown collapses single newlines into one paragraph, which ran the whole
 * result together as a wall of text when pasted into a comment.
 *
 * @param {ReturnType<typeof buildLiftResultSummary>} summary
 * @returns {string}
 */
export function formatLiftResultText(summary) {
  const {
    liftName,
    reps,
    weight,
    unit,
    e1rm,
    formula,
    bodyweightMultiple,
    rating,
    percentiles,
    nextTier,
    sourceUrl,
  } = summary;

  const subject = liftName ? `${liftName} ` : "";
  const blocks = [
    `${subject}${reps}@${weight}${unit} indicates a one rep max of ${e1rm}${unit}, using the ${formula} algorithm.`,
  ];

  // Bodyweight multiple and tier read as one thought, so keep them on one line.
  const standing = [
    bodyweightMultiple ? `${bodyweightMultiple.toFixed(2)}× bodyweight` : null,
    rating ? `${rating.emoji} ${rating.name}` : null,
  ].filter(Boolean);
  if (standing.length) blocks.push(standing.join(", "));

  if (percentiles.length) {
    blocks.push(
      `Stronger than ${percentiles
        .map(({ universe, value }) => `${value}% of ${universe.toLowerCase()}`)
        .join(", ")}.`,
    );
  }

  if (nextTier?.name && nextTier?.diff) {
    blocks.push(`Next tier: ${nextTier.emoji ?? ""} ${nextTier.name}, ${nextTier.diff}${unit} away`.trim());
  }

  blocks.push(`Source: ${sourceUrl}`);

  return blocks.join("\n\n");
}
