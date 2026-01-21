/**
 * Warmup generation utilities following Starting Strength methodology
 * and plate breakdown calculations for barbell loading
 */

/**
 * Generate warmup sets and top set based on Starting Strength methodology
 * @param {number} topWeight - Target weight for the top set
 * @param {number} topReps - Number of reps for the top set
 * @param {number} barWeight - Weight of the barbell
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" plate preference
 * @param {number} targetWarmupCount - Desired number of warmup sets before top (including bar)
 * @returns {{warmupSets: Array<{weight: number, reps: number, percentage: number, plateBreakdown: {platesPerSide: Array, remainder: number, closestWeight: number}, isBarOnly?: boolean}>, topSet: {weight: number, reps: number, plateBreakdown: {platesPerSide: Array, remainder: number, closestWeight: number}}}} Object with warmup sets array and top set object, both with plate breakdowns
 */
export function generateSessionSets(
  topWeight,
  topReps,
  barWeight,
  isMetric,
  platePreference = "red",
  targetWarmupCount = 4,
) {
  if (!topWeight || topWeight <= 0 || topReps <= 0) {
    return {
      warmupSets: [],
      topSet: {
        weight: topWeight,
        reps: topReps,
        plateBreakdown: calculatePlateBreakdown(topWeight, barWeight, isMetric, platePreference),
      },
    };
  }

  const roundToIncrement = (value, increment) =>
    Math.round(value / increment) * increment;

  const warmupSets = [];
  const minIncrement = isMetric ? 2.5 : 5; // Minimum plate increment

  // Clamp target warmup count to a reasonable range
  const clampedTargetCount = Math.min(Math.max(Math.round(targetWarmupCount), 2), 6);

  // Determine base jump size based on the top set weight
  // Heavier weights need larger jumps between warmup sets
  let baseJump;
  if (isMetric) {
    if (topWeight < 60) {
      baseJump = 2.5;
    } else if (topWeight <= 140) {
      baseJump = 5;
    } else {
      baseJump = 10;
    }
  } else {
    if (topWeight < 135) {
      baseJump = 5;
    } else if (topWeight <= 310) {
      baseJump = 10;
    } else {
      baseJump = 20;
    }
  }

  // Calculate effective minimum jump, accounting for target warmup count
  // More warmup sets = smaller average jumps, fewer sets = larger jumps
  const volumeJumpMultiplier =
    clampedTargetCount <= 3 ? 1.4 : clampedTargetCount >= 5 ? 0.8 : 1.0;
  const totalRange = Math.max(topWeight - barWeight, minIncrement);
  const desiredAvgJump = totalRange / clampedTargetCount;
  const effectiveMinJump = Math.min(baseJump * volumeJumpMultiplier, desiredAvgJump);

  // Helper to build a map of plate counts for "only add plates" checks
  const buildPlateCountMap = (platesPerSide) => {
    const map = new Map();
    platesPerSide.forEach((p) => {
      map.set(p.weight, (map.get(p.weight) || 0) + p.count);
    });
    return map;
  };

  // ============================================
  // OPENING SETS: Empty bar and anchor plate set
  // ============================================

  // Always start with empty bar for 10 reps
  // This allows the lifter to warm up movement pattern without load
  warmupSets.push({
    weight: barWeight,
    reps: 10,
    percentage: 0,
    isBarOnly: true,
    plateBreakdown: {
      platesPerSide: [],
      remainder: 0,
      closestWeight: barWeight,
    },
  });

  // For very light weights, we might only need the bar
  if (topWeight <= barWeight + minIncrement) {
    const topSetBreakdown = calculatePlateBreakdown(topWeight, barWeight, isMetric, platePreference);
    return {
      warmupSets,
      topSet: {
        weight: topWeight,
        reps: topReps,
        plateBreakdown: topSetBreakdown,
      },
    };
  }

  let previousWeight = barWeight;
  let previousPlateMap = buildPlateCountMap([]);

  // Choose anchor plate weight based on top weight and plate preference
  // Anchor plate is the largest plate used in the first loaded warmup set
  // For heavy lifts, prefer red (25kg/55lb) if available; otherwise use blue (20kg/45lb)
  let anchorTarget;
  const heavyThreshold = isMetric ? 150 : 330;
  const range = topWeight - barWeight;
  const avgJumpNeeded = range / clampedTargetCount;

  if (isMetric) {
    // If many warmups requested and range is small, use smaller anchor
    if (clampedTargetCount >= 5 && avgJumpNeeded < 15) {
      anchorTarget = 50; // Smaller: bar + 2×15kg
    } else if (topWeight >= heavyThreshold && platePreference !== "blue") {
      anchorTarget = 70; // Red 25s
    } else {
      anchorTarget = 60; // Blue 20s
    }
  } else {
    if (clampedTargetCount >= 5 && avgJumpNeeded < 35) {
      anchorTarget = 115; // Smaller: bar + 2×35lb
    } else if (topWeight >= heavyThreshold && platePreference !== "blue") {
      anchorTarget = 155; // Red 55s
    } else {
      anchorTarget = 135; // Blue 45s
    }
  }

  // Add anchor set: first loaded warmup with anchor plates for 5 reps
  // This establishes the base plate loading that subsequent sets build upon
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
        plateBreakdown: anchorBreakdown,
      });
      previousWeight = anchorWeight;
      previousPlateMap = buildPlateCountMap(anchorBreakdown.platesPerSide);

      // For heavy lifts, add a second anchor set by adding another pair of anchor plates
      // This creates a smoother progression for very heavy weights
      if (topWeight > (isMetric ? 140 : 310) && warmupSets.length < clampedTargetCount - 2) {
        const secondAnchorWeight = isMetric
          ? anchorWeight + 40 // Add another pair of 20s
          : anchorWeight + 90; // Add another pair of 45s
        if (secondAnchorWeight < topWeight - effectiveMinJump) {
          const secondAnchorBreakdown = calculatePlateBreakdown(
            secondAnchorWeight,
            barWeight,
            isMetric,
            platePreference,
          );
          const secondAnchorActual = secondAnchorBreakdown.closestWeight;
          if (
            secondAnchorActual > anchorWeight + effectiveMinJump &&
            secondAnchorActual < topWeight - effectiveMinJump
          ) {
            warmupSets.push({
              weight: secondAnchorActual,
              reps: 5,
              percentage: Math.round((secondAnchorActual / topWeight) * 100),
              plateBreakdown: secondAnchorBreakdown,
            });
            previousWeight = secondAnchorActual;
            previousPlateMap = buildPlateCountMap(secondAnchorBreakdown.platesPerSide);
          }
        }
      }
    }
  }

  // ============================================
  // MIDDLE SETS: Progressive 5-rep sets
  // ============================================

  // Calculate how many sets we still need for middle + final sections
  const setsRemaining = clampedTargetCount - warmupSets.length;
  
  // Determine how many final warmup sets we need based on top set reps
  // More final sets needed for 3-4 rep top sets to prime CNS properly
  let finalWarmupCount = 0;
  if (topReps <= 2) {
    // PR attempt: 1 rep at base jump below goal
    finalWarmupCount = 1;
  } else if (topReps >= 5) {
    // 5+ reps: one final warmup at 3 reps, baseJump below top
    finalWarmupCount = 1;
  } else {
    // 3-4 reps: 3 reps, then 2 reps
    finalWarmupCount = 2;
  }

  // Middle section gets the remaining slots, all performed for 5 reps
  // This maintains consistent volume while building load progressively
  const middleSetCount = Math.max(0, setsRemaining - finalWarmupCount);

  // Identify anchor plate weight from the anchor set
  let anchorPlateWeight = null;
  if (warmupSets.length > 1 && previousPlateMap.size > 0) {
    // Find the largest plate in the anchor set (this is our anchor plate)
    previousPlateMap.forEach((count, weight) => {
      if (!anchorPlateWeight || weight > anchorPlateWeight) {
        anchorPlateWeight = weight;
      }
    });
  }

  // Generate middle sets by progressively adding pairs of anchor plates
  if (middleSetCount > 0 && anchorPlateWeight) {
    // Calculate target weights by adding pairs of anchor plates
    // e.g., if anchor is 60kg (bar + 2×20kg), next would be 100kg (bar + 4×20kg), then 140kg (bar + 6×20kg)
    const anchorPairsPerSide = previousPlateMap.get(anchorPlateWeight) || 0;
    
    // Calculate where final warmups start
    let finalWarmupWeight;
    if (topReps <= 2) {
      finalWarmupWeight = topWeight - baseJump;
    } else if (topReps >= 5) {
      const finalJump = topWeight > (isMetric ? 100 : 220) ? (isMetric ? 10 : 25) : baseJump;
      finalWarmupWeight = topWeight - finalJump;
    } else {
      // 3-4 reps: final warmups start earlier
      const finalJump = topWeight > (isMetric ? 100 : 220) ? (isMetric ? 10 : 25) : baseJump;
      finalWarmupWeight = topWeight - finalJump;
    }
    
    // Calculate how many more pairs we can add before hitting final warmup
    const maxPairsNeeded = Math.floor((finalWarmupWeight - previousWeight) / (anchorPlateWeight * 2));
    const pairsToAdd = Math.min(middleSetCount, maxPairsNeeded);
    
    for (let i = 0; i < pairsToAdd; i++) {
      const newPairsPerSide = anchorPairsPerSide + i + 1;
      const targetWeight = barWeight + (newPairsPerSide * anchorPlateWeight * 2);
      
      if (targetWeight >= finalWarmupWeight) {
        break; // Don't go past final warmup
      }
      
      // Use existing plates to build on
      const currentPlatesPerSide = Array.from(previousPlateMap.entries()).map(([weight, count]) => {
        const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(p => p.weight === weight);
        return plateInfo ? { ...plateInfo, count } : null;
      }).filter(Boolean);
      
      const breakdown = calculatePlateBreakdownWithExisting(
        targetWeight,
        barWeight,
        currentPlatesPerSide,
        isMetric,
        platePreference,
      );
      const actualWeight = breakdown.closestWeight;
      
      // Only add if it's meaningfully different and below final warmup
      if (
        actualWeight > previousWeight + effectiveMinJump &&
        actualWeight < finalWarmupWeight - effectiveMinJump
      ) {
        const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);
        
        // Verify only-add-plates constraint
        let onlyAdding = true;
        previousPlateMap.forEach((prevCount, weight) => {
          const nextCount = newPlateMap.get(weight) || 0;
          if (nextCount < prevCount) {
            onlyAdding = false;
          }
        });
        
        if (onlyAdding) {
          warmupSets.push({
            weight: actualWeight,
            reps: 5, // All middle sets are 5 reps
            percentage: Math.round((actualWeight / topWeight) * 100),
            plateBreakdown: breakdown,
          });
          previousWeight = actualWeight;
          previousPlateMap = newPlateMap;
        }
      }
    }
    
    // If we still need more middle sets and can't add more anchor pairs,
    // fill gaps with percentage-based sets that respect only-add-plates
    const openingSetsCount = warmupSets.length > 1 ? 2 : 1; // Bar + anchor (if added)
    const middleSetsAdded = warmupSets.length - openingSetsCount;
    let stillNeeded = middleSetCount - middleSetsAdded;
    if (stillNeeded > 0) {
      const lastWeight = previousWeight;
      // Use same finalWarmupWeight calculation as above
      let finalWarmupWeight;
      if (topReps <= 2) {
        finalWarmupWeight = topWeight - baseJump;
      } else if (topReps >= 5) {
        const finalJump = topWeight > (isMetric ? 100 : 220) ? (isMetric ? 10 : 25) : baseJump;
        finalWarmupWeight = topWeight - finalJump;
      } else {
        const finalJump = topWeight > (isMetric ? 100 : 220) ? (isMetric ? 10 : 25) : baseJump;
        finalWarmupWeight = topWeight - finalJump;
      }
      const gap = finalWarmupWeight - lastWeight;
      
      // Be more aggressive: try multiple positions and relax constraints if needed
      let attempts = 0;
      const maxAttempts = stillNeeded * 15; // Try multiple times per needed set
      
      while (stillNeeded > 0 && warmupSets.length < clampedTargetCount - finalWarmupCount && attempts < maxAttempts) {
        attempts++;
        const setsAdded = warmupSets.length - openingSetsCount - (middleSetCount - stillNeeded);
        const targetWeight = lastWeight + (gap * (setsAdded + 1) / (middleSetCount + 1));
        const roundedWeight = roundToIncrement(targetWeight, minIncrement);
        
        // Progressively relax jump requirement
        const relaxedJump = Math.max(
          effectiveMinJump * 0.4, // Very relaxed
          (gap / (stillNeeded + 1)) * 0.3 // Or based on remaining sets
        );
        
        if (roundedWeight > previousWeight + relaxedJump && roundedWeight < finalWarmupWeight - relaxedJump) {
          // Use existing plates to build on
          const currentPlatesPerSide = Array.from(previousPlateMap.entries()).map(([weight, count]) => {
            const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(p => p.weight === weight);
            return plateInfo ? { ...plateInfo, count } : null;
          }).filter(Boolean);
          
          const breakdown = calculatePlateBreakdownWithExisting(
            roundedWeight,
            barWeight,
            currentPlatesPerSide,
            isMetric,
            platePreference,
          );
          const actualWeight = breakdown.closestWeight;
          
          if (
            actualWeight > previousWeight + relaxedJump &&
            actualWeight < finalWarmupWeight - relaxedJump
          ) {
            const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);
            
            let onlyAdding = true;
            previousPlateMap.forEach((prevCount, weight) => {
              const nextCount = newPlateMap.get(weight) || 0;
              if (nextCount < prevCount) {
                onlyAdding = false;
              }
            });
            
            if (onlyAdding) {
              warmupSets.push({
                weight: actualWeight,
                reps: 5,
                percentage: Math.round((actualWeight / topWeight) * 100),
                plateBreakdown: breakdown,
              });
              previousWeight = actualWeight;
              previousPlateMap = newPlateMap;
              stillNeeded--;
              continue; // Successfully added, try again
            }
          }
        }
        
        // If we couldn't add at that position, try adjusting incrementally
        if (attempts % 3 === 0) {
          // Every 3 attempts, try a slightly different position
          const adjustedTarget = previousWeight + minIncrement * 2;
          if (adjustedTarget >= finalWarmupWeight - relaxedJump) {
            break; // Can't fit more
          }
        }
      }
    }
  }

  // ============================================
  // FINAL WARMUPS: Reduce reps to prime CNS for top set
  // ============================================

  // Helper to add a final warmup set with only-add-plates check
  const addFinalWarmupSet = (targetWeight, reps) => {
    if (warmupSets.length >= clampedTargetCount) {
      return false;
    }

    const roundedWeight = roundToIncrement(targetWeight, minIncrement);
    
    if (
      roundedWeight <= previousWeight + effectiveMinJump ||
      roundedWeight >= topWeight - effectiveMinJump
    ) {
      return false;
    }

    // Use existing plates to build on
    const currentPlatesPerSide = Array.from(previousPlateMap.entries()).map(([weight, count]) => {
      const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(p => p.weight === weight);
      return plateInfo ? { ...plateInfo, count } : null;
    }).filter(Boolean);
    
    const breakdown = calculatePlateBreakdownWithExisting(
      roundedWeight,
      barWeight,
      currentPlatesPerSide,
      isMetric,
      platePreference,
    );
    const actualWeight = breakdown.closestWeight;

    if (
      actualWeight <= previousWeight + effectiveMinJump ||
      actualWeight >= topWeight - effectiveMinJump
    ) {
      return false;
    }

    const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);

    // Enforce only-add-plates constraint
    let onlyAdding = true;
    previousPlateMap.forEach((prevCount, weight) => {
      const nextCount = newPlateMap.get(weight) || 0;
      if (nextCount < prevCount) {
        onlyAdding = false;
      }
    });

    if (!onlyAdding) {
      return false;
    }

    warmupSets.push({
      weight: actualWeight,
      reps,
      percentage: Math.round((actualWeight / topWeight) * 100),
      plateBreakdown: breakdown,
    });
    previousWeight = actualWeight;
    previousPlateMap = newPlateMap;
    return true;
  };

  // Generate final warmup sets based on top set rep count
  // These sets use reduced reps (1-3) to prime the central nervous system
  if (topReps <= 2) {
    // PR attempt: 1 rep at base jump below goal
    const finalWarmupWeight = topWeight - baseJump;
    addFinalWarmupSet(finalWarmupWeight, 1);
  } else if (topReps >= 5) {
    // 5+ reps: one final warmup at 3 reps, baseJump below top (e.g., 130kg for 140kg top)
    // The 3-rep set primes the CNS without causing excessive fatigue
    const finalJump = topWeight > (isMetric ? 100 : 220) 
      ? (isMetric ? 10 : 25)  // ~10kg/25lb for heavier lifts
      : baseJump;
    
    const finalWarmupWeight = topWeight - finalJump;
    addFinalWarmupSet(finalWarmupWeight, 3);
  } else {
    // 3-4 reps: 3 reps, then 2 reps (with smaller jumps ~10kg/20-25lb when top > 100kg/220lb)
    const finalJump = topWeight > (isMetric ? 100 : 220) 
      ? (isMetric ? 10 : 25)
      : baseJump;
    
    // First final warmup: 3 reps
    const firstFinalWeight = topWeight - finalJump;
    if (addFinalWarmupSet(firstFinalWeight, 3)) {
      // Second final warmup: 2 reps at half the jump
      const secondFinalWeight = topWeight - (finalJump / 2);
      addFinalWarmupSet(secondFinalWeight, 2);
    }
  }

  // Fill remaining slots if we're still short of target warmup count
  // Add evenly-spaced sets while maintaining the "only add plates" progression
  // Be aggressive about hitting the target count
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  while (warmupSets.length < clampedTargetCount && warmupSets.length > 0 && attempts < maxAttempts) {
    attempts++;
    const lastSet = warmupSets[warmupSets.length - 1];
    const gap = topWeight - lastSet.weight;
    const setsStillNeeded = clampedTargetCount - warmupSets.length;

    // Calculate minimum gap needed per remaining set
    const minGapPerSet = gap / (setsStillNeeded + 1);
    
    // If gap is too small even with relaxed constraints, we can't fit more
    if (gap < minIncrement * 2) {
      break;
    }

    // Progressively relax jump requirements as we get closer to target
    const relaxedJump = Math.max(
      effectiveMinJump * 0.5, // Very relaxed
      minGapPerSet * 0.8 // Or based on remaining sets
    );

    // Try to add a set at evenly spaced intervals
    const targetWeight = lastSet.weight + minGapPerSet;
    const roundedWeight = roundToIncrement(targetWeight, minIncrement);

    if (
      roundedWeight > lastSet.weight + relaxedJump &&
      roundedWeight < topWeight - relaxedJump
    ) {
      // Use existing plates to build on
      const currentPlatesPerSide = Array.from(previousPlateMap.entries()).map(([weight, count]) => {
        const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(p => p.weight === weight);
        return plateInfo ? { ...plateInfo, count } : null;
      }).filter(Boolean);
      
      const breakdown = calculatePlateBreakdownWithExisting(
        roundedWeight,
        barWeight,
        currentPlatesPerSide,
        isMetric,
        platePreference,
      );
      const actualWeight = breakdown.closestWeight;

      if (
        actualWeight > lastSet.weight + relaxedJump &&
        actualWeight < topWeight - relaxedJump
      ) {
        const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);
        let onlyAdding = true;
        previousPlateMap.forEach((prevCount, weight) => {
          const nextCount = newPlateMap.get(weight) || 0;
          if (nextCount < prevCount) {
            onlyAdding = false;
          }
        });

        if (onlyAdding) {
          warmupSets.push({
            weight: actualWeight,
            reps: 5, // Default to 5 reps for fill-in sets
            percentage: Math.round((actualWeight / topWeight) * 100),
            plateBreakdown: breakdown,
          });
          previousWeight = actualWeight;
          previousPlateMap = newPlateMap;
          continue; // Successfully added, try again
        }
      }
    }
    
    // If we couldn't add at that position, try a slightly different position
    // by incrementing the target weight
    const nextAttemptWeight = lastSet.weight + minGapPerSet + minIncrement;
    if (nextAttemptWeight >= topWeight - relaxedJump) {
      break; // Can't fit more
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

  // Final aggressive pass: if we're still short, add sets even more aggressively
  if (uniqueSets.length < clampedTargetCount && uniqueSets.length > 0) {
    const lastSet = uniqueSets[uniqueSets.length - 1];
    const gap = topWeight - lastSet.weight;
    const stillNeeded = clampedTargetCount - uniqueSets.length;
    
    if (gap > minIncrement && stillNeeded > 0) {
      // Calculate evenly spaced positions
      for (let i = 0; i < stillNeeded && uniqueSets.length < clampedTargetCount; i++) {
        const targetWeight = lastSet.weight + (gap * (i + 1) / (stillNeeded + 1));
        const roundedWeight = roundToIncrement(targetWeight, minIncrement);
        
        if (roundedWeight > lastSet.weight && roundedWeight < topWeight) {
          // Get plates from last set to build on
          const lastSetBreakdown = calculatePlateBreakdown(
            lastSet.weight,
            barWeight,
            isMetric,
            platePreference,
          );
          
          const breakdown = calculatePlateBreakdownWithExisting(
            roundedWeight,
            barWeight,
            lastSetBreakdown.platesPerSide,
            isMetric,
            platePreference,
          );
          const actualWeight = breakdown.closestWeight;
          
          // Very relaxed constraints - just make sure it's different and below top
          if (actualWeight > lastSet.weight && actualWeight < topWeight && !seenWeights.has(actualWeight)) {
            uniqueSets.push({
              weight: actualWeight,
              reps: 5,
              percentage: Math.round((actualWeight / topWeight) * 100),
              plateBreakdown: breakdown,
            });
            seenWeights.add(actualWeight);
          }
        }
      }
    }
  }

  // Calculate top set plate breakdown based on the last warmup set's plates
  let topSetBreakdown;
  if (uniqueSets.length > 0) {
    const lastWarmupSet = uniqueSets[uniqueSets.length - 1];
    topSetBreakdown = calculateTopSetBreakdown(
      topWeight,
      barWeight,
      lastWarmupSet.plateBreakdown.platesPerSide,
      isMetric,
      platePreference,
    );
  } else {
    // Fallback to standard calculation if no warmup sets
    topSetBreakdown = calculatePlateBreakdown(topWeight, barWeight, isMetric, platePreference);
  }

  return {
    warmupSets: uniqueSets,
    topSet: {
      weight: topWeight,
      reps: topReps,
      plateBreakdown: topSetBreakdown,
    },
  };
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
 * Calculate plate breakdown by adding to existing plates (prioritizes keeping existing plates)
 * @param {number} targetWeight - Target weight
 * @param {number} barWeight - Weight of the barbell
 * @param {Array} existingPlatesPerSide - Plates already on the bar
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" to prefer red or blue plates
 * @returns {Object} { platesPerSide, remainder, closestWeight }
 */
export function calculatePlateBreakdownWithExisting(
  targetWeight,
  barWeight,
  existingPlatesPerSide,
  isMetric,
  platePreference = "red",
) {
  if (targetWeight < barWeight) {
    return {
      platesPerSide: existingPlatesPerSide || [],
      remainder: targetWeight - barWeight,
      closestWeight: barWeight,
    };
  }

  const allPlates = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;
  const minIncrement = isMetric ? 1.25 : 2.5;
  
  // Calculate current weight with existing plates
  const existingWeightPerSide = (existingPlatesPerSide || []).reduce(
    (sum, plate) => sum + plate.weight * plate.count,
    0,
  );
  const currentTotalWeight = barWeight + existingWeightPerSide * 2;
  
  // Calculate additional weight needed per side
  const additionalWeightPerSide = (targetWeight - currentTotalWeight) / 2;
  
  if (additionalWeightPerSide <= 0) {
    // Already at or above target, return existing plates
    const actualWeight = barWeight + existingWeightPerSide * 2;
    return {
      platesPerSide: existingPlatesPerSide || [],
      remainder: targetWeight - actualWeight,
      closestWeight: actualWeight,
    };
  }

  // Start with existing plates
  const result = (existingPlatesPerSide || []).map(p => ({ ...p }));
  let remaining = additionalWeightPerSide;

  // Build a map of existing plate weights for quick lookup
  const existingPlateWeights = new Set((existingPlatesPerSide || []).map(p => p.weight));

  // Sort plates: prefer existing plate types first, then by size (largest first)
  const sortedPlates = [...allPlates].sort((a, b) => {
    const aExists = existingPlateWeights.has(a.weight);
    const bExists = existingPlateWeights.has(b.weight);
    
    // Existing plates come first
    if (aExists && !bExists) return -1;
    if (!aExists && bExists) return 1;
    
    // Then sort by weight (largest first)
    return b.weight - a.weight;
  });

  // Greedy algorithm: use largest plates first, preferring existing types
  for (const plate of sortedPlates) {
    if (remaining <= 0) break;
    
    const count = Math.floor(remaining / plate.weight);
    if (count > 0) {
      // Check if this plate type already exists
      const existingPlate = result.find(p => p.weight === plate.weight);
      if (existingPlate) {
        existingPlate.count += count;
      } else {
        result.push({
          ...plate,
          count,
        });
      }
      remaining -= count * plate.weight;
    }
  }

  // Sort result by weight (largest first) for display
  result.sort((a, b) => b.weight - a.weight);

  const totalPlatesWeight = result.reduce(
    (sum, p) => sum + p.weight * p.count,
    0,
  );
  const actualWeight = barWeight + totalPlatesWeight * 2;
  const remainder = targetWeight - actualWeight;

  return {
    platesPerSide: result,
    remainder: Math.abs(remainder) < 0.01 ? 0 : remainder,
    closestWeight: actualWeight,
  };
}

/**
 * Calculate plate breakdown for top set by adding to existing plates from last warmup
 * @param {number} targetWeight - Target weight for top set
 * @param {number} barWeight - Weight of the barbell
 * @param {Array} existingPlatesPerSide - Plates already on from last warmup set
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" to prefer red or blue plates
 * @returns {Object} { platesPerSide, remainder, closestWeight }
 */
export function calculateTopSetBreakdown(
  targetWeight,
  barWeight,
  existingPlatesPerSide,
  isMetric,
  platePreference = "red",
) {
  if (targetWeight < barWeight) {
    return {
      platesPerSide: existingPlatesPerSide,
      remainder: targetWeight - barWeight,
      closestWeight: barWeight,
    };
  }

  const allPlates = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;
  const minIncrement = isMetric ? 1.25 : 2.5;
  
  // Calculate current weight with existing plates
  const existingWeightPerSide = existingPlatesPerSide.reduce(
    (sum, plate) => sum + plate.weight * plate.count,
    0,
  );
  const currentTotalWeight = barWeight + existingWeightPerSide * 2;
  
  // Calculate additional weight needed per side
  const additionalWeightPerSide = (targetWeight - currentTotalWeight) / 2;
  
  if (additionalWeightPerSide <= 0) {
    // Already at or above target, return existing plates
    const actualWeight = barWeight + existingWeightPerSide * 2;
    return {
      platesPerSide: existingPlatesPerSide,
      remainder: targetWeight - actualWeight,
      closestWeight: actualWeight,
    };
  }

  // Start with existing plates and add what's needed
  const result = [...existingPlatesPerSide.map(p => ({ ...p }))];
  let remaining = additionalWeightPerSide;

  // Greedy algorithm: use largest plates first to minimize plate count
  // This ensures we use 1×10kg instead of 4×1.25kg, etc.
  const sortedPlates = [...allPlates].sort((a, b) => {
    // Sort largest to smallest
    return b.weight - a.weight;
  });

  for (const plate of sortedPlates) {
    if (remaining <= 0) break;
    
    const count = Math.floor(remaining / plate.weight);
    if (count > 0) {
      // Check if this plate type already exists
      const existingPlate = result.find(p => p.weight === plate.weight);
      if (existingPlate) {
        existingPlate.count += count;
      } else {
        result.push({
          ...plate,
          count,
        });
      }
      remaining -= count * plate.weight;
    }
  }

  // Sort result by weight (largest first) for display
  result.sort((a, b) => b.weight - a.weight);

  const totalPlatesWeight = result.reduce(
    (sum, p) => sum + p.weight * p.count,
    0,
  );
  const actualWeight = barWeight + totalPlatesWeight * 2;
  const remainder = targetWeight - actualWeight;

  return {
    platesPerSide: result,
    remainder: Math.abs(remainder) < 0.01 ? 0 : remainder,
    closestWeight: actualWeight,
  };
}

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
