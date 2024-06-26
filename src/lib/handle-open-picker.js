/** @format */
"use client";

import { devLog } from "@/lib/processing-utils";

export function handleOpenFilePicker(
  openPicker,
  accessToken,
  setSsid,
  setSheetURL,
  setSheetFilename,
) {
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
      if (typeof window !== "undefined") {
        window.gtag("event", "gdrive_picker_opened");
      }

      if (data.action === "cancel") {
        console.log("User clicked cancel/close button");
        return;
      }

      // devLog(data);

      if (data.docs && data.docs[0]) {
        const newSsid = data.docs[0].id;
        const newFilename = data.docs[0].name;
        const newSheetURL = encodeURIComponent(data.docs[0].url);

        setSsid(newSsid);
        setSheetURL(newSheetURL);
        setSheetFilename(newFilename);

        // Should we trigger a parsing of the sheet data here?
        // But it seems to happen fine through reactivity as ssid state change triggers the hook useSWR data fetch
        return;
      }
    },
  });
}
