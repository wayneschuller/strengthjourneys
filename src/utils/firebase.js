/** @format */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
  // FIXME: test here if clientCredentials env vars are set and throw error and tell user if not

  if (typeof window !== undefined) {
    let app = initializeApp(clientCredentials);
    return app;
  }
  return null;
}

const app = initializeApp(clientCredentials);
const db = getFirestore(app);

export { initFirebase, db };
