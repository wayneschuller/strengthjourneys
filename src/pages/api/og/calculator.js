import { ImageResponse } from "@vercel/og";
import {
  LiftingStandardsKG,
  interpolateStandardKG,
} from "@/lib/lifting-standards-kg";
import { getLiftPercentiles } from "@/lib/strength-circles/universe-percentiles";

export const config = {
  runtime: "edge",
};

// ── Theme tokens (light mode from globals.css :root) ─────────────────────────
const T = {
  bg: "#ffffff",
  fg: "#1c1917", // hsl(20 14.3% 4.1%)
  card: "#ffffff",
  cardFg: "#1c1917",
  muted: "#f5f5f4", // hsl(60 4.8% 95.9%)
  mutedFg: "#78716c", // hsl(25 5.3% 44.7%)
  primary: "#1c1917", // hsl(24 9.8% 10%)
  primaryFg: "#fafaf9",
  border: "#e7e5e4", // hsl(20 5.9% 90%)
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
    case "Wathen":
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
  const lift = searchParams.get("lift") || null; // e.g. "Bench Press", "Squat"
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
      // Convert standard to user's unit for comparison
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

    // Percentile (squat/bench/deadlift only, not strict press)
    const percentileKey = LIFT_TO_PERCENTILE_KEY[bigFourName];
    if (percentileKey) {
      const e1rmKg = isMetric ? e1rm : e1rm / 2.2046;
      const percentiles = getLiftPercentiles(age, bwKg, sex, percentileKey, e1rmKg);
      gymGoerPercentile = percentiles?.["Gym-Goers"] ?? null;
    }

    bwMultiple = (e1rm / bodyWeight).toFixed(2);
  }

  // All formula results for comparison bars
  const allResults = E1RM_FORMULAE.map((f) => ({
    name: f,
    value: estimateE1RM(reps, weight, f),
  }));
  const minE1rm = Math.min(...allResults.map((r) => r.value));
  const maxE1rm = Math.max(...allResults.map((r) => r.value));

  // Card title mirrors the real component
  const hasLift = Boolean(lift);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: T.bg,
          color: T.fg,
          fontFamily: "system-ui, sans-serif",
          padding: "40px 48px",
        }}
      >
        {/* Top: branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: T.mutedFg,
            }}
          >
            STRENGTH JOURNEYS
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: T.mutedFg,
            }}
          >
            strengthjourneys.xyz
          </div>
        </div>

        {/* Main: card + formula bars side by side */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "40px",
            alignItems: "center",
          }}
        >
          {/* Left: E1RM summary card (matches the real card UI) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              border: `2px solid ${T.border}`,
              borderRadius: "12px",
              padding: "28px 32px 20px",
              background: T.card,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {/* Card title */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              {hasLift ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "28px", fontWeight: 700 }}>
                    {lift}
                  </span>
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: 600,
                      color: T.mutedFg,
                    }}
                  >
                    Estimated 1RM
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: "26px", fontWeight: 700 }}>
                  Estimated One Rep Max
                </span>
              )}
            </div>

            {/* Input set: reps@weight */}
            <div
              style={{
                display: "flex",
                fontSize: "22px",
                color: T.mutedFg,
                marginBottom: "4px",
              }}
            >
              {reps}@{weight}{unit}
            </div>

            {/* Big E1RM number */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "96px",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {e1rm}
              </span>
              <span
                style={{
                  fontSize: "40px",
                  fontWeight: 700,
                  opacity: 0.6,
                  marginLeft: "4px",
                }}
              >
                {unit}
              </span>
            </div>

            {/* Strength rating */}
            {strengthRating && (
              <div
                style={{
                  display: "flex",
                  fontSize: "22px",
                  fontWeight: 600,
                  marginTop: "8px",
                }}
              >
                {ratingEmoji} {strengthRating}
              </div>
            )}

            {/* Percentile */}
            {gymGoerPercentile != null && (
              <div
                style={{
                  display: "flex",
                  fontSize: "16px",
                  color: T.mutedFg,
                  marginTop: "4px",
                }}
              >
                Stronger than {gymGoerPercentile}% of gym-goers your age
              </div>
            )}

            {/* BW multiple */}
            {bwMultiple && (
              <div
                style={{
                  display: "flex",
                  fontSize: "16px",
                  color: T.mutedFg,
                  marginTop: "4px",
                }}
              >
                {bwMultiple}× bodyweight
              </div>
            )}

            {/* Footer: formula name */}
            <div
              style={{
                display: "flex",
                fontSize: "16px",
                color: T.mutedFg,
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: `1px solid ${T.border}`,
                width: "100%",
                justifyContent: "center",
              }}
            >
              Using the {validFormula} formula
            </div>
          </div>

          {/* Right: formula comparison bars */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "380px",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "15px",
                fontWeight: 600,
                color: T.mutedFg,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              All 7 Formulas
            </div>
            {allResults.map((result) => {
              const range = maxE1rm - minE1rm || 1;
              const barWidth = Math.max(
                30,
                ((result.value - minE1rm) / range) * 70 + 30,
              );
              const isActive = result.name === validFormula;

              return (
                <div
                  key={result.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      width: "80px",
                      textAlign: "right",
                      color: isActive ? T.fg : T.mutedFg,
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    {result.name}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flex: 1,
                      height: "26px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        borderRadius: "4px",
                        background: isActive ? T.primary : T.muted,
                        border: isActive ? "none" : `1px solid ${T.border}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? T.fg : T.mutedFg,
                        marginLeft: "8px",
                      }}
                    >
                      {result.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
