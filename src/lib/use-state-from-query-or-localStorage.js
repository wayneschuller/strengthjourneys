"use client";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

// This hook will provide state from the query params first and localstorage second and defaultValue third.
// Setting will update both query params and localstorage.

export const useStateFromQueryOrLocalStorage = (key, defaultValue) => {
  const router = useRouter();
  const [state, setState] = useState(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false); // Hack needed to avoid Next.js hydration mismatches

  const parseValue = (value) => {
    if (value === "true" || value === "false") return value === "true";
    if (!isNaN(value)) return Number(value);
    return value;
  };

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
      localStorage.setItem(key, initialState);
    }
  }, [router.isReady, key, defaultValue]);

  useEffect(() => {
    if (!isInitialized) return;

    const newQueryParams = { ...router.query, [key]: state };

    router.replace(
      {
        pathname: router.pathname,
        query: newQueryParams,
      },
      undefined,
      { shallow: true },
    );

    if (typeof window !== "undefined") {
      localStorage.setItem(key, state);
    }
  }, [state, isInitialized]);

  return [state, setState];
};
