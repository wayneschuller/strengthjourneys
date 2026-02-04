"use client";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";

// This hook provides state from query params first, localStorage second, and defaultValue third.
// Setting state updates localStorage always and query params only if syncQuery is true.
// Query params are only written when the user explicitly changes state (slider, input, etc.),
// never on initial load - so shared URLs stay clean and don't get polluted on page load.
//
// includeWhenSyncing: optional object of { [otherKey]: value } - when syncing this key to the URL,
// also include these related keys. Use for interconnected state (e.g. weight + unit type) so
// shared URLs have full context.
export const useStateFromQueryOrLocalStorage = (
  key,
  defaultValue,
  syncQuery = false,
  includeWhenSyncing = null,
) => {
  const router = useRouter();
  const [state, setState] = useState(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasUserInteractedRef = useRef(false);

  const parseValue = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const stringifyValue = (value) => {
    return JSON.stringify(value);
  };

  // Initialize state from query, localStorage, or default (priority order)
  useEffect(() => {
    if (!router.isReady) return;

    const getInitialState = () => {
      const queryValue = router.query[key];
      if (queryValue !== undefined) return parseValue(queryValue);

      if (typeof window !== "undefined") {
        const localStorageValue = localStorage.getItem(key);
        if (localStorageValue !== null) return parseValue(localStorageValue);
      }

      return defaultValue;
    };

    const initialState = getInitialState();
    setState(initialState);
    setIsInitialized(true);

    if (typeof window !== "undefined") {
      localStorage.setItem(key, stringifyValue(initialState));
    }
  }, [router.isReady, key, defaultValue]);

  // Update localStorage when state changes; update query params only after user interaction
  // Note: router is intentionally excluded from deps - the Next.js router object
  // gets a new reference on each render, which would cause an infinite loop
  useEffect(() => {
    if (!isInitialized) return;

    // Only sync to URL when user has explicitly changed state (slider, input, etc.)
    // Never on initial load - avoids polluting shared URLs when someone clicks a link
    if (syncQuery && hasUserInteractedRef.current) {
      const newQueryParams = {
        ...router.query,
        [key]: stringifyValue(state),
        ...(includeWhenSyncing &&
          Object.fromEntries(
            Object.entries(includeWhenSyncing).map(([k, v]) => [
              k,
              stringifyValue(v),
            ]),
          )),
      };

      router.replace(
        {
          pathname: router.pathname,
          query: newQueryParams,
        },
        undefined,
        { shallow: true },
      );
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(key, stringifyValue(state));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router excluded to prevent infinite loop
  }, [state, isInitialized, syncQuery, key]);

  const setStateWithInteraction = useCallback((valueOrUpdater) => {
    hasUserInteractedRef.current = true;
    setState(valueOrUpdater);
  }, []);

  return [state, setStateWithInteraction];
};
