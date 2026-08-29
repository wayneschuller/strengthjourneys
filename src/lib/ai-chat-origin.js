/**
 * Shared origin allowlist for the public AI lifting assistant endpoints.
 *
 * Both /api/chat and /api/chat/suggestions spend model credits, so both are
 * gated to our own hosts in production.
 */

const ALLOWED_EXACT_HOSTS = ["localhost:3000", "127.0.0.1:3000"];

const ALLOWED_HOST_SUFFIXES = ["strengthjourneys.xyz"];

export function isAllowedOrigin(origin) {
  if (!origin) return true;

  try {
    const { host, hostname } = new URL(origin);

    return (
      ALLOWED_EXACT_HOSTS.includes(host) ||
      ALLOWED_HOST_SUFFIXES.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}
