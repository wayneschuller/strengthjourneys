/** @format */
// Percentile line: "Stronger than 72% of gym-goers" for a given E1RM.
// Picks the most elite universe where the percentile crosses 60, and links
// out to the per-lift calculator.

import { useMemo } from "react";
import Link from "next/link";
import {
  getLiftPercentiles,
  UNIVERSES,
} from "@/lib/strength-circles/universe-percentiles";
import {
  LIFT_TYPE_TO_PERCENTILE_KEY,
  LIFT_TYPE_TO_CALCULATOR_URL,
} from "@/lib/strength-circles/strength-score";

const UNIVERSE_LABELS = {
  "General Population": "the general population",
  "Gym-Goers": "gym-goers",
  "Barbell Lifters": "barbell lifters",
  "Powerlifting Culture": "the powerlifting community",
};

export function LiftPercentileLine({
  liftType,
  e1rmValue,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const percentileKey = LIFT_TYPE_TO_PERCENTILE_KEY[liftType];
  const calculatorUrl = LIFT_TYPE_TO_CALCULATOR_URL[liftType] ?? "/calculator";

  const bestUniverse = useMemo(() => {
    if (!percentileKey || !e1rmValue || !age || bodyWeight == null || !sex) {
      return null;
    }

    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    const e1rmKg = isMetric ? e1rmValue : e1rmValue / 2.2046;
    const allPercentiles = getLiftPercentiles(
      age,
      bodyWeightKg,
      sex === "female" ? "female" : "male",
      percentileKey,
      e1rmKg,
    );
    if (!allPercentiles) return null;

    // Pick the most elite (rightmost) universe where percentile >= 60
    let best = null;
    for (const universe of UNIVERSES) {
      const pct = allPercentiles[universe];
      if (pct != null && pct >= 60) {
        best = {
          universe,
          percentile: pct,
          label: UNIVERSE_LABELS[universe],
        };
      }
    }
    return best;
  }, [age, bodyWeight, e1rmValue, isMetric, percentileKey, sex]);

  if (!bestUniverse) return null;

  return (
    <div className="text-xs text-muted-foreground">
      <Link
        href={calculatorUrl}
        className="transition-colors hover:text-foreground"
      >
        Stronger than {bestUniverse.percentile}% of {bestUniverse.label}
      </Link>
    </div>
  );
}
