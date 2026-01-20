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
 * @param {number} targetWarmupCount - Desired number of warmup sets before top (including bar)
 * @returns {Array} Array of warmup set objects with {weight, reps, percentage}
 */
export function generateWarmupSets(
  topWeight,
  topReps,
  barWeight,
  isMetric,
  platePreference = "red",
  targetWarmupCount = 4,
) {
  if (!topWeight || topWeight <= 0 || topReps <= 0) {
    return [];
  }

  const roundToIncrement = (value, increment) =>
    Math.round(value / increment) * increment;

  const warmupSets = [];
  const minIncrement = isMetric ? 2.5 : 5; // Minimum plate increment
  const minJump = isMetric ? 5 : 10; // Base minimum meaningful jump between sets

  // Clamp target warmup count to a reasonable range
  const clampedTargetCount = Math.min(Math.max(Math.round(targetWarmupCount), 2), 6);

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
    const heavyThresholdKg = 150;
    if (topWeight >= heavyThresholdKg && platePreference !== "blue") {
      anchorTarget = 70;
    } else {
      anchorTarget = 60;
    }
  } else {
    // Imperial: 135lb (blue 45s) vs 155lb (red 55s)
    const heavyThresholdLb = 330;
    if (topWeight >= heavyThresholdLb && platePreference !== "blue") {
      anchorTarget = 155;
    } else {
      anchorTarget = 135;
    }
  }

  // Let the target number of warmup sets influence jump size:
  // fewer sets -> bigger jumps, more sets -> smaller jumps
  const volumeJumpMultiplier =
    clampedTargetCount <= 3 ? 1.4 : clampedTargetCount >= 5 ? 0.8 : 1.0;
  const totalRange = Math.max(topWeight - barWeight, minIncrement);
  const desiredAvgJump = totalRange / clampedTargetCount;
  const effectiveMinJump = Math.min(minJump * volumeJumpMultiplier, desiredAvgJump);

  let previousWeight = barWeight;
  let previousPlateMap = buildPlateCountMap([]);

  // Only add anchor (big plate jump) if user wants fewer warmups.
  // For many warmups (5-6), skip the anchor and use gradual percentage-based sets from bar.
  const shouldUseAnchor = clampedTargetCount <= 4;

  if (shouldUseAnchor) {
    // Only add anchor if it makes sense (meaningful jump and below top)
    if (
      anchorTarget > barWeight + effectiveMinJump &&
      anchorTarget < topWeight - effectiveMinJump
    ) {
      const anchorBreakdown = calculatePlateBreakdown(
        anchorTarget,
        barWeight,
        isMetric,
        platePreference,
      );
      const anchorWeight = anchorBreakdown.closestWeight;

      if (
        anchorWeight > barWeight + effectiveMinJump &&
        anchorWeight < topWeight - effectiveMinJump
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
  }

  // Calculate how many sets we still need (excluding bar, which is already added)
  const setsNeeded = clampedTargetCount - warmupSets.length;

  // Generate percentage candidates dynamically based on what we need
  const getScheme = () => {
    // Base percentages vary by rep range
    let basePercentages, baseRepScheme;
    if (topReps >= 5) {
      basePercentages = [0.6, 0.75, 0.85, 0.9];
      baseRepScheme = [5, 4, 3, 2];
    } else if (topReps >= 3) {
      basePercentages = [0.7, 0.8, 0.9, 0.95];
      baseRepScheme = [3, 3, 2, 1];
    } else {
      basePercentages = [0.8, 0.87, 0.93, 0.97];
      baseRepScheme = [3, 2, 2, 1];
    }

    // If we need more sets than base percentages, generate evenly spaced ones
    if (setsNeeded > basePercentages.length) {
      const startPct = basePercentages[0];
      const endPct = basePercentages[basePercentages.length - 1];
      const percentages = [];
      const repScheme = [];

      for (let i = 0; i < setsNeeded; i++) {
        const pct = startPct + ((endPct - startPct) * i) / (setsNeeded - 1);
        percentages.push(pct);
        // Interpolate reps: more reps for lighter sets, fewer for heavier
        const repIdx = Math.floor((i / (setsNeeded - 1)) * (baseRepScheme.length - 1));
        repScheme.push(baseRepScheme[repIdx] || 1);
      }

      return { percentages, repScheme };
    }

    // Otherwise use base scheme, but only take what we need
    return {
      percentages: basePercentages.slice(0, setsNeeded),
      repScheme: baseRepScheme.slice(0, setsNeeded),
    };
  };

  const { percentages, repScheme } = getScheme();

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
        roundedDesired <= previousWeight + effectiveMinJump ||
        roundedDesired >= topWeight - effectiveMinJump
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
        actualWeight <= previousWeight + effectiveMinJump ||
        actualWeight >= topWeight - effectiveMinJump
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
    // Stop once we've reached the requested number of warmup sets
    if (warmupSets.length >= clampedTargetCount) {
      return;
    }
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

  // If we're still short of the target, keep generating intermediate sets
  // by evenly spacing between last warmup and top set
  while (warmupSets.length < clampedTargetCount && warmupSets.length > 0) {
    const lastSet = warmupSets[warmupSets.length - 1];
    const gap = topWeight - lastSet.weight;

    // If gap is too small, we can't fit more sets
    if (gap < effectiveMinJump * 1.5) {
      break;
    }

    // Try a set at roughly 50% of the remaining gap
    const targetPct = (lastSet.weight + gap * 0.5) / topWeight;
    const reps = topReps >= 5 ? 3 : topReps >= 3 ? 2 : 1;
    const next = findNextWarmupFromPercentage(targetPct, reps);

    if (next && next.weight > lastSet.weight && next.weight < topWeight) {
      warmupSets.push({
        weight: next.weight,
        reps: next.reps,
        percentage: Math.round((next.weight / topWeight) * 100),
      });
      previousWeight = next.weight;
      previousPlateMap = next.plateMap;
    } else {
      // If we can't add a set, try with a slightly relaxed constraint
      // by temporarily reducing effectiveMinJump
      const relaxedJump = effectiveMinJump * 0.7;
      let relaxedDesired = (lastSet.weight + topWeight) / 2;
      const relaxedRounded = roundToIncrement(relaxedDesired, minIncrement);

      if (
        relaxedRounded > lastSet.weight + relaxedJump &&
        relaxedRounded < topWeight - relaxedJump
      ) {
        const relaxedBreakdown = calculatePlateBreakdown(
          relaxedRounded,
          barWeight,
          isMetric,
          platePreference,
        );
        const relaxedWeight = relaxedBreakdown.closestWeight;

        if (
          relaxedWeight > lastSet.weight + relaxedJump &&
          relaxedWeight < topWeight - relaxedJump
        ) {
          warmupSets.push({
            weight: relaxedWeight,
            reps,
            percentage: Math.round((relaxedWeight / topWeight) * 100),
          });
          previousWeight = relaxedWeight;
          previousPlateMap = buildPlateCountMap(relaxedBreakdown.platesPerSide);
        } else {
          break;
        }
      } else {
        break;
      }
    }
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
