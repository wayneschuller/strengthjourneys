/**
 * Shared barbell defaults for tools that need an empty-bar starting point.
 * Explicit user bar preferences win; athlete sex only fills the no-preference
 * gap so female lifters start from the women's bar by default.
 */

export function getDefaultBarType({ sex, storedBarType }) {
  if (storedBarType) return storedBarType;
  return sex === "female" ? "womens" : "standard";
}

export function getDefaultBarbellWeight({ isMetric, sex, storedBarType }) {
  const barType = getDefaultBarType({ sex, storedBarType });

  if (isMetric) return barType === "womens" ? 15 : 20;
  return barType === "womens" ? 35 : 45;
}
