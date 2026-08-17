/** @format */
// celebration.js
// Tiered celebration policy for PR-worthy sets, plus confetti + style primitives.
// Reusable beyond the log page — any caller showing a newly-ranked lift can
// ask for a tier and fire the matching celebration.

import { cn } from "@/lib/utils";
import { PRIORITY_REP_SCHEMES } from "@/lib/processing-utils";

export const CELEBRATION_KEYFRAMES = `
@keyframes log-pr-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  12% { transform: translate3d(-8px, 2px, 0); }
  24% { transform: translate3d(7px, -3px, 0); }
  36% { transform: translate3d(-6px, 4px, 0); }
  48% { transform: translate3d(5px, -2px, 0); }
  60% { transform: translate3d(-4px, 3px, 0); }
  72% { transform: translate3d(6px, -1px, 0); }
  84% { transform: translate3d(-3px, 2px, 0); }
}
`;

export const CELEBRATION_TIERS = {
  none: 0,
  border: 1,
  confettiSmall: 2,
  confettiLarge: 3,
  confettiLargeShake: 4,
};

export const NEXT_TIER = {
  "Physically Active": { name: "Beginner", key: "beginner" },
  Beginner: { name: "Intermediate", key: "intermediate" },
  Intermediate: { name: "Advanced", key: "advanced" },
  Advanced: { name: "Elite", key: "elite" },
  Elite: null,
};

/**
 * Years between a user's first logged lift and the given reference date.
 * Feeds the celebration-tier policy: a 10-year veteran hitting a PR deserves
 * a bigger party than a 3-month beginner who's still on the beginner growth curve.
 *
 * @param {Array<{ date?: string, isGoal?: boolean }>} parsedData - Output of parse-data.js.
 * @param {string} referenceDate - `YYYY-MM-DD` (usually the current set's session date).
 * @returns {number} Fractional years; 0 if no data or reference date precedes first lift.
 */
export function getTrainingAgeYears(parsedData, referenceDate) {
  const firstLoggedDate = parsedData?.find((entry) => !entry.isGoal)?.date;
  if (!firstLoggedDate || !referenceDate) return 0;

  const start = new Date(`${firstLoggedDate}T00:00:00Z`);
  const end = new Date(`${referenceDate}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();

  if (Number.isNaN(diffMs) || diffMs <= 0) return 0;

  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Map a set's ranking + reps + training age to a celebration tier
 * (none / border / confettiSmall / confettiLarge / confettiLargeShake).
 * Tuned so novices still get confetti for early wins, while veterans need
 * genuine lifetime PRs to earn the biggest effect — otherwise every session
 * would fire the shake animation and the celebration loses meaning.
 *
 * @param {object} args
 * @param {{ lifetime?: { rank: number }, yearly?: { rank: number } } | null} args.rankingMeta -
 *   Output of `getRankingMeta` or `getOptimisticRankingMeta`.
 * @param {number} args.reps - Used with `PRIORITY_REP_SCHEMES` to gate some tiers.
 * @param {number} args.trainingAgeYears - From `getTrainingAgeYears`.
 * @returns {{ tier: string, score: number, reason: string|null }} Tier key from `CELEBRATION_TIERS`.
 */
export function getCelebrationTier({ rankingMeta, reps, trainingAgeYears }) {
  const lifetimeRank = rankingMeta?.lifetime?.rank ?? null;
  const yearlyRank = rankingMeta?.yearly?.rank ?? null;
  const isPriorityRep = PRIORITY_REP_SCHEMES.includes(reps);

  if (lifetimeRank === 0) {
    return {
      tier: trainingAgeYears <= 2 ? "confettiLarge" : "confettiLargeShake",
      score:
        trainingAgeYears <= 2
          ? CELEBRATION_TIERS.confettiLarge
          : CELEBRATION_TIERS.confettiLargeShake,
      reason:
        trainingAgeYears <= 2 ? "Lifetime best without shake" : "Lifetime best",
    };
  }

  if (trainingAgeYears >= 5) {
    if (lifetimeRank != null && lifetimeRank < 5) {
      return {
        tier: "confettiLarge",
        score: CELEBRATION_TIERS.confettiLarge,
        reason: "Lifetime top 5",
      };
    }
    if (lifetimeRank != null && lifetimeRank < 10) {
      return {
        tier: "confettiSmall",
        score: CELEBRATION_TIERS.confettiSmall,
        reason: "Lifetime top 10",
      };
    }
    if (yearlyRank === 0) {
      return {
        tier: "border",
        score: CELEBRATION_TIERS.border,
        reason: "12-month best",
      };
    }
  }

  if (trainingAgeYears >= 2) {
    if (lifetimeRank != null && lifetimeRank < 5) {
      return {
        tier: "confettiSmall",
        score: CELEBRATION_TIERS.confettiSmall,
        reason: "Lifetime top 5",
      };
    }
    if (
      (lifetimeRank != null && lifetimeRank < 10 && isPriorityRep) ||
      yearlyRank === 0
    ) {
      return {
        tier: "border",
        score: CELEBRATION_TIERS.border,
        reason:
          lifetimeRank != null && lifetimeRank < 10
            ? "Priority lifetime top 10"
            : "12-month best",
      };
    }
  }

  if (lifetimeRank != null && lifetimeRank < 3 && isPriorityRep) {
    return {
      tier: "confettiSmall",
      score: CELEBRATION_TIERS.confettiSmall,
      reason: "Early-phase lifetime top 3",
    };
  }

  if (yearlyRank === 0 && isPriorityRep) {
    return {
      tier: "border",
      score: CELEBRATION_TIERS.border,
      reason: "12-month best",
    };
  }

  return {
    tier: "none",
    score: CELEBRATION_TIERS.none,
    reason: null,
  };
}

/**
 * Tailwind classes for a celebrated row, tinted by scope (lifetime = amber/gold,
 * yearly = blue).
 *
 * Learning:
 * This used to draw a full outlined box around the row. Set rows live in a
 * `divide-y` stack with no horizontal padding of their own, so that box ran flush
 * to the card edges and cut across the dividers above and below it — a rendering
 * glitch on the log's happiest moment. A left accent bar plus a background tint
 * composes with a divided list instead of competing with it, and the negative
 * margin buys the content breathing room inside the tint without shifting the
 * reps column out of alignment with neighbouring rows.
 *
 * The transient glow on a freshly-earned PR is animated inline by SetRow, so no
 * glow class is returned here.
 *
 * @param {{ tier: string, scope?: "lifetime"|"yearly" } | null | undefined} celebration
 * @returns {{ rowClassName: string }}
 */
export function getCelebrationStyles(celebration) {
  if (!celebration || celebration.tier === "none") {
    return { rowClassName: "" };
  }

  const isLifetime = celebration.scope === "lifetime";

  return {
    rowClassName: cn(
      "-mx-3 rounded-r-md border-l-2 px-3",
      isLifetime
        ? "border-l-amber-400 bg-amber-400/10 dark:bg-amber-400/15"
        : "border-l-blue-400 bg-blue-400/10 dark:bg-blue-400/15",
    ),
  };
}

/**
 * Convert a DOM element's bounding rect into normalized viewport coordinates
 * (0..1) for canvas-confetti's `origin`. Makes confetti burst from the actual
 * set row the user just edited rather than the middle of the screen.
 *
 * @param {HTMLElement|null} element
 * @returns {{ x: number, y: number }} Normalized coords; safe fallback `{0.5, 0.55}` on null.
 */
export function getCelebrationOriginFromElement(element) {
  if (!element) return { x: 0.5, y: 0.55 };
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

/**
 * Fire a canvas-confetti burst keyed to the given tier, originating at the
 * supplied element. Dynamically imports canvas-confetti so it stays out of
 * the main bundle — the library is only pulled in when a celebration actually fires.
 *
 * @param {"confettiSmall"|"confettiLarge"|"confettiLargeShake"|string} tier - From `CELEBRATION_TIERS`.
 *   Other values (e.g. "none", "border") are a no-op.
 * @param {HTMLElement|null} element - Origin anchor for the burst.
 * @returns {void}
 */
export function fireSetCelebrationConfetti(tier, element) {
  if (typeof window === "undefined") return;

  const origin = getCelebrationOriginFromElement(element);

  import("canvas-confetti")
    .then(({ default: confetti }) => {
      if (tier === "confettiLargeShake" || tier === "confettiLarge") {
        confetti({
          particleCount: 85,
          spread: 80,
          startVelocity: 40,
          scalar: 1.05,
          origin,
        });
        confetti({
          particleCount: 50,
          spread: 120,
          startVelocity: 30,
          decay: 0.92,
          origin,
        });
        return;
      }

      if (tier === "confettiSmall") {
        confetti({
          particleCount: 28,
          spread: 42,
          startVelocity: 22,
          scalar: 0.9,
          origin,
        });
      }
    })
    .catch((error) => {
      console.error("[log-celebration] confetti failed", error);
    });
}
