"use client";

import { useEffect, useRef } from "react";
import useDrivePicker from "react-google-drive-picker";

/**
 * Container component that uses useDrivePicker hook
 * Only mount this component when you actually need the picker
 * This defers loading ~163 KiB of Google API scripts until needed
 * 
 * Usage:
 * <DrivePickerContainer
 *   onReady={(openPicker, authResponse) => {
 *     // Use openPicker when user clicks button
 *   }}
 *   trigger={shouldLoadPicker} // Only mount when this is true
 * />
 */
export function DrivePickerContainer({ onReady, trigger = false }) {
  const result = useDrivePicker();
  const openPicker = result[0];
  const authResponse = result[1];
  // Patched hook returns [openPicker, authRes, isReady]; only enable when scripts are loaded
  const isReady = result[2] === true;
  const hasCalledReady = useRef(false);

  useEffect(() => {
    // Only call onReady when picker is actually ready (Google scripts loaded and picker API loaded).
    // Previously we called onReady as soon as openPicker existed, but openPicker() does nothing
    // until gapi/GSI scripts are loaded - so clicks appeared to "do nothing" for many users.
    if (isReady && openPicker && onReady && !hasCalledReady.current) {
      hasCalledReady.current = true;
      onReady(openPicker, authResponse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, openPicker, authResponse]); // Don't include onReady to avoid infinite loops

  // This component doesn't render anything visible
  // It just initializes the picker hook and passes it to the parent
  return null;
}
