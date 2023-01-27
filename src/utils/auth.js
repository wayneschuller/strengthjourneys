/** @format */

import React, { useState, useEffect, useContext, createContext } from "react";
import { initFirebase } from "./firebase";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { createUser } from "./db";

let app = initFirebase();

// Create firebase auth object
const auth = getAuth(app);

// Create google provider object for Firebase authentication
const googleProvider = new GoogleAuthProvider();

// MINIMUM Google API scopes required to read one google sheet
const SCOPES = "https://www.googleapis.com/auth/drive.file";
googleProvider.addScope(SCOPES);

const authContext = createContext();

export function AuthProvider({ children }) {
  const auth = useProvideAuth();
  return <authContext.Provider value={auth}>{children}</authContext.Provider>;
}

export const useAuth = () => {
  return useContext(authContext);
};

function useProvideAuth() {
  const [user, setUser] = useState(null);

  const handleUser = (rawUser) => {
    if (rawUser) {
      const user = formatUser(rawUser);
      createUser(user.uid, user);
      setUser(user);
      return user;
    } else {
      setUser(false);
      return false;
    }
  };

  const signinWithGoogle = (redirect) => {
    return signInWithPopup(auth, googleProvider).then((response) => {
      const credential = GoogleAuthProvider.credentialFromResult(response);
      localStorage.setItem("googleCredential", JSON.stringify(credential)); // Store credential locally
      handleUser(response.user);
      if (redirect) {
        // Router.push(redirect); // FIXME: not using redirect for now
      }
    });
  };

  const signout = () => {
    return auth.signOut().then(() => handleUser(false));
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(handleUser);

    return () => unsubscribe();
  }, []);

  return {
    user,
    signinWithGoogle,
    signout,
  };
}

const formatUser = (user) => {
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    provider: user.providerData[0].providerId,
    photoUrl: user.photoURL,
  };
};
