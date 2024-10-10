"use client";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

// This hook will provide state from the query params first and localstorage second and defaultValue third.
// Setting will update both query params and localstorage.
// FIXME: try to avoid inserting defaults into the query?

export const useStateFromQueryOrLocalStorage = (key, defaultValue) => {
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
      localStorage.setItem(key, stringifyValue(state));
    }
  }, [state, isInitialized]);

  return [state, setState];
};
