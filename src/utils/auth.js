/** @format */

import React, { useState, useEffect, useContext, createContext } from "react";
import { initFirebase } from "./firebase";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

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
  const [loading, setLoading] = useState(true);

  const handleUser = (rawUser, accessToken) => {
    if (rawUser) {
      const user = formatUser(rawUser, accessToken);

      setLoading(false);
      setUser(user);
      return user;
    } else {
      setLoading(false);
      setUser(false);
      return false;
    }
  };

  const signinWithGoogle = (redirect) => {
    setLoading(true);
    return signInWithPopup(auth, googleProvider).then((response) => {
      const credential = GoogleAuthProvider.credentialFromResult(response);
      handleUser(response.user, credential.accessToken);
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
    loading,
    signinWithGoogle,
    signout,
  };
}

const formatUser = (user, accessToken) => {
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    provider: user.providerData[0].providerId,
    photoUrl: user.photoURL,
    accessToken: accessToken,
  };
};
