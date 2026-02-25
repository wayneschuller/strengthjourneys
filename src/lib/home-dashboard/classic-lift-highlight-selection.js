import { buildClassicLiftMemoryPoolData } from "@/lib/classic-lift-memory";

export function pickClassicLiftMemory({
  parsedData,
  liftTypes,
  topLiftsByTypeAndReps,
  hasBioData,
  age,
  bodyWeight,
  sex,
  isMetric,
  selectionCacheRef,
}) {
  const { selectionPool, fallbackMemory, fingerprint } = buildClassicLiftMemoryPoolData({
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    hasBioData,
    age,
    bodyWeight,
    sex,
    isMetric,
  });

  if (fallbackMemory) return fallbackMemory;
  if (!selectionPool.length) return null;

  return pickMountedCachedCandidate(selectionPool, {
    fingerprint,
    cacheRef: selectionCacheRef,
  });
}

export function pickMountedCachedCandidate(candidates, { fingerprint, cacheRef }) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const cacheSeed = `${fingerprint}|${candidates.length}`;
  const cached = cacheRef?.current;
  if (
    cached &&
    cached.seed === cacheSeed &&
    Number.isInteger(cached.index) &&
    cached.index >= 0 &&
    cached.index < candidates.length
  ) {
    return candidates[cached.index];
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  if (cacheRef) {
    cacheRef.current = {
      seed: cacheSeed,
      index: randomIndex,
    };
  }

  return candidates[randomIndex];
}
