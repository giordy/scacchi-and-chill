import { Player, TournamentMeta } from '../types';
import { seasonId } from './seasons';
import { DEFAULT_TOURNAMENT } from './tournament';

// Accepting the rules of the season. At its start the organizer sends one link to the group (the
// rules page); each player reads the rules, picks their name at the bottom and accepts. The site
// keeps who accepted, when, and which text of the rules (a short fingerprint): a document per player
// and season in tournaments/<id>/pledges, written by the public page without signing in, as
// firestore.rules allows (only for the current season, only once). Who accepted is told in the
// cronaca: accepting for somebody else would be seen by everyone.

export interface Pledge {
  handle: string; // lower-case Lichess handle
  season: string; // the season's name, as TournamentMeta.season
  at: number; // ms, the server's time
  rules: string; // fingerprint of the rules accepted (rulesVersion)
}

// One document per season and player
export const pledgeDocId = (season: string, handle: string) => `${seasonId(season)}--${handle.toLowerCase()}`;

// The rules as the page shows them: what is accepted
export function rulesText(meta: TournamentMeta | undefined): string {
  const d = DEFAULT_TOURNAMENT;
  return [meta?.howItWorks || d.howItWorks, meta?.fairPlayText || d.fairPlayText, meta?.withdrawalText || d.withdrawalText].join('\n\n');
}

// A short fingerprint of the rules (FNV-1a, 32 bits): changes when their text does
export function rulesVersion(meta: TournamentMeta | undefined): string {
  let h = 0x811c9dc5;
  for (const ch of rulesText(meta)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface PledgeStatus {
  accepted: Array<Pledge & { name: string }>; // players of the season who accepted, oldest first
  missing: Player[]; // players who did not, in the order of the list
  outdated: string[]; // handles who accepted a text of the rules since changed
  all: boolean; // everyone accepted (and there is someone)
}

// The season's acceptances: only its players, the latest acceptance of each
export function pledgeStatus(pledges: Pledge[], season: string, players: Player[], version: string): PledgeStatus {
  const mine = new Map<string, Pledge>();
  pledges
    .filter((p) => p.season === season)
    .forEach((p) => {
      const h = p.handle.toLowerCase();
      const old = mine.get(h);
      if (!old || p.at > old.at) mine.set(h, p);
    });
  const accepted = players
    .filter((p) => mine.has(p.handle.toLowerCase()))
    .map((p) => ({ ...mine.get(p.handle.toLowerCase())!, handle: p.handle, name: p.name }))
    .sort((a, b) => a.at - b.at);
  const missing = players.filter((p) => !mine.has(p.handle.toLowerCase()));
  const outdated = accepted.filter((p) => p.rules !== version).map((p) => p.handle);
  return { accepted, missing, outdated, all: players.length > 0 && missing.length === 0 };
}

// A pledge as read from Firestore; null when incomplete. With the id of its document, null also when
// the document is not the one of that season and player: firestore.rules cannot work out the id of a
// season, so a visitor can write "anything--anna"; only the document the site writes counts, the one
// that can be written once and that the organizer cancels.
export function pledgeFromDoc(data: Record<string, unknown>, id?: string): Pledge | null {
  const at = typeof data.at === 'string' ? Date.parse(data.at) : typeof data.at === 'number' ? data.at : NaN;
  if (typeof data.handle !== 'string' || typeof data.season !== 'string' || !Number.isFinite(at)) return null;
  if (id !== undefined && id !== pledgeDocId(data.season, data.handle)) return null;
  return { handle: data.handle.toLowerCase(), season: data.season, at, rules: typeof data.rules === 'string' ? data.rules : '' };
}

// The message for the group, with the link to the rules page
export function pledgeMessage(season: string, url: string): string {
  return [
    `📜 *${season}: il regolamento*`,
    `Prima di cominciare, ognuno apra il link, legga il regolamento e in fondo scelga il suo nome e prema «Accetto».`,
    `Si gioca con le proprie forze: niente motori né aiuti durante la partita.`,
    `🔗 ${url}`,
  ].join('\n');
}
