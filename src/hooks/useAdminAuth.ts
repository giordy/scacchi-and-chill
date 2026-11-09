import { useEffect, useState } from 'react';
import { errorMessage } from '../lib/utils';
import { subscribeToAuth, signInAdminWithGoogle, signInAdminWithIdToken, signOutAdmin, isAdminUser, startGoogleSignInRedirect } from '../firebaseAuth';
import { isInstalledApp, takeGoogleAnswer } from '../lib/googleRedirect';
import { excludeThisBrowser } from '../lib/analytics';

// Sign-in state of the organizer (used only inside the organizer area)
export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Firebase Authentication state: access is granted only to the accounts with a document in admins
  useEffect(() => {
    let latest = 0;
    return subscribeToAuth(async (user) => {
      const check = ++latest;
      const ok = await isAdminUser(user);
      if (check !== latest) return; // a newer sign-in state arrived meanwhile
      setAuthReady(true);
      setIsAuthenticated(ok);
      setEmail(ok && user?.email ? user.email : "");
      // The organizer checks the site often: from a browser signed in here once, no visit is counted
      if (ok) excludeThisBrowser();
      if (user && !ok) {
        setError(`L'account ${user.email} non è autorizzato come organizzatore.`);
        signOutAdmin().catch(() => {});
      }
    });
  }, []);

  // Back from Google in the installed app: the ID token kept by main.tsx becomes the Firebase sign-in
  useEffect(() => {
    const answer = takeGoogleAnswer();
    if (!answer) return;
    if ("error" in answer) {
      setError(answer.error);
      return;
    }
    setIsSigningIn(true);
    signInAdminWithIdToken(answer.idToken)
      .catch((err) => setError("Errore durante l'accesso: " + errorMessage(err)))
      .finally(() => setIsSigningIn(false));
  }, []);

  const login = async () => {
    setError("");
    // Installed app: Firebase's popup cannot reach back to it, so the whole app goes to Google
    if (isInstalledApp()) {
      setIsSigningIn(true);
      startGoogleSignInRedirect();
      return;
    }
    setIsSigningIn(true);
    try {
      await signInAdminWithGoogle();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("Errore durante l'accesso: " + errorMessage(err));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = () => {
    signOutAdmin().catch(() => {});
    window.location.hash = "";
  };

  return { authReady, isAuthenticated, email, error, isSigningIn, login, logout };
}
