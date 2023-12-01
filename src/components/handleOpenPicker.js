/** @format */
"use client";
export function handleOpenPicker(openPicker, accessToken, setSsid) {
  console.log(`Opening Google Sheet Picker...`);

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.file",
  ];

  openPicker({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    viewId: "SPREADSHEETS",
    token: accessToken,
    showUploadView: true,
    showUploadFolders: true,
    supportDrives: true,
    multiselect: false,
    // customScopes: scopes,
    customScopes: ["https://www.googleapis.com/auth/drive.file"],
    // customViews: customViewsArray, // custom view
    callbackFunction: (data) => {
      if (data.action === "cancel") {
        console.log("User clicked cancel/close button");
        return;
      }
      // console.log(data);
      if (data.docs && data.docs[0]) {
        const newSsid = data.docs[0].id;
        localStorage.setItem("ssid", newSsid);
        setSsid(newSsid);
        // FIXME: the right thing to do is to trigger a parsing of the data
        // But it seems to happen through reactivity once Ssid is set in state
        return;
      }
    },
  });
}
