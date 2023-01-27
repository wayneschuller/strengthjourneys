/** @format */

// db.js firestore db functions

import { db } from "./firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";

export function updateUser(uid, data) {
  const userRef = doc(db, "users", uid);
  return updateDoc(userRef, data);
}

export function createUser(uid, data) {
  const userRef = doc(db, "users", uid);
  return setDoc(userRef, { uid, ...data }, { merge: true });
}
