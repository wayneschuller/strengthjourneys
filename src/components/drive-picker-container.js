"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
import {
  gaTrackSheetPickerCancelled,
  gaTrackSheetSelected,
  gaEvent,
  GA_EVENT_TAGS,
} from "@/lib/analytics";

/**
 * Container that initializes the Google Drive Picker using the official
 * @googleworkspace/drive-picker-react. Defers loading until mounted.
 * Only mount when the user actually needs the picker (e.g. during onboarding).
 *
 * @param {Object} props
 * @param {function(function)} [props.onReady] - Called when the picker is ready. Receives
 *   (openPicker) where openPicker is a function to show the picker; call it when the
 *   user clicks "Choose from Drive".
 * @param {boolean} [props.trigger=false] - When true, the component mounts and the
 *   picker can be opened. Typically tied to auth status.
 * @param {string} [props.oauthToken] - OAuth token from NextAuth session.
 * @param {function(string)} [props.selectSheet] - Callback to select a sheet by ssid.
 */
export function DrivePickerContainer({
  onReady,
  trigger = false,
  oauthToken,
  selectSheet,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const hasCalledReady = useRef(false);

  const openPicker = useCallback(() => {
    setShowPicker(true);
  }, []);

  useEffect(() => {
    if (trigger && oauthToken && openPicker && onReady && !hasCalledReady.current) {
      hasCalledReady.current = true;
      onReady(openPicker);
    }
  }, [trigger, oauthToken, openPicker, onReady]);

  const handlePicked = useCallback(
    (e) => {
      const data = e.detail;
      if (data.action === "cancel") return;
      if (data.docs?.[0]) {
        gaTrackSheetSelected();
        gaEvent(GA_EVENT_TAGS.GDRIVE_PICKER_OPENED);
        const doc = data.docs[0];
        selectSheet?.(doc.id);
      }
      setShowPicker(false);
    },
    [selectSheet],
  );

  const handleCanceled = useCallback(() => {
    gaTrackSheetPickerCancelled();
    setShowPicker(false);
  }, []);

  if (!trigger) return null;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

  return (
    <>
      {showPicker && oauthToken && clientId && (
        <DrivePicker
          client-id={clientId}
          app-id={appId}
          oauth-token={oauthToken}
          scope="https://www.googleapis.com/auth/drive.file"
          onPicked={handlePicked}
          onCanceled={handleCanceled}
        >
          <DrivePickerDocsView
            view-id="SPREADSHEETS"
            mime-types="application/vnd.google-apps.spreadsheet"
            enableDrives
          />
        </DrivePicker>
      )}
    </>
  );
}
