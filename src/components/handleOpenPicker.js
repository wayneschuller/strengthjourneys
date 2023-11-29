/** @format */
"use client";
export function handleOpenPicker(openPicker, accessToken) {
  openPicker({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    viewId: "SPREADSHEETS",
    token: accessToken,
    showUploadView: true,
    showUploadFolders: true,
    supportDrives: true,
    multiselect: false,
    // customViews: customViewsArray, // custom view
    callbackFunction: (data) => {
      if (data.action === "cancel") {
        console.log("User clicked cancel/close button");
        return;
      }
      // console.log(data);
      if (data.docs && data.docs[0]) {
        localStorage.setItem("ssid", data.docs[0]?.id);
        // FIXME: set state ssid here
        // FIXME: the right thing to do is to trigger a parsing of the data
        // But we don't have to do the visualizer/analyzer stuff.
        return;
      }
    },
  });
}
