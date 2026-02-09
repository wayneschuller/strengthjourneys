"use client";

import { useEffect, useRef } from "react";
import useDrivePicker from "react-google-drive-picker";

/**
 * Container that initializes the Google Drive Picker. Defers loading ~163 KiB of Google API
 * scripts until mounted. Only mount when the user actually needs the picker (e.g. during onboarding).
 *
 * @param {Object} props
 * @param {function(function, Object)} [props.onReady] - Called when the picker is ready. Receives
 *   (openPicker, authResponse). openPicker is a function to show the picker; call it when the
 *   user clicks "Choose from Drive".
 * @param {boolean} [props.trigger=false] - When true, the component mounts and starts loading
 *   the picker. Typically tied to auth status so the picker loads only after sign-in.
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
