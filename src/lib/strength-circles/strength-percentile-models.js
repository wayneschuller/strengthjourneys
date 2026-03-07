import {
  MODELED_UNIVERSE_PROFILES,
  POWERLIFTING_PERCENTILE_TABLES_V1,
} from "@/lib/strength-circles/strength-percentile-data";

function kilgorePositionToPercentile(position, profile) {
  const { anchors, curveExponent = 1 } = profile;

  if (position <= 0) {
    return Math.max(0, anchors[0] + position * anchors[0]);
  }

  if (position >= 4) {
    const extrapolated = anchors[4] + (position - 4) * (99.9 - anchors[4]);
    return Math.min(99.9, extrapolated);
  }

  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  if (lo === hi) return anchors[lo];
  const t = Math.pow(position - lo, curveExponent);
  return anchors[lo] + t * (anchors[hi] - anchors[lo]);
}

function getModeledPercentile(universe, position) {
  const profile = MODELED_UNIVERSE_PROFILES[universe];
  if (!profile) return null;
  return Math.round(kilgorePositionToPercentile(position, profile));
}

function getEmpiricalPowerliftingPercentile() {
  if (!POWERLIFTING_PERCENTILE_TABLES_V1) return null;
  return null;
}

export function getUniversePercentile({
  universe,
  position,
}) {
  if (universe === "Powerlifting Culture") {
    const empiricalPercentile = getEmpiricalPowerliftingPercentile();
    if (empiricalPercentile != null) return empiricalPercentile;
  }

  return getModeledPercentile(universe, position);
}
