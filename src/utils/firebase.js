/** @format */

import { initializeApp } from "firebase/app";

const clientCredentials = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

function initFirebase() {
  if (typeof window !== undefined) {
    console.log(`Attempting to initialise with these credentials:`);
    console.log(clientCredentials);
    let app = initializeApp(clientCredentials);
    console.log("Firebase has been inited successfully");
    console.log(app);
    return app;
  }
  return null;
}

// const app = initializeApp(clientCredentials);

// const db = getFirestore(app);

export { initFirebase };
