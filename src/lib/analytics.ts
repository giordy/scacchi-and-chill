// Visits to the public page, counted with GoatCounter (scacchiandchill.goatcounter.com): no cookies,
// no personal data. The script is in index.html with no_onload, because the views live after the "#"
// and GoatCounter alone would count only the home page: each view is counted here, as a path.
// The organizer area is never counted, and neither is a browser where the organizer has signed in.

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string; title?: string }) => void };
  }
}

// The key GoatCounter itself reads: with "t" its script counts nothing in this browser
// (it is also what opening the site at #toggle-goatcounter switches)
const SKIP_KEY = 'skipgc';

export function isExcluded(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === 't';
  } catch {
    return false;
  }
}

// After the organizer signs in: this browser no longer counts, the public page included
export function excludeThisBrowser(): void {
  try {
    localStorage.setItem(SKIP_KEY, 't');
  } catch {
    // storage blocked: the visits of this browser keep counting
  }
}

// The path a view is counted as: "#/giocatore/anna" -> "/giocatore/anna", "" -> "/". Null for what is
// not a view: the switch of GoatCounter itself
export function viewPath(hash: string): string | null {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path.toLowerCase().includes('goatcounter')) return null;
  return '/' + path;
}

// Counts a view; the script loads asynchronously, so a view opened before it is ready waits a little
export function countView(hash: string): void {
  const path = viewPath(hash);
  if (path === null || isExcluded()) return;
  let tries = 0;
  const send = () => {
    const count = window.goatcounter?.count;
    if (count) count({ path });
    else if (tries++ < 20) window.setTimeout(send, 500);
  };
  send();
}
