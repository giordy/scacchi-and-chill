// Hash-based routes (the site is served from GitHub Pages, so no server-side routing)
const PLAYER_PREFIX = "#/giocatore/";

export const playerHref = (handle: string) => PLAYER_PREFIX + encodeURIComponent(handle);

// "#/giocatore/<handle>" -> handle, anything else -> null
export function parsePlayerHash(hash: string): string | null {
  if (!hash.toLowerCase().startsWith(PLAYER_PREFIX)) return null;
  const raw = hash.slice(PLAYER_PREFIX.length).split(/[/?]/)[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// Admin area: "#admin" (or "?admin"). Matched on the start so a player handle containing "admin" is not mistaken for it.
export function isAdminLocation(hash: string, search: string): boolean {
  return hash.toLowerCase().startsWith("#admin") || search.toLowerCase().includes("admin");
}
