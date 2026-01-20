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
 * @param {string} platePreference - "red" or "blue" plate preference
 * @returns {Array} Array of warmup set objects with {weight, reps, percentage}
 */
export function generateWarmupSets(
  topWeight,
  topReps,
  barWeight,
  isMetric,
  platePreference = "red",
) {
  if (!topWeight || topWeight <= 0 || topReps <= 0) {
    return [];
  }

  const roundToIncrement = (value, increment) =>
    Math.round(value / increment) * increment;

  const warmupSets = [];
  const minIncrement = isMetric ? 2.5 : 5; // Minimum plate increment
  const minJump = isMetric ? 5 : 10; // Minimum meaningful jump between sets

  // Always start with empty bar
  warmupSets.push({
    weight: barWeight,
    reps: 10,
    percentage: 0,
    isBarOnly: true,
  });

  // For very light weights, we might only need the bar
  if (topWeight <= barWeight + minIncrement) {
    return warmupSets;
  }

  // Helper to build a map of plate counts for "only add plates" checks
  const buildPlateCountMap = (platesPerSide) => {
    const map = new Map();
    platesPerSide.forEach((p) => {
      map.set(p.weight, (map.get(p.weight) || 0) + p.count);
    });
    return map;
  };

  // Choose anchor warmup that sets the big plates which mostly stay on
  let anchorTarget;
  if (isMetric) {
    // Metric: 60kg (blue 20s) for most weights, 70kg (red 25s) for heavy unless blue is explicitly preferred
    const heavyThresholdKg = 140;
    if (topWeight >= heavyThresholdKg && platePreference !== "blue") {
      anchorTarget = 70;
    } else {
      anchorTarget = 60;
    }
  } else {
    // Imperial: 135lb (blue 45s) vs 155lb (red 55s)
    const heavyThresholdLb = 315;
    if (topWeight >= heavyThresholdLb && platePreference !== "blue") {
      anchorTarget = 155;
    } else {
      anchorTarget = 135;
    }
  }

  let previousWeight = barWeight;
  let previousPlateMap = buildPlateCountMap([]);

  // Only add anchor if it makes sense (meaningful jump and below top)
  if (
    anchorTarget > barWeight + minJump &&
    anchorTarget < topWeight - minJump
  ) {
    const anchorBreakdown = calculatePlateBreakdown(
      anchorTarget,
      barWeight,
      isMetric,
      platePreference,
    );
    const anchorWeight = anchorBreakdown.closestWeight;

    if (
      anchorWeight > barWeight + minJump &&
      anchorWeight < topWeight - minJump
    ) {
      warmupSets.push({
        weight: anchorWeight,
        reps: 5,
        percentage: Math.round((anchorWeight / topWeight) * 100),
      });
      previousWeight = anchorWeight;
      previousPlateMap = buildPlateCountMap(anchorBreakdown.platesPerSide);
    }
  }

  // Starting Strength style progression
  // For higher rep sets (5+), use more gradual progression
  // For lower rep sets (1-3), use fewer but heavier warmup sets
  const { percentages, repScheme } =
    topReps >= 5
      ? // 5+ reps: higher volume, we usually want 2 mid sets
        { percentages: [0.75, 0.9], repScheme: [4, 3] }
      : topReps >= 3
        ? // 3-4 reps: slightly fewer sets
          { percentages: [0.8, 0.9], repScheme: [3, 2] }
        : // 1-2 reps: minimal volume
          { percentages: [0.85, 0.95], repScheme: [3, 2] };

  // Helper that finds the next practical warmup weight honouring:
  // - rounding to plate increments
  // - only adding plates (no removing)
  // - being between previous and top with a meaningful jump
  const findNextWarmupFromPercentage = (pct, reps) => {
    let desired = topWeight * pct;

    // Small safety to avoid infinite loops
    for (let i = 0; i < 20; i++) {
      const roundedDesired = roundToIncrement(desired, minIncrement);

      if (
        roundedDesired <= previousWeight + minJump ||
        roundedDesired >= topWeight - minJump
      ) {
        return null;
      }

      const breakdown = calculatePlateBreakdown(
        roundedDesired,
        barWeight,
        isMetric,
        platePreference,
      );
      const actualWeight = breakdown.closestWeight;

      if (
        actualWeight <= previousWeight + minJump ||
        actualWeight >= topWeight - minJump
      ) {
        desired += minIncrement;
        continue;
      }

      const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);

      // Enforce "only add plates": for every existing plate weight,
      // the new count must be >= previous.
      let onlyAdding = true;
      previousPlateMap.forEach((prevCount, weight) => {
        const nextCount = newPlateMap.get(weight) || 0;
        if (nextCount < prevCount) {
          onlyAdding = false;
        }
      });

      if (!onlyAdding) {
        desired += minIncrement;
        continue;
      }

      return {
        weight: actualWeight,
        reps,
        plateMap: newPlateMap,
      };
    }

    return null;
  };

  percentages.forEach((pct, idx) => {
    const reps = repScheme[idx] || 1;
    const next = findNextWarmupFromPercentage(pct, reps);
    if (next) {
      warmupSets.push({
        weight: next.weight,
        reps: next.reps,
        percentage: Math.round((next.weight / topWeight) * 100),
      });
      previousWeight = next.weight;
      previousPlateMap = next.plateMap;
    }
  });

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

  const allPlates = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;
  const minIncrement = isMetric ? 1.25 : 2.5; // Smallest plate
  const weightPerSide = (totalWeight - barWeight) / 2;

  if (weightPerSide < 0) {
    return {
      platesPerSide: [],
      remainder: weightPerSide,
      closestWeight: barWeight,
    };
  }

  // Helper function to calculate plate breakdown with given plate set
  const calculateWithPlates = (plates) => {
    const result = [];
    let remaining = weightPerSide;

    // Greedy algorithm: use largest plates first
    for (const plate of plates) {
      const count = Math.floor(remaining / plate.weight);
      if (count > 0) {
        result.push({
          ...plate,
          count,
        });
        remaining -= count * plate.weight;
      }
    }

    const totalPlatesWeight = result.reduce(
      (sum, p) => sum + p.weight * p.count,
      0,
    );
    const actualWeight = barWeight + totalPlatesWeight * 2;
    const remainder = totalWeight - actualWeight;

    return {
      platesPerSide: result,
      remainder: Math.abs(remainder) < 0.01 ? 0 : remainder,
      closestWeight: actualWeight,
      totalPlateCount: result.reduce((sum, p) => sum + p.count, 0),
    };
  };

  // Calculate with all plates (no preference filter)
  const breakdownAll = calculateWithPlates(allPlates);

  // Calculate with preference filter
  let filteredPlates = allPlates;
  if (platePreference === "blue") {
    // Prefer blue: exclude red plates
    filteredPlates = allPlates.filter(
      (plate) => !(isMetric ? plate.weight === 25 : plate.weight === 55),
    );
  } else {
    // Prefer red: exclude blue plates
    filteredPlates = allPlates.filter(
      (plate) => !(isMetric ? plate.weight === 20 : plate.weight === 45),
    );
  }
  const breakdownPreferred = calculateWithPlates(filteredPlates);

  // Use whichever has fewer total plates
  // If equal, prefer the one that matches preference
  if (breakdownAll.totalPlateCount < breakdownPreferred.totalPlateCount) {
    return {
      platesPerSide: breakdownAll.platesPerSide,
      remainder: breakdownAll.remainder,
      closestWeight: breakdownAll.closestWeight,
    };
  } else if (breakdownPreferred.totalPlateCount < breakdownAll.totalPlateCount) {
    return {
      platesPerSide: breakdownPreferred.platesPerSide,
      remainder: breakdownPreferred.remainder,
      closestWeight: breakdownPreferred.closestWeight,
    };
  } else {
    // Equal plate count - prefer the one that matches preference
    return {
      platesPerSide: breakdownPreferred.platesPerSide,
      remainder: breakdownPreferred.remainder,
      closestWeight: breakdownPreferred.closestWeight,
    };
  }
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
