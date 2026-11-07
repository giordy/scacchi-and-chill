// The register of every player who ever took part: the Lichess handle is the key, the name is the
// one the organizer chose and is shown everywhere, past seasons included (renaming someone renames
// them in the archives too). Players of the current season are the active ones.
import { HistoryGame, Player, ScheduledMatch, SeasonArchive, SeasonWinner } from '../types';
import { fullPodium } from './honours';

const key = (handle: string) => handle.trim().toLowerCase();

export interface RosterEntry {
  handle: string;
  name: string;
  active: boolean; // plays the current season
  seasons: string[]; // archived seasons played, oldest first
  // Appears in the archives or the hall of fame (or left a season): cannot be deleted
  inHistory: boolean;
}

export interface RosterSources {
  roster?: Player[]; // the names chosen by the organizer
  players: Player[]; // current season
  seasons?: SeasonArchive[];
  winners?: SeasonWinner[];
}

// Everyone, from every source: the stored register, the current players, the archived tables,
// who left an archived season, the hall of fame. The name comes from the register when the player
// is there, otherwise from the current season, otherwise from the newest archive. Sorted by name.
export function fullRoster({ roster = [], players, seasons = [], winners = [] }: RosterSources): RosterEntry[] {
  const map = new Map<string, RosterEntry>();
  const add = (handle: string, name: string | undefined, patch: Partial<RosterEntry> = {}) => {
    const k = key(handle);
    if (!k) return;
    const entry = map.get(k) ?? { handle: handle.trim(), name: (name ?? '').trim() || handle.trim(), active: false, seasons: [], inHistory: false };
    if (!map.has(k)) map.set(k, entry);
    if (patch.active) entry.active = true;
    if (patch.inHistory) entry.inHistory = true;
    if (patch.seasons) entry.seasons.push(...patch.seasons.filter((s) => !entry.seasons.includes(s)));
  };
  const oldestFirst = [...seasons].sort((a, b) => a.archivedAt.localeCompare(b.archivedAt));
  // Names: the register first, then the current season, then the newest archive
  roster.forEach((p) => add(p.handle, p.name));
  players.forEach((p) => add(p.handle, p.name, { active: true }));
  [...oldestFirst].reverse().forEach((s) => {
    s.standings.forEach((r) => add(r.handle, r.name, { inHistory: true }));
    (s.departures ?? []).forEach((d) => add(d.handle, d.name, { inHistory: true }));
  });
  winners.flatMap(fullPodium).forEach((p) => add(p.handle, p.name, { inHistory: true }));
  oldestFirst.forEach((s) =>
    [...s.standings.map((r) => r.handle), ...(s.departures ?? []).map((d) => d.handle)].forEach((h) => add(h, undefined, { seasons: [s.season] }))
  );
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'it') || a.handle.localeCompare(b.handle));
}

// Name of a handle: from the register, otherwise the given fallback, otherwise the handle
export type NameOf = (handle: string, fallback?: string) => string;
export function rosterNameOf(entries: Array<{ handle: string; name: string }>): NameOf {
  const names = new Map(entries.map((e) => [key(e.handle), e.name]));
  return (handle, fallback) => names.get(key(handle)) ?? fallback ?? handle;
}

// Names used by more than one player, ignoring case: the ones to tell apart
export function duplicateNames(entries: Array<{ handle: string; name: string }>): Set<string> {
  const count = new Map<string, number>();
  entries.forEach((e) => count.set(e.name.trim().toLowerCase(), (count.get(e.name.trim().toLowerCase()) ?? 0) + 1));
  return new Set(entries.filter((e) => (count.get(e.name.trim().toLowerCase()) ?? 0) > 1).map((e) => key(e.handle)));
}

// Whether the player has games in the current season, created or in the calendar
export const hasSeasonGames = (handle: string, history: HistoryGame[], schedule: ScheduledMatch[] = []) =>
  [...history, ...schedule].some((g) => key(g.white) === key(handle) || key(g.black) === key(handle));

// The register as stored after a change: every entry, with its name (the derived flags are not stored)
export const storedRoster = (entries: RosterEntry[]): Player[] => entries.map(({ handle, name }) => ({ handle, name }));

// A new player for the register: an error message, or null when it can be added
export function newPlayerError(entries: RosterEntry[], handle: string, name: string): string | null {
  if (!handle.trim() || !name.trim()) return 'Scrivi sia il nome sia il nome utente Lichess.';
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(handle.trim())) return 'Il nome utente Lichess ha solo lettere, numeri, «_» e «-».';
  const same = entries.find((e) => key(e.handle) === key(handle));
  if (same) return `@${same.handle} è già registrato, come ${same.name}.`;
  return null;
}

// The register with one player renamed, and the current players with the same name
export function renamePlayer(entries: RosterEntry[], players: Player[], handle: string, name: string): { roster: Player[]; players: Player[] } {
  const trimmed = name.trim();
  return {
    roster: storedRoster(entries).map((p) => (key(p.handle) === key(handle) ? { ...p, name: trimmed } : p)),
    players: players.map((p) => (key(p.handle) === key(handle) ? { ...p, name: trimmed } : p)),
  };
}
