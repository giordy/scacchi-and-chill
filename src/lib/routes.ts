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

// Views of the public page, each with its own address: "#/classifica" (the default),
// "#/tabellone", "#/pillsbury", "#/partite", "#/stagione", "#/albo" and "#/regolamento". Older addresses keep
// working: "#/torneo" is the season, "#/torneo/albo" the hall of fame.
export type PublicView = "standings" | "crosstable" | "pillsbury" | "matches" | "season" | "hall" | "rules";
// The four tabs; the crosstable and the Premio Pillsbury are views of the standings tab, the rules have no tab
export type PublicTab = "standings" | "matches" | "season" | "hall";

const VIEW_SLUGS: Record<PublicView, string> = {
  standings: "classifica",
  crosstable: "tabellone",
  pillsbury: "pillsbury",
  matches: "partite",
  season: "stagione",
  hall: "albo",
  rules: "regolamento",
};

export const publicViewHref = (view: PublicView) => `#/${VIEW_SLUGS[view]}`;

// Unknown or empty hash -> standings
export function parsePublicView(hash: string): PublicView {
  const [slug, sub] = hash.toLowerCase().replace(/^#\/?/, "").split(/[?]/)[0].split("/");
  if (slug === "torneo") return sub === "albo" ? "hall" : "season";
  const found = (Object.keys(VIEW_SLUGS) as PublicView[]).find((v) => VIEW_SLUGS[v] === slug);
  return found ?? "standings";
}

export function tabOfView(view: PublicView): PublicTab | undefined {
  if (view === "crosstable" || view === "pillsbury") return "standings";
  return view === "rules" ? undefined : view;
}
