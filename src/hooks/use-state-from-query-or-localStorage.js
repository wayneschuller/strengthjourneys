"use client";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * State from URL query → localStorage → defaultValue. Used across calculators, biodata, warm-ups.
 *
 * Motivation: We encourage users to share Strength Journeys URLs so others see the same
 * unique data/results. Query params make links shareable; localStorage persists preferences.
 *
 * Read order: query (highest) → localStorage → defaultValue.
 * Write: localStorage always; URL only when syncQuery and user has interacted (never on load).
 * Never sync on load: avoids polluting shared links when someone opens them.
 *
 * includeWhenSyncing: { [otherKey]: value } to add when syncing. Some strength features are only
 * meaningful in partnership with other state (e.g. weight without unit type is ambiguous).
 *
 * @param {string} key - localStorage key and query param (use LOCAL_STORAGE_KEYS)
 * @param {*} defaultValue
 * @param {boolean} [syncQuery=false]
 * @param {Record<string, *>|null} [includeWhenSyncing=null]
 * @returns {[*, Function]} Use returned setter (not raw setState) or URL sync won't trigger.
 */
export const useStateFromQueryOrLocalStorage = (
  key,
  defaultValue,
  syncQuery = false,
  includeWhenSyncing = null,
) => {
  const router = useRouter();
  const [state, setState] = useState(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasUserInteractedRef = useRef(false); // Gates URL sync: only after user interaction

  // Query/localStorage store strings; JSON.parse for numbers, booleans, objects
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

  // Init: query → localStorage → default; persist to localStorage
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

  // Persist to localStorage; sync to URL when syncQuery + user interacted. router excluded from deps (avoids infinite loop).
  useEffect(() => {
    if (!isInitialized) return;

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
