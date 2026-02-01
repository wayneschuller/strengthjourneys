/** @format */
"use client";

import {
  trackSheetConnectClick,
  trackSheetPickerCancelled,
  trackSheetSelected,
  event,
} from "@/lib/analytics";

export function handleOpenFilePicker(
  openPicker,
  accessToken,
  setSsid,
  setSheetURL,
  setSheetFilename,
) {
  const page = typeof window !== "undefined" ? window.location.pathname : "";
  trackSheetConnectClick(page); // Google Analytics: track sheet-connect click before opening picker

  openPicker({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID, // This is needed for drive.file Google API access (MAKE SURE IT IS ON DEPLOYMENT ENV SETTINGS)
    token: accessToken, // The picker will use whatever scopes are associated with this oauth token
    customScopes: ["https://www.googleapis.com/auth/drive.file"],
    developerKey: "", // You do NOT need a dev key when using oauth tokens
    viewId: "SPREADSHEETS",
    showUploadView: true,
    showUploadFolders: true,
    supportDrives: true,
    multiselect: false,
    callbackFunction: (data) => {
      if (data.action === "cancel") {
        trackSheetPickerCancelled(); // Google Analytics: user closed picker without selecting
        return;
      }

      if (data.docs && data.docs[0]) {
        trackSheetSelected(); // Google Analytics: user selected a sheet
        event("gdrive_picker_opened"); // Google Analytics: legacy event name

        const newSsid = data.docs[0].id;
        const newFilename = data.docs[0].name;
        const newSheetURL = encodeURIComponent(data.docs[0].url);

        setSsid(newSsid);
        setSheetURL(newSheetURL);
        setSheetFilename(newFilename);
      }
    },
  });
}
