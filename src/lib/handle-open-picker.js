/** @format */
"use client";

import { trackSheetConnectClick } from "@/lib/analytics";

/**
 * Opens the Google Drive picker and tracks the click for analytics.
 * The picker's onPicked/onCanceled callbacks (in DrivePickerContainer) handle
 * the rest (setting ssid, sheetURL, sheetFilename, analytics).
 *
 * @param {function} openPicker - Function to show the picker (from DrivePickerContainer onReady)
 */
export function handleOpenFilePicker(openPicker) {
  const page = typeof window !== "undefined" ? window.location.pathname : "";
  trackSheetConnectClick(page);
  openPicker();
}
