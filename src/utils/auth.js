/** @format */

import React, { useState, useEffect, useContext, createContext } from "react";
import { initFirebase } from "./firebase";
import { getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
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

  const signInWithGoogleReturning = () => {
    console.log(`signinWithGoogleReturning... FirebaseAuth is:`);
    console.log(auth);

    // const old_credential = JSON.parse(localStorage.getItem(`googleCredential`));
    // const credential = GoogleAuthProvider.credential(old_credential.id_token);
    const idToken = localStorage.getItem(`googleIdToken`);
    console.log(`Old idToken is: ${idToken}`);

    const credential = GoogleAuthProvider.credential(idToken);
    console.log(`New credential from that idtoken is:`);
    console.log(credential);

    return signInWithCredential(auth, credential)
      .then((response) => {
        const credential = GoogleAuthProvider.credentialFromResult(response);

        console.log(`signInWithCredential... credentialFromResult is:`);
        console.log(credential);

        // We don't need to update the auth user?
        handleUser(response.user);

        console.log(`Firebase signInWithCredential user response:`);
        console.log(response.user);
      })
      .catch((error) => {
        console.log(`Firebase signInWithCredential error:`);
        console.log(error);
        // FIXME: This would be a point you could go to signInWithPopup() to get a new credential
      });
  };

  const signinWithGoogle = (redirect) => {
    // console.log(`signinWithGoogle... FirebaseAuth is:`);
    // console.log(auth);

    return signInWithPopup(auth, googleProvider)
      .then((response) => {
        const credential = GoogleAuthProvider.credentialFromResult(response);

        console.log(`signInWithPopup... credentialFromResult is:`);
        console.log(credential);

        // Store new access token in localStorage
        // This will give 1 hour access to gsheets API
        localStorage.setItem("googleAccessToken", credential.accessToken);

        // Store credential.id_token in localStorage
        // When access token has expired we can use this to refresh the access token
        localStorage.setItem("googleIdToken", credential.idToken);

        handleUser(response.user);

        console.log(`Firebase signInWithPopup user response:`);
        console.log(response.user);

        if (redirect) {
          // Router.push(redirect); // FIXME: not using redirect for now
        }
      })
      .catch((error) => {
        console.log(`Firebase signInWithPopup error:`);
        console.log(error);
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
    signInWithGoogleReturning,
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
