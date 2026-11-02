import { useEffect, useState } from 'react';
import { errorMessage } from '../lib/utils';
import { isAdminLocation } from '../lib/routes';
import {
  subscribeToAuth,
  signInAdminWithGoogle,
  signOutAdmin,
  isAdminUser,
} from '../firebaseService';

// Admin mode is selected by the URL: #admin or ?admin
const checkIsAdminRoute = () => isAdminLocation(window.location.hash, window.location.search);

export function useAdminAuth() {
  const [isAdminRoute, setIsAdminRoute] = useState(checkIsAdminRoute);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const handleHash = () => setIsAdminRoute(checkIsAdminRoute());
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Firebase Authentication state: access is granted only to the accounts in ADMIN_EMAILS
  useEffect(() => {
    return subscribeToAuth((user) => {
      setAuthReady(true);
      const ok = isAdminUser(user);
      setIsAuthenticated(ok);
      setEmail(ok && user?.email ? user.email : "");
      if (user && !ok) {
        setError(`L'account ${user.email} non è autorizzato come organizzatore.`);
        signOutAdmin().catch(() => {});
      }
    });
  }, []);

  const login = async () => {
    setError("");
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

  return { isAdminRoute, authReady, isAuthenticated, email, error, isSigningIn, login, logout };
}
