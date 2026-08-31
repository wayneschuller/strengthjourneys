/**
 * Synchronizes a calculator's complete state to the URL after initialization.
 * Calculator fields stay independently persisted in localStorage, but one page-level
 * effect owns the shareable URL so every update carries the complete calculator state.
 */
import { useEffect, useRef } from "react";

/**
 * @param {Object} params
 * @param {Object} params.router - Next.js Pages Router instance.
 * @param {Object} params.query - Complete calculator query state to serialize.
 * @param {boolean} params.isInitialized - Whether all calculator fields have loaded.
 * @param {boolean} [params.enabled=true] - Whether URL synchronization is enabled.
 */
export function useCalculatorQuerySync({
  router,
  query,
  isInitialized,
  enabled = true,
}) {
  const hasMountedRef = useRef(false);
  const lastSerializedQueryRef = useRef("");

  useEffect(() => {
    if (!enabled || !router.isReady || !isInitialized) return undefined;

    const serializedQuery = JSON.stringify(query);

    // Loading URL/localStorage state must never rewrite the URL on page load.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastSerializedQueryRef.current = serializedQuery;
      return undefined;
    }

    if (serializedQuery === lastSerializedQueryRef.current) return undefined;

    const timeoutId = setTimeout(() => {
      lastSerializedQueryRef.current = serializedQuery;
      router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            ...query,
          },
        },
        undefined,
        { shallow: true },
      );
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [enabled, isInitialized, query, router]);
}
