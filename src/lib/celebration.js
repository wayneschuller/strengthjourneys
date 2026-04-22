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

export function getTrainingAgeYears(parsedData, referenceDate) {
  const firstLoggedDate = parsedData?.find((entry) => !entry.isGoal)?.date;
  if (!firstLoggedDate || !referenceDate) return 0;

  const start = new Date(`${firstLoggedDate}T00:00:00Z`);
  const end = new Date(`${referenceDate}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();

  if (Number.isNaN(diffMs) || diffMs <= 0) return 0;

  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

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

export function getCelebrationStyles(celebration) {
  if (!celebration || celebration.tier === "none") {
    return {
      rowClassName: "",
      glowClassName: "",
    };
  }

  const isLifetime = celebration.scope === "lifetime";
  const baseBorder = isLifetime
    ? "border-amber-300/80 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-500/5"
    : "border-blue-300/80 bg-blue-50/30 dark:border-blue-500/40 dark:bg-blue-500/5";

  const glowClassName = isLifetime
    ? "shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_12px_28px_-20px_rgba(245,158,11,0.7)]"
    : "shadow-[0_0_0_1px_rgba(96,165,250,0.18),0_12px_28px_-20px_rgba(59,130,246,0.65)]";

  return {
    rowClassName: cn("rounded-lg border", baseBorder),
    glowClassName,
  };
}

export function getCelebrationOriginFromElement(element) {
  if (!element) return { x: 0.5, y: 0.55 };
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

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
