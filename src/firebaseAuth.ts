// Admin authentication (Google sign-in via Firebase Authentication). Kept apart from
// firebaseService so that only the organizer area, loaded on demand, downloads it.
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "./firebaseService";

const auth = getAuth(app);

// The organizers are the documents admins/<email> on Firestore (created by hand in the Firebase
// console, see the README), so no email is written in the code or in the published site. The rules
// let an account read only its own document: if it exists, the account is an organizer.
export async function isAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.email || !user.emailVerified) return false;
  try {
    return (await getDoc(doc(db, "admins", user.email))).exists();
  } catch {
    return false;
  }
}

export function subscribeToAuth(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, onChange);
}

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
