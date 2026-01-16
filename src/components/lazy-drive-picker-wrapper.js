"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

/**
 * Lazy-loading wrapper component for react-google-drive-picker
 * Only loads the Google APIs (~163 KiB) when user actually needs to use the picker
 * 
 * This component wraps any component that needs to use useDrivePicker
 * and only mounts it when shouldLoad is true
 */
export function LazyDrivePickerWrapper({ 
  children, 
  shouldLoad = false,
  fallback = null 
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (shouldLoad && !isLoaded) {
      setIsLoaded(true);
    }
  }, [shouldLoad, isLoaded]);

  // Only render children (which use useDrivePicker) when shouldLoad is true
  // This prevents the hook from being called until needed
  if (!shouldLoad || !isLoaded) {
    return fallback;
  }

  return children;
}

/**
 * Creates a lazy-loaded drive picker hook wrapper
 * Returns a component that only loads useDrivePicker when mounted
 */
export function createLazyDrivePickerComponent(Component) {
  return dynamic(() => Promise.resolve(Component), {
    ssr: false,
    loading: () => null,
  });
}

/**
 * Hook that provides lazy-loading functionality for drive picker
 * Use this in components where you want to defer loading the picker
 */
export function useLazyDrivePickerState() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const requestPicker = useCallback(() => {
    if (!shouldLoad) {
      setShouldLoad(true);
    }
  }, [shouldLoad]);

  useEffect(() => {
    if (shouldLoad && !hasLoaded) {
      // Small delay to allow component to mount first
      const timer = setTimeout(() => {
        setHasLoaded(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [shouldLoad, hasLoaded]);

  return {
    shouldLoad,
    hasLoaded,
    requestPicker,
  };
}
