"use client";

import { useEffect, useState } from "react";
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (openPicker && onReady) {
      onReady(openPicker, authResponse);
      setIsReady(true);
    }
  }, [openPicker, authResponse, onReady]);

  // This component doesn't render anything visible
  // It just initializes the picker hook and passes it to the parent
  return null;
}
