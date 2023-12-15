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
    developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID, // This is needed for drive.file Google API access
    viewId: "SPREADSHEETS",
    token: accessToken, // The picker will use whatever scopes are associated with this token
    showUploadView: true,
    showUploadFolders: true,
    supportDrives: true,
    multiselect: false,
    callbackFunction: (data) => {
      if (data.action === "cancel") {
        console.log("User clicked cancel/close button");
        return;
      }
      devLog(data);
      if (data.docs && data.docs[0]) {
        const newSsid = data.docs[0].id;
        const newFilename = data.docs[0].name;
        const newSheetURL = encodeURIComponent(data.docs[0].url);

        setSsid(newSsid);
        setSheetURL(newSheetURL);
        setSheetFilename(newFilename);

        // Should we trigger a parsing of the sheet data here?
        // But it seems to happen fine through reactivity as ssid triggers the hook useSWR data fetch
        return;
      }
    },
  });
}
