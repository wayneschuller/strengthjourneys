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
 * Write: localStorage only when the value came from a real source (URL/localStorage/user action).
 *   Defaults are never written to localStorage so callers can reliably detect "user never set this".
 * URL sync: only when syncQuery and user has interacted (never on load).
 * Never sync on load: avoids polluting shared links when someone opens them.
 *
 * includeWhenSyncing: { [otherKey]: value } to add when syncing. Some strength features are only
 * meaningful in partnership with other state (e.g. weight without unit type is ambiguous).
 *
 * @param {string} key - localStorage key and query param (use LOCAL_STORAGE_KEYS)
 * @param {*} defaultValue
 * @param {boolean} [syncQuery=false]
 * @param {Record<string, *>|null} [includeWhenSyncing=null]
 * @returns {[*, Function, boolean, Function]} [state, setter, isDefault, silentSetter]
 *   - setter: marks value as user-supplied, persists to localStorage + URL
 *   - isDefault: true when the value was never explicitly provided (URL, localStorage, or setter)
 *   - silentSetter: changes value without flipping isDefault — use for derived updates like unit
 *     conversion that shouldn't be mistaken for an explicit user preference
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
  const [isDefault, setIsDefault] = useState(true); // true until a real value is found or user sets
  const hasUserInteractedRef = useRef(false); // Gates URL sync: only after user interaction
  const routerRef = useRef(router); // Stable ref to avoid depending on router/includeWhenSyncing in effects
  routerRef.current = router;
  const includeWhenSyncingRef = useRef(includeWhenSyncing);
  includeWhenSyncingRef.current = includeWhenSyncing;

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

  // Init: query → localStorage → default.
  // Only persist to localStorage when the value came from a real source — never write defaults.
  // This keeps localStorage clean so callers can detect "user has never set this" reliably.
  useEffect(() => {
    if (!router.isReady) return;

    const query = routerRef.current.query;
    const queryValue = query[key];
    let initialState;
    let usingDefault = true;

    if (queryValue !== undefined) {
      initialState = parseValue(queryValue);
      usingDefault = false;
    } else if (typeof window !== "undefined") {
      const localStorageValue = localStorage.getItem(key);
      if (localStorageValue !== null) {
        initialState = parseValue(localStorageValue);
        usingDefault = false;
      } else {
        initialState = defaultValue;
      }
    } else {
      initialState = defaultValue;
    }

    setState(initialState);
    setIsDefault(usingDefault);
    setIsInitialized(true);

    if (!usingDefault && typeof window !== "undefined") {
      localStorage.setItem(key, stringifyValue(initialState));
    }
  }, [router.isReady, key, defaultValue]);

  // Persist to localStorage; sync to URL when syncQuery + user interacted.
  // Skipped entirely when isDefault — we never write defaults to localStorage.
  useEffect(() => {
    if (!isInitialized || isDefault) return;

    if (syncQuery && hasUserInteractedRef.current) {
      const r = routerRef.current;
      const extras = includeWhenSyncingRef.current;
      const newQueryParams = {
        ...r.query,
        [key]: stringifyValue(state),
        ...(extras &&
          Object.fromEntries(
            Object.entries(extras).map(([k, v]) => [
              k,
              stringifyValue(v),
            ]),
          )),
      };

      r.replace(
        {
          pathname: r.pathname,
          query: newQueryParams,
        },
        undefined,
        { shallow: true },
      );
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(key, stringifyValue(state));
    }
  }, [state, isInitialized, syncQuery, key, isDefault]);

  // Interactive setter — marks value as explicitly user-supplied.
  const setStateWithInteraction = useCallback((valueOrUpdater) => {
    hasUserInteractedRef.current = true;
    setIsDefault(false);
    setState(valueOrUpdater);
  }, []);

  // Silent setter — updates the displayed value without marking it as user-supplied.
  // Use for derived state changes like unit conversion so isDefault is preserved.
  // If isDefault is already false (user set a value), the persistence effect will still
  // write the new value to localStorage when state changes.
  const setStateSilent = setState;

  return [state, setStateWithInteraction, isDefault, setStateSilent];
};
