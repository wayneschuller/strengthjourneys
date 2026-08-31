/**
 * Warmup generation utilities following progressive warmup methodology
 * and plate breakdown calculations for barbell loading
 */

/**
 * Generate all sets (warmups + top set) based on progressive warmup methodology
 * @param {number} topWeight - Target weight for the top set
 * @param {number} topReps - Number of reps for the top set
 * @param {number} barWeight - Weight of the barbell
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" plate preference
 * @param {number} targetWarmupCount - Desired number of warmup sets before top (including bar)
 * @returns {Array<{weight: number, reps: number, percentage: number, plateBreakdown: {platesPerSide: Array, remainder: number, closestWeight: number}, isBarOnly?: boolean, isTopSet?: boolean}>} Array of all sets (warmups + top set) with plate breakdowns
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
    const topSetBreakdown = calculatePlateBreakdown(topWeight, barWeight, isMetric, platePreference);
    return [
      {
        weight: topWeight,
        reps: topReps,
        percentage: 100,
        plateBreakdown: topSetBreakdown,
        isTopSet: true,
      },
    ];
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

  /**
   * Find the next practical loading landmark after an anchor set. A landmark
   * adds one pair of the next smaller standard plate, so a 60kg bar with blue
   * 20s naturally moves to 90kg by adding yellow 15s. This reflects how lifters
   * actually load a bar: preserve the plates already on it and change plate
   * family only when that creates a useful, achievable jump.
   */
  const getNextPlateLandmarkTarget = () => {
    if (previousPlateMap.size === 0) {
      return null;
    }

    const allPlates = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;
    const allowedPlates = getAllowedPlates(allPlates, isMetric, platePreference);
    const largestLoadedPlate = Math.max(...previousPlateMap.keys());
    const nextSmallerPlate = allowedPlates.find(
      (plate) => plate.weight < largestLoadedPlate,
    );

    if (!nextSmallerPlate) {
      return null;
    }

    const loadedWeightPerSide = Array.from(previousPlateMap.entries()).reduce(
      (sum, [weight, count]) => sum + weight * count,
      0,
    );
    return barWeight + (loadedWeightPerSide + nextSmallerPlate.weight) * 2;
  };

  /**
   * Choose between practical plate landmarks with a one-step look-ahead. The
   * smoothest immediate jump is not always the best choice: 60 -> 90 leaves a
   * large 90 -> 117.5kg jump, while 60 -> 100 leaves a much smaller final gap.
   * Squared gaps penalize awkward jumps, and the final gap is weighted twice so
   * the progression naturally favours major-plate landmarks as the top set
   * approaches without requiring a growing list of hard-coded thresholds.
   */
  const chooseMiddleTargetWeight = ({
    anchorTargetWeight,
    landmarkTargetWeight,
    finalWarmupWeight,
  }) => {
    const candidates = [landmarkTargetWeight, anchorTargetWeight].filter(
      (target, index, all) =>
        target != null && all.indexOf(target) === index,
    );
    let bestCandidate = null;

    candidates.forEach((targetWeight) => {
      if (
        targetWeight >= finalWarmupWeight - effectiveMinJump ||
        targetWeight <= previousWeight + effectiveMinJump
      ) {
        return;
      }

      const currentPlatesPerSide = Array.from(previousPlateMap.entries())
        .map(([weight, count]) => {
          const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(
            (p) => p.weight === weight,
          );
          return plateInfo ? { ...plateInfo, count } : null;
        })
        .filter(Boolean);
      const breakdown = calculatePlateBreakdownWithExisting(
        targetWeight,
        barWeight,
        currentPlatesPerSide,
        isMetric,
        platePreference,
      );
      const actualWeight = breakdown.closestWeight;
      const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);

      if (
        actualWeight <= previousWeight + effectiveMinJump ||
        actualWeight >= finalWarmupWeight - effectiveMinJump
      ) {
        return;
      }

      const immediateJump = actualWeight - previousWeight;
      const finalGap = finalWarmupWeight - actualWeight;
      const score = immediateJump ** 2 + 2 * finalGap ** 2;
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = { score, weight: targetWeight };
      }
    });

    return bestCandidate?.weight || anchorTargetWeight;
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
    warmupSets.push({
      weight: topWeight,
      reps: topReps,
      percentage: 100,
      plateBreakdown: topSetBreakdown,
      isTopSet: true,
    });
    return warmupSets;
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
          const secondAnchorBreakdown = calculatePlateBreakdownWithExisting(
            secondAnchorWeight,
            barWeight,
            anchorBreakdown.platesPerSide,
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
      const anchorTargetWeight =
        barWeight + newPairsPerSide * anchorPlateWeight * 2;
      // Prefer a plate-family transition such as blue 20s to yellow 15s when
      // it keeps the whole remaining progression smooth. The look-ahead may
      // instead choose another pair of blue 20s for a heavier goal, avoiding a
      // large jump into the final primer without a numeric load threshold.
      const targetWeight = chooseMiddleTargetWeight({
        anchorTargetWeight,
        landmarkTargetWeight: getNextPlateLandmarkTarget(),
        finalWarmupWeight,
      });
      
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
        
        // A warm-up may now change plates, not only add them: the breakdown swaps
        // only when the resulting bar is clearly simpler to load. What still has to
        // hold is that the bar goes up, and the weight checks above already do that.
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
            
            // A warm-up may now change plates, not only add them: the breakdown swaps
            // only when the resulting bar is clearly simpler to load. What still has to
            // hold is that the bar goes up, and the weight checks above already do that.
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

  // Fill remaining slots before adding the reduced-rep final warmups. Keeping
  // this pass here preserves the intended taper instead of appending a 5-rep
  // set after the final primer.
  let attempts = 0;
  const maxAttempts = 50;
  const finalJumpForSpacing =
    topReps <= 2
      ? baseJump
      : topWeight > (isMetric ? 100 : 220)
        ? isMetric
          ? 10
          : 25
        : baseJump;
  const finalWarmupTarget = topWeight - finalJumpForSpacing;

  while (
    warmupSets.length < clampedTargetCount - finalWarmupCount &&
    warmupSets.length > 0 &&
    attempts < maxAttempts
  ) {
    attempts++;
    const lastSet = warmupSets[warmupSets.length - 1];
    const gap = finalWarmupTarget - lastSet.weight;
    const setsStillNeeded =
      clampedTargetCount - finalWarmupCount - warmupSets.length;
    const minGapPerSet = gap / (setsStillNeeded + 1);

    if (gap < minIncrement * 2) {
      break;
    }

    const relaxedJump = Math.max(
      effectiveMinJump * 0.5,
      minGapPerSet * 0.8,
    );
    const roundedWeight = roundToIncrement(
      lastSet.weight + minGapPerSet,
      minIncrement,
    );

    if (
      roundedWeight > lastSet.weight + relaxedJump &&
      roundedWeight < finalWarmupTarget - relaxedJump
    ) {
      const currentPlatesPerSide = Array.from(previousPlateMap.entries())
        .map(([weight, count]) => {
          const plateInfo = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(
            (p) => p.weight === weight,
          );
          return plateInfo ? { ...plateInfo, count } : null;
        })
        .filter(Boolean);
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
        actualWeight < finalWarmupTarget - relaxedJump
      ) {
        const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);
        // A warm-up may now change plates, not only add them: the breakdown swaps
        // only when the resulting bar is clearly simpler to load. What still has to
        // hold is that the bar goes up, and the weight checks above already do that.
        warmupSets.push({
          weight: actualWeight,
          reps: 5,
          percentage: Math.round((actualWeight / topWeight) * 100),
          plateBreakdown: breakdown,
        });
        previousWeight = actualWeight;
        previousPlateMap = newPlateMap;
        continue;
      }
    }

    const nextAttemptWeight = lastSet.weight + minGapPerSet + minIncrement;
    if (nextAttemptWeight >= finalWarmupTarget - relaxedJump) {
      break;
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
    // Final primers may use the smallest available plate jump. Requiring the
    // normal average jump here can suppress the primer after a finely spaced
    // fill set, especially at lighter loads.
    const finalMinJump = Math.min(effectiveMinJump, minIncrement);
    
    if (
      roundedWeight < previousWeight + finalMinJump ||
      roundedWeight > topWeight - finalMinJump
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
      actualWeight < previousWeight + finalMinJump ||
      actualWeight > topWeight - finalMinJump
    ) {
      return false;
    }

    const newPlateMap = buildPlateCountMap(breakdown.platesPerSide);

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

  // Remove duplicates (can happen with very light weights)
  const uniqueSets = [];
  const seenWeights = new Set();
  warmupSets.forEach((set) => {
    if (!seenWeights.has(set.weight)) {
      seenWeights.add(set.weight);
      uniqueSets.push(set);
    }
  });

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

  // Add top set to the array
  uniqueSets.push({
    weight: topWeight,
    reps: topReps,
    percentage: 100,
    plateBreakdown: topSetBreakdown,
    isTopSet: true,
  });

  return uniqueSets;
}

/**
 * Standard plate sets for kg and lb.
 *
 * Colours follow the IPF/IWF competition code that Rogue and Eliko use on their
 * competition bumpers and calibrated steel, rather than generic Tailwind hues.
 * The code repeats down the ladder (25kg and 2.5kg are both red), which is
 * unambiguous in a real rack because the discs are obviously different objects -
 * so the physical dimensions carry that second signal into the plate diagram.
 *
 * The four coded main plates all share the full 450mm diameter; what separates
 * them on the sleeve is thickness. Only the change plates step down in
 * diameter.
 *
 * @property {number} diameter - Plate diameter in millimetres.
 * @property {number} thickness - Plate thickness in millimetres.
 */
const ROGUE = {
  red: "#C8102E",
  blue: "#0057B8",
  yellow: "#FFD100",
  green: "#00843D",
  white: "#FFFFFF",
  chrome: "#B6B8BA",
};

export const PLATE_SETS = {
  kg: [
    { weight: 25, color: ROGUE.red, diameter: 450, thickness: 87, name: "25kg" },
    { weight: 20, color: ROGUE.blue, diameter: 450, thickness: 72, name: "20kg" },
    { weight: 15, color: ROGUE.yellow, diameter: 450, thickness: 56, name: "15kg" },
    { weight: 10, color: ROGUE.green, diameter: 450, thickness: 43, name: "10kg" },
    { weight: 5, color: ROGUE.white, diameter: 228, thickness: 26, name: "5kg" },
    { weight: 2.5, color: ROGUE.red, diameter: 190, thickness: 20, name: "2.5kg" },
    { weight: 1.25, color: ROGUE.chrome, diameter: 160, thickness: 16, name: "1.25kg" },
  ],
  lb: [
    { weight: 55, color: ROGUE.red, diameter: 450, thickness: 87, name: "55lb" },
    { weight: 45, color: ROGUE.blue, diameter: 450, thickness: 72, name: "45lb" },
    { weight: 35, color: ROGUE.yellow, diameter: 450, thickness: 56, name: "35lb" },
    { weight: 25, color: ROGUE.green, diameter: 450, thickness: 43, name: "25lb" },
    { weight: 10, color: ROGUE.white, diameter: 228, thickness: 26, name: "10lb" },
    { weight: 5, color: ROGUE.red, diameter: 190, thickness: 20, name: "5lb" },
    { weight: 2.5, color: ROGUE.chrome, diameter: 160, thickness: 16, name: "2.5lb" },
  ],
};

/**
 * Diameter of a full-size disc, used as the reference when the diagram scales
 * plates relative to one another. Both dimensions share this scale, so a plate
 * drawn from the diagram keeps its real width-to-height ratio.
 */
export const FULL_PLATE_DIAMETER = 450;

/**
 * Look up the physical dimensions for a plate weight so callers that build
 * plate objects by hand (the onboarding demo bar) still get sensible
 * proportions.
 *
 * @param {number} weight - Plate weight in the current unit
 * @param {boolean} isMetric - Whether the weight is kg (true) or lb (false)
 * @returns {{diameter: number, thickness: number}} Dimensions in millimetres
 */
export function getPlateDimensions(weight, isMetric) {
  const plate = (isMetric ? PLATE_SETS.kg : PLATE_SETS.lb).find(
    (p) => p.weight === weight,
  );
  return {
    diameter: plate?.diameter ?? FULL_PLATE_DIAMETER,
    thickness: plate?.thickness ?? 72,
  };
}

/**
 * Get allowed plate set based on preference.
 * Blue preferred: never show red (25kg/55lb) - only blue and smaller.
 * Red preferred: allow all plates - blue can be used when it helps minimize plate count.
 * @param {Array} allPlates - Full plate set (kg or lb)
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue"
 * @returns {Array} Filtered plate set
 */
function getAllowedPlates(allPlates, isMetric, platePreference) {
  if (platePreference === "blue") {
    const redWeight = isMetric ? 25 : 55;
    return allPlates.filter((p) => p.weight !== redWeight);
  }
  return allPlates;
}

/**
 * Calculate plate breakdown by adding to existing plates.
 * Minimizes plate count. Blue preferred: never add red. Red preferred: allow blue when it helps.
 * @param {number} targetWeight - Target weight
 * @param {number} barWeight - Weight of the barbell
 * @param {Array} existingPlatesPerSide - Plates already on the bar
 * @param {boolean} isMetric - Whether using kg (true) or lb (false)
 * @param {string} platePreference - "red" or "blue" to prefer red or blue plates
 * @returns {Object} { platesPerSide, remainder, closestWeight }
 */
/**
 * Keeping the plates already on the bar is worth something, but not everything.
 * A loading has to be clearly simpler than the incremental one before it earns
 * a plate change - below this margin, continuity wins.
 */
const LOADING_SWAP_MARGIN = 2;

/**
 * How awkward a loading is to actually put on a bar. Every disc costs one, and
 * a change plate costs an extra one on top: a sleeve carrying three pairs of
 * fractionals is far fiddlier than the disc count alone suggests, and it buries
 * the big coded plates that tell a lifter at a glance what is on the bar.
 *
 * @param {Array} platesPerSide - {weight, count} objects for one side
 * @param {boolean} isMetric - Whether weights are kg
 * @returns {number} Cost, where lower is a nicer bar to load
 */
function plateCost(plate) {
  const isChangePlate =
    (plate?.diameter ?? FULL_PLATE_DIAMETER) < FULL_PLATE_DIAMETER;
  return isChangePlate ? 2 : 1;
}

function loadingCost(platesPerSide, isMetric) {
  const plateSet = isMetric ? PLATE_SETS.kg : PLATE_SETS.lb;
  return platesPerSide.reduce((cost, plate) => {
    const info = plateSet.find((p) => p.weight === plate.weight);
    return cost + plate.count * plateCost(info);
  }, 0);
}

/**
 * Cheapest way to make a given weight on one sleeve.
 *
 * Loading largest-plate-first is not actually the simplest bar: 180lb a side
 * greedily becomes 55+55+55+10+5, where four 45s do the same job with no change
 * plates at all. This walks every reachable weight once and keeps the cheapest
 * way to reach each, which finds those even splits. Plates are considered
 * heaviest first and ties keep the incumbent, so an even split lands on the
 * biggest plates that produce it.
 *
 * @param {number} weightPerSide - Target weight for one side
 * @param {Array} allowedPlates - Permitted plates, heaviest first
 * @returns {Array|null} {weight, count} objects, or null if it cannot be searched
 */
function cheapestLoading(weightPerSide, allowedPlates) {
  const smallest = allowedPlates[allowedPlates.length - 1]?.weight;
  if (!smallest || weightPerSide <= 0) return [];

  // Work in whole units of the smallest plate so the walk is over integers.
  const steps = Math.floor(weightPerSide / smallest + 1e-9);
  if (steps > 20000) return null; // absurd input; let the caller fall back

  const cost = new Array(steps + 1).fill(Infinity);
  const via = new Array(steps + 1).fill(null);
  cost[0] = 0;
  for (let step = 1; step <= steps; step += 1) {
    for (const plate of allowedPlates) {
      const plateSteps = Math.round(plate.weight / smallest);
      if (plateSteps > step) continue;
      const previous = cost[step - plateSteps];
      if (previous === Infinity) continue;
      const candidate = previous + plateCost(plate);
      if (candidate < cost[step]) {
        cost[step] = candidate;
        via[step] = plate;
      }
    }
  }
  if (cost[steps] === Infinity) return null;

  const counts = new Map();
  for (let step = steps; step > 0; ) {
    const plate = via[step];
    counts.set(plate.weight, (counts.get(plate.weight) ?? 0) + 1);
    step -= Math.round(plate.weight / smallest);
  }
  return allowedPlates
    .filter((plate) => counts.has(plate.weight))
    .map((plate) => ({ ...plate, count: counts.get(plate.weight) }));
}

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
  const allowedPlates = getAllowedPlates(allPlates, isMetric, platePreference);

  const existingWeightPerSide = (existingPlatesPerSide || []).reduce(
    (sum, plate) => sum + plate.weight * plate.count,
    0,
  );
  const currentTotalWeight = barWeight + existingWeightPerSide * 2;
  const additionalWeightPerSide = (targetWeight - currentTotalWeight) / 2;

  if (additionalWeightPerSide <= 0) {
    const actualWeight = barWeight + existingWeightPerSide * 2;
    return {
      platesPerSide: (existingPlatesPerSide || []).map((p) => ({ ...p })),
      remainder: targetWeight - actualWeight,
      closestWeight: actualWeight,
    };
  }

  const result = (existingPlatesPerSide || []).map((p) => ({ ...p }));
  let remaining = additionalWeightPerSide;

  // Greedy: add largest allowed plates first to minimize plate count
  for (const plate of allowedPlates) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / plate.weight);
    if (count > 0) {
      const existingPlate = result.find((p) => p.weight === plate.weight);
      if (existingPlate) {
        existingPlate.count += count;
      } else {
        result.push({ ...plate, count });
      }
      remaining -= count * plate.weight;
    }
  }

  result.sort((a, b) => b.weight - a.weight);
  const totalPlatesWeight = result.reduce(
    (sum, p) => sum + p.weight * p.count,
    0,
  );
  const actualWeight = barWeight + totalPlatesWeight * 2;
  const remainder = targetWeight - actualWeight;
  const incremental = {
    platesPerSide: result,
    remainder: Math.abs(remainder) < 0.01 ? 0 : remainder,
    closestWeight: actualWeight,
  };

  // Only ever adding to the bar is what turns a 105kg top set into eight discs
  // a side when three would do: each warm-up inherits the last one's change
  // plates and piles more on top. So compare against stripping the bar and
  // loading it clean, and take that when it is clearly the better bar - which
  // is also the one that puts the big coded plates back on show.
  const clean = calculatePlateBreakdown(
    targetWeight,
    barWeight,
    isMetric,
    platePreference,
  );
  const reachesTarget =
    Math.abs(clean.remainder) <= Math.abs(incremental.remainder) + 0.01;
  const worthTheChange =
    loadingCost(clean.platesPerSide, isMetric) <=
    loadingCost(incremental.platesPerSide, isMetric) - LOADING_SWAP_MARGIN;

  return reachesTarget && worthTheChange ? clean : incremental;
}

/**
 * Calculate plate breakdown for top set by adding to existing plates from last warmup.
 * Uses same logic as calculatePlateBreakdownWithExisting: minimize plates, honor preference.
 */
export function calculateTopSetBreakdown(
  targetWeight,
  barWeight,
  existingPlatesPerSide,
  isMetric,
  platePreference = "red",
) {
  return calculatePlateBreakdownWithExisting(
    targetWeight,
    barWeight,
    existingPlatesPerSide,
    isMetric,
    platePreference,
  );
}

/**
 * Calculate plate breakdown for a given total weight.
 * Minimizes plate count. Blue preferred: never show red. Red preferred: allow blue when it helps.
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
  const allowedPlates = getAllowedPlates(allPlates, isMetric, platePreference);
  const weightPerSide = (totalWeight - barWeight) / 2;

  if (weightPerSide < 0) {
    return {
      platesPerSide: [],
      remainder: weightPerSide,
      closestWeight: barWeight,
    };
  }

  // Prefer the cheapest bar to load. Greedy stays as the fallback for inputs too
  // large to search, where largest-plates-first is the sane answer anyway.
  let result = cheapestLoading(weightPerSide, allowedPlates);
  if (result === null) {
    result = [];
    let remaining = weightPerSide;
    for (const plate of allowedPlates) {
      const count = Math.floor(remaining / plate.weight);
      if (count > 0) {
        result.push({ ...plate, count });
        remaining -= count * plate.weight;
      }
    }
  }

  result.sort((a, b) => b.weight - a.weight);
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
