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

// A game of the tournament, by its Lichess id, replayed with its key moments over the page:
// - "#/partita/<id>" (or "#/partita/<id>/momenti", straight to the key moments) is the address to
//   share: it opens over the Partite tab;
// - "<page>?partita=<id>" (or "?momenti=<id>") is how the site opens it from a page, which stays
//   under it, so closing the replay (or going back) returns there.
const GAME_PREFIX = "#/partita/";
const GAME_ID = /^[A-Za-z0-9]{8}$/;

export interface GameRoute {
  id: string;
  moments: boolean; // straight to the key moments
  shared: boolean; // the address of its own ("#/partita/…"), not opened over a page
}

export const gameHref = (id: string, moments = false) => `${GAME_PREFIX}${id}${moments ? "/momenti" : ""}`;

// The page under the replay, with the game in its query
export function gameOverHref(currentHash: string, id: string, moments = false): string {
  const page = pageOfHash(currentHash);
  return `${page}?${moments ? "momenti" : "partita"}=${id}`;
}

// The hash without the game: what is left when the replay closes ("#/partite" for a shared address)
export function pageOfHash(hash: string): string {
  if (hash.toLowerCase().startsWith(GAME_PREFIX)) return publicViewHref("matches");
  const page = hash.split("?")[0];
  return page && page !== "#" ? page : "#/";
}

export function parseGameHash(hash: string): GameRoute | null {
  if (hash.toLowerCase().startsWith(GAME_PREFIX)) {
    const [id, sub] = hash.slice(GAME_PREFIX.length).split(/[?]/)[0].split("/");
    return GAME_ID.test(id) ? { id, moments: sub?.toLowerCase() === "momenti", shared: true } : null;
  }
  const query = hash.split("?")[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  for (const [key, moments] of [["momenti", true], ["partita", false]] as const) {
    const id = params.get(key);
    if (id && GAME_ID.test(id)) return { id, moments, shared: false };
  }
  return null;
}

// Views of the public page, each with its own address: "#/classifica" (the default),
// "#/tabellone", "#/pillsbury", "#/partite", "#/cronaca", "#/stagione", "#/albo" and "#/regolamento". Older addresses keep
// working: "#/torneo" is the season, "#/torneo/albo" the hall of fame. A shared game ("#/partita/…")
// opens over the Partite tab.
export type PublicView = "standings" | "crosstable" | "pillsbury" | "matches" | "timeline" | "season" | "hall" | "rules";
// The five tabs; the crosstable and the Trofeo Pillsbury are views of the standings tab; the rules
// have no tab
export type PublicTab = "standings" | "matches" | "timeline" | "season" | "hall";

const VIEW_SLUGS: Record<PublicView, string> = {
  standings: "classifica",
  crosstable: "tabellone",
  pillsbury: "pillsbury",
  matches: "partite",
  timeline: "cronaca",
  season: "stagione",
  hall: "albo",
  rules: "regolamento",
};

export const publicViewHref = (view: PublicView) => `#/${VIEW_SLUGS[view]}`;

// Unknown or empty hash -> standings
export function parsePublicView(hash: string): PublicView {
  const [slug, sub] = hash.toLowerCase().replace(/^#\/?/, "").split(/[?]/)[0].split("/");
  if (slug === "torneo") return sub === "albo" ? "hall" : "season";
  if (slug === "partita") return "matches";
  const found = (Object.keys(VIEW_SLUGS) as PublicView[]).find((v) => VIEW_SLUGS[v] === slug);
  return found ?? "standings";
}

export function tabOfView(view: PublicView): PublicTab | undefined {
  if (view === "crosstable" || view === "pillsbury") return "standings";
  return view === "rules" ? undefined : view;
}
