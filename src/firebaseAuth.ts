// Admin authentication (Google sign-in via Firebase Authentication). Kept apart from
// firebaseService so that only the organizer area, loaded on demand, downloads it.
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { app } from "./firebaseService";

// L'email autorizzata deve coincidere con quella scritta in firestore.rules.
export const ADMIN_EMAILS = ["organizer@example.com"];

const auth = getAuth(app);

export function isAdminUser(user: User | null): boolean {
  return !!user && !!user.email && user.emailVerified && ADMIN_EMAILS.includes(user.email.toLowerCase());
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
