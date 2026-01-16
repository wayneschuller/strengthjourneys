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
  const [openPicker, authResponse] = useDrivePicker();
  const hasCalledReady = useRef(false);

  useEffect(() => {
    // Only call onReady once when picker becomes available
    // Use ref to prevent infinite loops from onReady being recreated
    if (openPicker && onReady && !hasCalledReady.current) {
      hasCalledReady.current = true;
      onReady(openPicker, authResponse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPicker, authResponse]); // Don't include onReady to avoid infinite loops

  // This component doesn't render anything visible
  // It just initializes the picker hook and passes it to the parent
  return null;
}
