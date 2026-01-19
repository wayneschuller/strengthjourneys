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
export function generateWarmupSets(topWeight, topReps, barWeight, isMetric, platePreference = "red") {
  if (!topWeight || topWeight <= 0 || topReps <= 0) {
    return [];
  }

  const warmupSets = [];
  const minIncrement = isMetric ? 2.5 : 5; // Minimum plate increment
  const minJump = isMetric ? 5 : 10; // Minimum meaningful jump between sets
  const maxGapToTop = isMetric ? 20 : 45; // Maximum gap before top set (add intermediate if larger)

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

  // For lifts over 100kg/225lb, add a standard first warmup with plates
  const heavyLiftThreshold = isMetric ? 100 : 225;
  if (topWeight > heavyLiftThreshold) {
    const heavyLiftThresholdRed = isMetric ? 140 : 315;
    
    let firstWarmupWeight;
    if (platePreference === "blue" || (platePreference === "red" && topWeight <= heavyLiftThresholdRed)) {
      // Use blue plates: 60kg (20kg bar + 2x20kg) or 135lb (45lb bar + 2x45lb)
      firstWarmupWeight = isMetric ? 60 : 135;
    } else {
      // Prefer red and top set > 140kg/315lb: use red plates
      // 70kg (20kg bar + 2x25kg) or 155lb (45lb bar + 2x55lb)
      firstWarmupWeight = isMetric ? 70 : 155;
    }
    
    // Only add if it's heavier than bar and lighter than top set
    if (firstWarmupWeight > barWeight && firstWarmupWeight < topWeight) {
      warmupSets.push({
        weight: firstWarmupWeight,
        reps: 5,
        percentage: Math.round((firstWarmupWeight / topWeight) * 100),
      });
    }
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
      const jump = roundedWeight - lastSetWeight;
      
      // Skip if jump is too small (less than minimum meaningful jump)
      if (
        roundedWeight > lastSetWeight &&
        roundedWeight < topWeight &&
        jump >= minJump
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

      const lastSetWeight = warmupSets[warmupSets.length - 1]?.weight || barWeight;
      const jump = roundedWeight - lastSetWeight;

      if (
        roundedWeight > lastSetWeight &&
        roundedWeight < topWeight &&
        jump >= minJump
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

      const lastSetWeight = warmupSets[warmupSets.length - 1]?.weight || barWeight;
      const jump = roundedWeight - lastSetWeight;

      if (
        roundedWeight > lastSetWeight &&
        roundedWeight < topWeight &&
        jump >= minJump
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

  // Check if gap between last warmup and top set is too large
  // If so, add an intermediate set at ~90-92% of top set
  if (uniqueSets.length > 0) {
    const lastWarmup = uniqueSets[uniqueSets.length - 1];
    const gapToTop = topWeight - lastWarmup.weight;
    
    if (gapToTop > maxGapToTop) {
      // Add an intermediate set at ~90% of top set
      const intermediateWeight = Math.round((topWeight * 0.9) / minIncrement) * minIncrement;
      
      // Only add if it's meaningfully different from last warmup and top set
      if (
        intermediateWeight > lastWarmup.weight + minJump &&
        intermediateWeight < topWeight - minJump
      ) {
        uniqueSets.push({
          weight: intermediateWeight,
          reps: 1,
          percentage: Math.round((intermediateWeight / topWeight) * 100),
        });
      }
    }
  }

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
