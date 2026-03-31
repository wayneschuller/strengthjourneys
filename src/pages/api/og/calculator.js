import { ImageResponse } from "@vercel/og";
import {
  LiftingStandardsKG,
  interpolateStandardKG,
} from "@/lib/lifting-standards-kg";
import { getLiftPercentiles } from "@/lib/strength-circles/universe-percentiles";

export const config = {
  runtime: "edge",
};

const E1RM_FORMULAE = [
  "Brzycki",
  "Epley",
  "McGlothin",
  "Lombardi",
  "Mayhew",
  "OConner",
  "Wathan",
];

const LIFT_SLUG_TO_BIG_FOUR = {
  "Squat": "Back Squat",
  "Bench Press": "Bench Press",
  "Deadlift": "Deadlift",
  "Strict Press": "Strict Press",
};

const LIFT_TO_PERCENTILE_KEY = {
  "Back Squat": "squat",
  "Bench Press": "bench",
  "Deadlift": "deadlift",
};

const STRENGTH_LEVEL_EMOJI = {
  "Physically Active": "\u{1F3C3}",
  Beginner: "\u{1F331}",
  Intermediate: "\u{1F4AA}",
  Advanced: "\u{1F525}",
  Elite: "\u{1F451}",
};

function estimateE1RM(reps, weight, equation) {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  reps = Math.min(reps, 20);

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
    case "Mayhew":
      return Math.round(
        (100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)),
      );
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
    case "Wathan":
      return Math.round(
        (100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)),
      );
    case "Brzycki":
    default:
      return Math.round(weight / (1.0278 - 0.0278 * reps));
  }
}

function getStrengthRating(oneRepMax, standard) {
  if (!standard?.elite) return null;
  const { beginner, intermediate, advanced, elite } = standard;
  if (oneRepMax < beginner) return "Physically Active";
  if (oneRepMax < intermediate) return "Beginner";
  if (oneRepMax < advanced) return "Intermediate";
  if (oneRepMax < elite) return "Advanced";
  return "Elite";
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const weight = Number(searchParams.get("weight")) || 225;
  const reps = Math.max(1, Math.min(Number(searchParams.get("reps")) || 5, 30));
  const isMetric = searchParams.get("calcIsMetric") === "true";
  const formula = searchParams.get("formula") || "Brzycki";
  const lift = searchParams.get("lift") || null;
  const bodyWeight = Number(searchParams.get("bodyWeight")) || 0;
  const age = Number(searchParams.get("age")) || 0;
  const sex = searchParams.get("sex") || "male";
  const unit = isMetric ? "kg" : "lb";

  const validFormula = E1RM_FORMULAE.includes(formula) ? formula : "Brzycki";
  const e1rm = estimateE1RM(reps, weight, validFormula);

  // Strength level + percentile (only when lift + bio data are provided)
  const bigFourName = lift ? LIFT_SLUG_TO_BIG_FOUR[lift] : null;
  let strengthRating = null;
  let ratingEmoji = "";
  let gymGoerPercentile = null;
  let bwMultiple = null;
  const hasBioData = bodyWeight > 0 && age > 0;

  if (bigFourName && hasBioData) {
    const bwKg = isMetric ? bodyWeight : Math.round(bodyWeight / 2.2046);
    const standard = interpolateStandardKG(age, bwKg, sex, bigFourName, LiftingStandardsKG);

    if (standard) {
      const userStandard = isMetric
        ? standard
        : {
            physicallyActive: Math.round(standard.physicallyActive * 2.2046),
            beginner: Math.round(standard.beginner * 2.2046),
            intermediate: Math.round(standard.intermediate * 2.2046),
            advanced: Math.round(standard.advanced * 2.2046),
            elite: Math.round(standard.elite * 2.2046),
          };
      strengthRating = getStrengthRating(e1rm, userStandard);
      ratingEmoji = strengthRating ? (STRENGTH_LEVEL_EMOJI[strengthRating] ?? "") : "";
    }

    const percentileKey = LIFT_TO_PERCENTILE_KEY[bigFourName];
    if (percentileKey) {
      const e1rmKg = isMetric ? e1rm : e1rm / 2.2046;
      const percentiles = getLiftPercentiles(age, bwKg, sex, percentileKey, e1rmKg);
      gymGoerPercentile = percentiles?.["Gym-Goers"] ?? null;
    }

    bwMultiple = (e1rm / bodyWeight).toFixed(1);
  }

  const hasLift = Boolean(lift);
  const topPercentile = gymGoerPercentile != null ? 100 - gymGoerPercentile : null;

  // Radial glow color based on strength level
  const glowColor = {
    "Elite": "rgba(234, 179, 8, 0.15)",       // gold
    "Advanced": "rgba(249, 115, 22, 0.12)",    // orange
    "Intermediate": "rgba(59, 130, 246, 0.10)", // blue
    "Beginner": "rgba(34, 197, 94, 0.10)",     // green
    "Physically Active": "rgba(168, 162, 158, 0.08)",
  }[strengthRating] ?? "rgba(168, 162, 158, 0.06)";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#fafaf9",
          color: "#1c1917",
          fontFamily: "system-ui, sans-serif",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Radial glow behind the number */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            top: "15px",
          }}
        />

        {/* Lift name + context line */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "4px",
            position: "relative",
          }}
        >
          {hasLift && (
            <span
              style={{
                fontSize: "22px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#a8a29e",
                marginBottom: "2px",
              }}
            >
              {lift}
            </span>
          )}
          <span
            style={{
              fontSize: "18px",
              color: "#a8a29e",
              letterSpacing: "0.05em",
            }}
          >
            {reps}@{weight}{unit} {validFormula}
          </span>
        </div>

        {/* Dominant E1RM number */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            position: "relative",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "180px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "#1c1917",
            }}
          >
            {e1rm}
          </span>
          <span
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#a8a29e",
              marginLeft: "6px",
            }}
          >
            {unit}
          </span>
        </div>

        {/* Percentile badge (hero element when available) */}
        {topPercentile != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "8px 24px",
                borderRadius: "9999px",
                background: "#1c1917",
                color: "#fafaf9",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              Top {topPercentile}%
            </div>
            <span
              style={{
                fontSize: "18px",
                color: "#78716c",
              }}
            >
              of gym-goers your age
            </span>
          </div>
        )}

        {/* Strength level + BW multiple row */}
        {(strengthRating || bwMultiple) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              position: "relative",
            }}
          >
            {strengthRating && (
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                {ratingEmoji} {strengthRating}
              </span>
            )}
            {strengthRating && bwMultiple && (
              <span style={{ fontSize: "24px", color: "#d6d3d1" }}>|</span>
            )}
            {bwMultiple && (
              <span
                style={{
                  fontSize: "22px",
                  color: "#78716c",
                }}
              >
                {bwMultiple}× bodyweight
              </span>
            )}
          </div>
        )}

        {/* Fallback: formula + estimated 1RM label when no bio data */}
        {!strengthRating && !gymGoerPercentile && (
          <div
            style={{
              display: "flex",
              fontSize: "20px",
              color: "#a8a29e",
              position: "relative",
            }}
          >
            Estimated 1RM
          </div>
        )}

        {/* Bottom watermark pill */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "24px",
            padding: "6px 20px",
            borderRadius: "9999px",
            background: "rgba(15, 23, 42, 0.86)",
            color: "rgba(248, 250, 252, 0.98)",
            fontSize: "15px",
            fontWeight: 500,
            letterSpacing: "0.03em",
            boxShadow: "0 6px 16px rgba(15, 23, 42, 0.55)",
          }}
        >
          strengthjourneys.xyz
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
