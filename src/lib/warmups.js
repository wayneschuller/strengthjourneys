/**
 * Warmup generation utilities following Starting Strength methodology
 * and plate breakdown calculations for barbell loading
 */

/**
 * Generate warmup sets based on Starting Strength methodology
 * @param {number} topWeight - Target weight for the top set
 * @param {number} topReps - Number of reps for the top set
 * @param {number} barWeight - Weight of the barbell
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @returns {Array} Array of warmup set objects with {weight, reps, percentage}
 */
export function generateWarmupSets(topWeight, topReps, barWeight, isMetric) {
  if (!topWeight || topWeight <= 0 || topReps <= 0) {
    return [];
  }

  const warmupSets = [];
  const minIncrement = isMetric ? 2.5 : 5; // Minimum plate increment

  // Always start with empty bar
  warmupSets.push({
    weight: barWeight,
    reps: 5,
    percentage: 0,
    isBarOnly: true,
  });

  // For very light weights, we might only need the bar
  if (topWeight <= barWeight + minIncrement) {
    return warmupSets;
  }

  // Calculate working weight (total minus bar)
  const workingWeight = topWeight - barWeight;

  // Starting Strength style progression
  // For higher rep sets (5+), use more gradual progression
  // For lower rep sets (1-3), use fewer but heavier warmup sets
  if (topReps >= 5) {
    // Standard progression: 40%, 60%, 80% of working weight
    const percentages = [0.4, 0.6, 0.8];
    const repScheme = [5, 3, 2];

    percentages.forEach((pct, idx) => {
      const warmupWorkingWeight = workingWeight * pct;
      const warmupTotalWeight = barWeight + warmupWorkingWeight;

      // Round to nearest plate increment
      const roundedWeight = Math.round(warmupTotalWeight / minIncrement) * minIncrement;

      // Only add if it's heavier than previous set and lighter than top set
      const lastSetWeight = warmupSets[warmupSets.length - 1]?.weight || barWeight;
      if (
        roundedWeight > lastSetWeight &&
        roundedWeight < topWeight
      ) {
        warmupSets.push({
          weight: roundedWeight,
          reps: repScheme[idx] || 1,
          percentage: Math.round((roundedWeight / topWeight) * 100),
        });
      }
    });
  } else if (topReps >= 3) {
    // For 3-4 rep sets: 50%, 70%, 85%
    const percentages = [0.5, 0.7, 0.85];
    const repScheme = [3, 2, 1];

    percentages.forEach((pct, idx) => {
      const warmupWorkingWeight = workingWeight * pct;
      const warmupTotalWeight = barWeight + warmupWorkingWeight;
      const roundedWeight = Math.round(warmupTotalWeight / minIncrement) * minIncrement;

      if (
        roundedWeight > barWeight &&
        roundedWeight < topWeight &&
        (!warmupSets.length || roundedWeight > warmupSets[warmupSets.length - 1].weight)
      ) {
        warmupSets.push({
          weight: roundedWeight,
          reps: repScheme[idx] || 1,
          percentage: Math.round((roundedWeight / topWeight) * 100),
        });
      }
    });
  } else {
    // For 1-2 rep sets: 60%, 80%, 90%
    const percentages = [0.6, 0.8, 0.9];
    const repScheme = [3, 2, 1];

    percentages.forEach((pct, idx) => {
      const warmupWorkingWeight = workingWeight * pct;
      const warmupTotalWeight = barWeight + warmupWorkingWeight;
      const roundedWeight = Math.round(warmupTotalWeight / minIncrement) * minIncrement;

      if (
        roundedWeight > barWeight &&
        roundedWeight < topWeight &&
        (!warmupSets.length || roundedWeight > warmupSets[warmupSets.length - 1].weight)
      ) {
        warmupSets.push({
          weight: roundedWeight,
          reps: repScheme[idx] || 1,
          percentage: Math.round((roundedWeight / topWeight) * 100),
        });
      }
    });
  }

  // Remove duplicates (can happen with very light weights)
  const uniqueSets = [];
  const seenWeights = new Set();
  warmupSets.forEach((set) => {
    if (!seenWeights.has(set.weight)) {
      seenWeights.add(set.weight);
      uniqueSets.push(set);
    }
  });

  return uniqueSets;
}

/**
 * Standard plate sets for kg and lb
 */
export const PLATE_SETS = {
  kg: [
    { weight: 25, color: "#DC2626", name: "25kg" }, // Red
    { weight: 20, color: "#2563EB", name: "20kg" }, // Blue
    { weight: 15, color: "#FACC15", name: "15kg" }, // Yellow (vivid yellow)
    { weight: 10, color: "#22C55E", name: "10kg" }, // Green (more vivid)
    { weight: 5, color: "#FFFFFF", name: "5kg" }, // White
    { weight: 2.5, color: "#F59E0B", name: "2.5kg" }, // Orange/Small
    { weight: 1.25, color: "#6B7280", name: "1.25kg" }, // Gray/Micro
  ],
  lb: [
    { weight: 55, color: "#DC2626", name: "55lb" }, // Red (like 25kg)
    { weight: 45, color: "#2563EB", name: "45lb" }, // Blue (like 20kg)
    { weight: 35, color: "#FACC15", name: "35lb" }, // Yellow (like 15kg)
    { weight: 25, color: "#22C55E", name: "25lb" }, // Green (like 10kg)
    { weight: 10, color: "#10B981", name: "10lb" }, // Green
    { weight: 5, color: "#FFFFFF", name: "5lb" }, // White
    { weight: 2.5, color: "#F59E0B", name: "2.5lb" }, // Orange/Small
  ],
};

/**
 * Calculate plate breakdown for a given total weight
 * @param {number} totalWeight - Total weight including bar
 * @param {number} barWeight - Weight of the barbell
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" to prefer red or blue plates
 * @returns {Object} { platesPerSide, remainder, closestWeight }
 */
export function calculatePlateBreakdown(
  totalWeight,
  barWeight,
  isMetric,
  platePreference = "red",
) {
  if (totalWeight < barWeight) {
    return {
      platesPerSide: [],
      remainder: totalWeight - barWeight,
      closestWeight: barWeight,
    };
  }

  let availablePlates = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;

  // Filter out non-preferred plate type
  if (platePreference === "blue") {
    // Prefer blue: exclude red plates
    // For kg: exclude 25kg (red), for lb: exclude 55lb (red)
    availablePlates = availablePlates.filter(
      (plate) => !(isMetric ? plate.weight === 25 : plate.weight === 55),
    );
  } else {
    // Prefer red: exclude blue plates
    // For kg: exclude 20kg (blue), for lb: exclude 45lb (blue)
    availablePlates = availablePlates.filter(
      (plate) => !(isMetric ? plate.weight === 20 : plate.weight === 45),
    );
  }
  const minIncrement = isMetric ? 1.25 : 2.5; // Smallest plate
  const weightPerSide = (totalWeight - barWeight) / 2;

  if (weightPerSide < 0) {
    return {
      platesPerSide: [],
      remainder: weightPerSide,
      closestWeight: barWeight,
    };
  }

  const platesPerSide = [];
  let remaining = weightPerSide;

  // Greedy algorithm: use largest plates first
  for (const plate of availablePlates) {
    const count = Math.floor(remaining / plate.weight);
    if (count > 0) {
      platesPerSide.push({
        ...plate,
        count,
      });
      remaining -= count * plate.weight;
    }
  }

  // Calculate remainder and closest buildable weight
  const totalPlatesWeight = platesPerSide.reduce(
    (sum, p) => sum + p.weight * p.count,
    0,
  );
  const actualWeight = barWeight + totalPlatesWeight * 2;
  const remainder = totalWeight - actualWeight;
  const closestWeight = actualWeight;

  return {
    platesPerSide,
    remainder: Math.abs(remainder) < 0.01 ? 0 : remainder, // Round near-zero to 0
    closestWeight,
  };
}

/**
 * Format plate breakdown as text
 * @param {Object} breakdown - Result from calculatePlateBreakdown
 * @param {number} barWeight - Weight of the barbell
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @returns {string} Human-readable plate description
 */
export function formatPlateBreakdown(breakdown, barWeight, isMetric) {
  const { platesPerSide } = breakdown;
  const unit = isMetric ? "kg" : "lb";

  if (platesPerSide.length === 0) {
    return `Bar only (${barWeight}${unit})`;
  }

  const plateDescriptions = platesPerSide.map(
    (p) => `${p.count * 2} x ${p.weight}${unit}`,
  );
  return `Bar + ${plateDescriptions.join(" + ")}`;
}
