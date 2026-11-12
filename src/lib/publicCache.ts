import { HistoryGame, SeasonArchive } from '../types';
import type { TournamentDocData } from '../firebaseService';

// The last tournament read from Firestore, kept in the browser: with no network at the first load
// the public page shows it, saying of when it is, instead of nothing.
export interface PublicSnapshot {
  at: number;
  doc: TournamentDocData | null;
  games: HistoryGame[];
  seasons: SeasonArchive[];
}

const KEY = 'sc:public-snapshot:v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

const browserStore = (): Store | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined; // storage blocked
  }
};

// Saved whole; when the browser has no room for it, without the archived seasons (the heaviest
// part: the page works without them)
export function saveSnapshot(snapshot: PublicSnapshot, store: Store | undefined = browserStore()) {
  if (!store) return;
  for (const s of [snapshot, { ...snapshot, seasons: [] }]) {
    try {
      store.setItem(KEY, JSON.stringify(s));
      return;
    } catch {
      // no room: try the lighter one
    }
  }
}

export function loadSnapshot(store: Store | undefined = browserStore()): PublicSnapshot | null {
  try {
    const s = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (!s || typeof s.at !== 'number' || !Array.isArray(s.games) || !Array.isArray(s.seasons)) return null;
    return { at: s.at, doc: s.doc ?? null, games: s.games, seasons: s.seasons };
  } catch {
    return null;
  }
}
