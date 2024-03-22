// utils/gapiClient.js
let gapiInitialized = false; // Flag to track initialization status

export const initGapiClient = async () => {
  if (gapiInitialized) {
    return; // If already initialized, do nothing
  }

  await new Promise((resolve, reject) => {
    // Dynamically load the GAPI script if it's not already loaded
    if (
      !document.querySelector('script[src="https://apis.google.com/js/api.js"]')
    ) {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = resolve; // Resolve the promise when the script is loaded and GAPI is ready
      script.onerror = reject; // Reject the promise if there's an error loading the script
      document.body.appendChild(script);
    } else {
      resolve(); // If the script is already in the document, resolve immediately
    }
  });

  await new Promise((resolve, reject) => {
    window.gapi.load("client:auth2", {
      callback: async () => {
        try {
          await window.gapi.client.init({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            discoveryDocs: [
              "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
            ],
            scope: "https://www.googleapis.com/auth/drive.file", // Specific scope for Drive file access
          });
          gapiInitialized = true; // Set flag to true after successful initialization
          resolve();
        } catch (error) {
          console.error("Error initializing GAPI client:", error);
          reject(error);
        }
      },
      onerror: function () {
        console.error("GAPI client failed to load!");
        reject("GAPI client failed to load");
      },
    });
  });
};
