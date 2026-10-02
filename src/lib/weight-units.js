/**
 * The one place that knows how many pounds are in a kilogram.
 *
 * Every kg/lb conversion in the app goes through here so two pages can never
 * disagree about the same lift. Plain arithmetic only: callers decide their
 * own rounding, because a slider, a percentile lookup and a label each want a
 * different one.
 */

export const LB_PER_KG = 2.2046;

// Anything that is not "kg" is treated as "lb", matching the parsed lift schema.
function isKg(unitType) {
  return unitType === "kg";
}

/** The unit string for a display preference (`isMetric` from useAthleteBio). */
export function unitTypeFor(isMetric) {
  return isMetric ? "kg" : "lb";
}

/** Convert a weight between "kg" and "lb". Same unit in and out returns it untouched. */
export function convertWeight(weight, fromUnitType, toUnitType) {
  const fromKg = isKg(fromUnitType);
  if (fromKg === isKg(toUnitType)) return weight;
  return fromKg ? weight * LB_PER_KG : weight / LB_PER_KG;
}

/** A weight logged in `unitType`, in kilograms. */
export function toKg(weight, unitType) {
  return convertWeight(weight, unitType, "kg");
}

/** A weight logged in `unitType`, in pounds. */
export function toLb(weight, unitType) {
  return convertWeight(weight, unitType, "lb");
}
