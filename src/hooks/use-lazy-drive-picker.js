"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Lazy-loading wrapper for react-google-drive-picker
 * Only loads the Google APIs when actually needed (on user interaction)
 * This significantly reduces initial page load by deferring ~163 KiB of JavaScript
 *
 * Usage:
 * const { openPicker, isReady, isLoading } = useLazyDrivePicker();
 *
 * // In your component, only render picker-dependent UI when isReady is true
 * // or use the openPicker callback which handles lazy-loading automatically
 */
export function useLazyDrivePicker() {
  const [pickerReady, setPickerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [openPickerFn, setOpenPickerFn] = useState(null);
  const [authResponse, setAuthResponse] = useState(null);

  /**
   * Lazy-loads the drive picker hook
   * This is called when we first need to use the picker
   */
  const initializePicker = useCallback(async () => {
    if (pickerReady && openPickerFn) {
      return { openPicker: openPickerFn, authResponse };
    }

    if (isLoading) {
      // Wait for current load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (pickerReady && openPickerFn) {
            clearInterval(checkInterval);
            resolve({ openPicker: openPickerFn, authResponse });
          }
          if (loadError) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 50);
      });
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      // Dynamically import the drive picker only when needed
      // This defers loading the Google API scripts
      const pickerModule = await import("react-google-drive-picker");
      const useDrivePicker = pickerModule.default || pickerModule;

      // Return a component factory that can be used to create picker instances
      // Since we can't call hooks conditionally, we'll need to use a wrapper component
      setPickerReady(true);
      setIsLoading(false);

      // Return the picker module so components can use it
      return { useDrivePicker };
    } catch (error) {
      console.error("Failed to load drive picker:", error);
      setLoadError(error);
      setIsLoading(false);
      return null;
    }
  }, [pickerReady, openPickerFn, authResponse, isLoading, loadError]);

  return {
    initializePicker,
    isReady: pickerReady,
    isLoading,
    loadError,
  };
}
