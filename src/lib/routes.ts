// Hash-based routes (the site is served from GitHub Pages, so no server-side routing)
// Addresses are written with the first slug of each list; every slug of a list is read, so links
// already shared in a group chat keep working whatever the site writes now.
const PLAYER_PREFIXES = ["#/giocatore/", "#/player/"];

export const playerHref = (handle: string) => PLAYER_PREFIXES[0] + encodeURIComponent(handle);

// "#/giocatore/<handle>" or "#/player/<handle>" -> handle, anything else -> null
export function parsePlayerHash(hash: string): string | null {
  const prefix = PLAYER_PREFIXES.find((p) => hash.toLowerCase().startsWith(p));
  if (!prefix) return null;
  const raw = hash.slice(prefix.length).split(/[/?]/)[0];
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
// "#/tabellone", "#/pillsbury", "#/partite", "#/cronaca", "#/stagione", "#/albo" and "#/regolamento",
// or the English ones ("#/standings", "#/games", "#/hall-of-fame"…). Older addresses keep working:
// "#/torneo" is the season, "#/torneo/albo" the hall of fame.
export type PublicView = "standings" | "crosstable" | "pillsbury" | "matches" | "timeline" | "season" | "hall" | "rules";
// The five tabs; the crosstable and the Trofeo Pillsbury are views of the standings tab; the rules
// have no tab
export type PublicTab = "standings" | "matches" | "timeline" | "season" | "hall";

const VIEW_SLUGS: Record<PublicView, string[]> = {
  standings: ["classifica", "standings"],
  crosstable: ["tabellone", "crosstable"],
  pillsbury: ["pillsbury"],
  matches: ["partite", "games"],
  timeline: ["cronaca", "chronicle"],
  season: ["stagione", "season"],
  hall: ["albo", "hall-of-fame"],
  rules: ["regolamento", "rules"],
};

export const publicViewHref = (view: PublicView) => `#/${VIEW_SLUGS[view][0]}`;

// Unknown or empty hash -> standings
export function parsePublicView(hash: string): PublicView {
  const [slug, sub] = hash.toLowerCase().replace(/^#\/?/, "").split(/[?]/)[0].split("/");
  if (slug === "torneo") return sub === "albo" ? "hall" : "season";
  const found = (Object.keys(VIEW_SLUGS) as PublicView[]).find((v) => VIEW_SLUGS[v].includes(slug));
  return found ?? "standings";
}

export function tabOfView(view: PublicView): PublicTab | undefined {
  if (view === "crosstable" || view === "pillsbury") return "standings";
  return view === "rules" ? undefined : view;
}
