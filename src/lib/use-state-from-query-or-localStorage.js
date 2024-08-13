"use client";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

// This hook will provide state from the query params first and localstorage second and defaultValue third.
// Setting will update both query params and localstorage.
export const useStateFromQueryOrLocalStorage = (key, defaultValue) => {
  const router = useRouter();
  const isClient = typeof window !== "undefined";

  // Convert query params and localStorage to original types
  // We assume only options are: boolean, number then default to string.
  const parseValue = (value) => {
    if (value === "true" || value === "false") return value === "true";
    if (!isNaN(value)) return Number(value);
    return value;
  };

  const getInitialState = () => {
    if (!isClient) return defaultValue;

    const queryValue = router.query[key];
    if (queryValue !== undefined) return parseValue(queryValue);

    const localStorageValue = localStorage.getItem(key);
    if (localStorageValue !== null) return parseValue(localStorageValue);

    return defaultValue;
  };

  const [state, setState] = useState(getInitialState);

  useEffect(() => {
    if (!isClient || !router.isReady) return;

    const queryValue = router.query[key];
    if (queryValue !== undefined) {
      const parsedValue = parseValue(queryValue);
      setState(parsedValue);
      localStorage.setItem(key, queryValue);
    }
  }, [router.isReady]);

  useEffect(() => {
    if (!isClient) return;

    const newQueryParams = { ...router.query, [key]: state };

    router.replace(
      {
        pathname: router.pathname,
        query: newQueryParams,
      },
      undefined,
      { shallow: true },
    );

    localStorage.setItem(key, state);
  }, [state]);

  return [state, setState];
};
