import { ImageResponse } from "@vercel/og";

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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const weight = Number(searchParams.get("weight")) || 225;
  const reps = Math.max(1, Math.min(Number(searchParams.get("reps")) || 5, 30));
  const isMetric = searchParams.get("calcIsMetric") === "true";
  const formula = searchParams.get("formula") || "Brzycki";
  const unit = isMetric ? "kg" : "lb";

  // Sanitize formula name
  const validFormula = E1RM_FORMULAE.includes(formula) ? formula : "Brzycki";

  const e1rm = estimateE1RM(reps, weight, validFormula);

  // Calculate all formulas for the comparison bar
  const allResults = E1RM_FORMULAE.map((f) => ({
    name: f,
    value: estimateE1RM(reps, weight, f),
  }));
  const minE1rm = Math.min(...allResults.map((r) => r.value));
  const maxE1rm = Math.max(...allResults.map((r) => r.value));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #0c0c0c 0%, #1a1a1a 50%, #0c0c0c 100%)",
          color: "#fafaf9",
          fontFamily: "system-ui, sans-serif",
          padding: "48px 56px",
        }}
      >
        {/* Top bar: branding + input */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#a8a29e",
            }}
          >
            STRENGTH JOURNEYS
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "22px",
              color: "#78716c",
            }}
          >
            1RM Calculator
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "48px",
            alignItems: "center",
          }}
        >
          {/* Left: the result */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {/* Input set */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "28px", color: "#a8a29e" }}>
                Set:
              </span>
              <span style={{ fontSize: "36px", fontWeight: 700 }}>
                {weight} {unit} x {reps} rep{reps !== 1 ? "s" : ""}
              </span>
            </div>

            {/* E1RM result */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "22px",
                  color: "#78716c",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "4px",
                }}
              >
                Estimated One Rep Max
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "120px",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    background: "linear-gradient(135deg, #fafaf9 0%, #d6d3d1 100%)",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {e1rm}
                </span>
                <span
                  style={{
                    fontSize: "40px",
                    fontWeight: 600,
                    color: "#a8a29e",
                  }}
                >
                  {unit}
                </span>
              </div>
            </div>

            {/* Formula name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "24px",
                color: "#78716c",
              }}
            >
              via the {validFormula} formula
            </div>
          </div>

          {/* Right: formula comparison */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "360px",
              gap: "10px",
            }}
          >
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
                      fontSize: "16px",
                      width: "90px",
                      textAlign: "right",
                      color: isActive ? "#fafaf9" : "#78716c",
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
                      height: "28px",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        borderRadius: "4px",
                        background: isActive
                          ? "linear-gradient(90deg, #78716c, #a8a29e)"
                          : "#292524",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? "#fafaf9" : "#57534e",
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

        {/* Bottom: URL */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "24px",
            fontSize: "20px",
            color: "#57534e",
          }}
        >
          strengthjourneys.xyz/calculator
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
