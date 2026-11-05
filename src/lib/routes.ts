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

// Sections of the public page: "#/partite", "#/tabellone", "#/torneo", "#/classifica" (the default)
export type PublicTab = "standings" | "matches" | "crosstable" | "tournament";
const TAB_SLUGS: Record<PublicTab, string> = {
  standings: "classifica",
  matches: "partite",
  crosstable: "tabellone",
  tournament: "torneo",
};

export const publicTabHref = (tab: PublicTab) => `#/${TAB_SLUGS[tab]}`;

// Unknown or empty hash -> standings
export function parsePublicTab(hash: string): PublicTab {
  const slug = hash.toLowerCase().replace(/^#\/?/, "").split(/[/?]/)[0];
  const found = (Object.keys(TAB_SLUGS) as PublicTab[]).find((t) => TAB_SLUGS[t] === slug);
  return found ?? "standings";
}
