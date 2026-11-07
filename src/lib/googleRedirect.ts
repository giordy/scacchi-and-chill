// Google sign-in for the installed app (PWA). There Firebase's popup and redirect break: they go
// through the <project>.firebaseapp.com page, whose storage the installed app cannot reach, so the
// popup stays blank and the redirect ends in "missing initial state". Instead the app itself goes to
// Google (OpenID Connect, response_type=id_token) and Google sends it back to the site with the ID
// token in the address; the organizer area then hands the token to Firebase (signInWithCredential).
// No Firebase import here: main.tsx reads the answer before the app starts, so the public page does
// not download Firebase Auth.

const STATE_KEY = "google-signin-request"; // { state, nonce } of the request on its way to Google
const RESULT_KEY = "google-signin-result"; // { idToken } or { error }, waiting for the organizer area

export type GoogleSignInResult = { idToken: string } | { error: string };

// Opened from the home screen, not in a browser tab
export function isInstalledApp(): boolean {
  const standalone = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Where Google sends the answer: the site's address, without query or hash (it must be listed among
// the authorized redirect URIs of the OAuth client, see the README)
export function redirectUri(href: string = window.location.href): string {
  return new URL(".", href).href;
}

export function googleAuthUrl(clientId: string, redirect: string, state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "id_token",
    scope: "openid email",
    nonce,
    state,
    prompt: "select_account",
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

const random = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export function startGoogleRedirect(clientId: string): void {
  const request = { state: random(), nonce: random() };
  localStorage.setItem(STATE_KEY, JSON.stringify(request));
  window.location.assign(googleAuthUrl(clientId, redirectUri(), request.state, request.nonce));
}

function tokenNonce(idToken: string): string | undefined {
  try {
    const payload = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))).nonce;
  } catch {
    return undefined;
  }
}

// The answer of Google in the hash ("#id_token=…&state=…" or "#error=…&state=…"), checked against
// the request this app made. null when the hash is not an answer of Google.
export function parseGoogleAnswer(hash: string, request: { state: string; nonce: string } | null): GoogleSignInResult | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has("state") || !(params.has("id_token") || params.has("error"))) return null;
  if (!request || params.get("state") !== request.state) return { error: "La risposta di Google non corrisponde a questa richiesta di accesso. Riprova." };
  const error = params.get("error");
  if (error) return { error: error === "access_denied" ? "" : "Google ha rifiutato l'accesso: " + error };
  const idToken = params.get("id_token")!;
  if (tokenNonce(idToken) !== request.nonce) return { error: "La risposta di Google non corrisponde a questa richiesta di accesso. Riprova." };
  return { idToken };
}

// Called once in main.tsx, before the app reads the hash: keeps the answer for the organizer area,
// takes the token out of the address and opens #admin.
export function captureGoogleAnswer(): void {
  try {
    let request: { state: string; nonce: string } | null = null;
    try {
      request = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    } catch {
      request = null;
    }
    const result = parseGoogleAnswer(window.location.hash, request);
    if (!result) return;
    localStorage.removeItem(STATE_KEY);
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
    history.replaceState(null, "", window.location.pathname + window.location.search + "#admin");
  } catch {
    // storage unavailable: the organizer area simply shows the sign-in button again
  }
}

// The answer kept by captureGoogleAnswer, read once
export function takeGoogleAnswer(): GoogleSignInResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESULT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
