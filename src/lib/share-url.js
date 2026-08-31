/**
 * Builds shareable URLs from the current client-side state.
 * Share actions should use this state-derived URL instead of depending on whether
 * the debounced Pages Router URL synchronization has completed yet.
 */

export function buildShareUrl(pathname, query, origin = null) {
  const resolvedOrigin =
    origin ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://www.strengthjourneys.xyz");
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return `${resolvedOrigin}${pathname}${queryString ? `?${queryString}` : ""}`;
}

export function getFirstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseQueryNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const numericValue = Number(getFirstQueryValue(value));
  return Number.isFinite(numericValue) && numericValue >= min && numericValue <= max
    ? numericValue
    : null;
}
