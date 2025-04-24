"use client";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

// This hook provides state from query params first, localStorage second, and defaultValue third.
// Setting state updates localStorage always and query params only if syncQuery is true.
export const useStateFromQueryOrLocalStorage = (
  key,
  defaultValue,
  syncQuery = false,
) => {
  const router = useRouter();
  const [state, setState] = useState(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Initialize state from query, localStorage, or default
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

  // Update query params (if syncQuery is true) and localStorage when state changes
  useEffect(() => {
    if (!isInitialized) return;

    if (syncQuery) {
      const newQueryParams = { ...router.query, [key]: stringifyValue(state) };

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
  }, [state, isInitialized, syncQuery, key, router]);

  return [state, setState];
};
