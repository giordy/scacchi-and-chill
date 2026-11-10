import type { SeasonColor } from './lib/seasonColor';

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import firebaseConfigRaw from "../firebase-applet-config.json";
import {
  HistoryGame,
  TournamentMeta,
  Player,
  ScheduledMatch,
  SeasonWinner,
  Settings,
  Withdrawal,
  MasterAnecdote,
  LichessExportGame,
  SeasonArchive,
  EloSeed,
} from "./types";

const firebaseConfig = {
  apiKey: firebaseConfigRaw.apiKey,
  authDomain: firebaseConfigRaw.authDomain,
  projectId: firebaseConfigRaw.projectId,
  storageBucket: firebaseConfigRaw.storageBucket,
  messagingSenderId: firebaseConfigRaw.messagingSenderId,
  appId: firebaseConfigRaw.appId,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore (using specified database ID if present)
export const db = getFirestore(
  app,
  firebaseConfigRaw.firestoreDatabaseId || "(default)"
);

// Default tournament ID for the tournament
export const TOURNAMENT_DOC_ID = "scacchi-and-chill-official";

export interface TournamentDocData {
  title?: string;
  season?: string;
  color?: SeasonColor;
  subtitle?: string;
  imageUrl?: string;
  masterName?: string;
  description?: string;
  howItWorks?: string;
  fairPlayText?: string;
  withdrawalText?: string;
  withdrawals?: Withdrawal[];
  masterAnecdotes?: MasterAnecdote[];
  daysPerMove?: number;
  rated?: boolean;
  winners?: SeasonWinner[];
  roster?: Player[];
  seeds?: EloSeed[];
  players?: Player[];
  schedule?: ScheduledMatch[];
  updatedAt?: string;
}

// 1. Save or update complete tournament data (meta, players, schedule) in Firestore
export async function saveTournamentFullToFirebase(data: {
  meta?: TournamentMeta;
  players?: Player[];
  schedule?: ScheduledMatch[];
}): Promise<void> {
  const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID);
  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.meta) {
    payload.title = data.meta.title;
    payload.season = data.meta.season;
    if (data.meta.subtitle !== undefined) payload.subtitle = data.meta.subtitle;
    if (data.meta.imageUrl !== undefined) payload.imageUrl = data.meta.imageUrl;
    if (data.meta.masterName !== undefined) payload.masterName = data.meta.masterName;
    if (data.meta.color !== undefined) payload.color = data.meta.color;
    payload.description = data.meta.description;
    if (data.meta.howItWorks !== undefined) payload.howItWorks = data.meta.howItWorks;
    if (data.meta.fairPlayText !== undefined) payload.fairPlayText = data.meta.fairPlayText;
    if (data.meta.withdrawalText !== undefined) payload.withdrawalText = data.meta.withdrawalText;
    if (data.meta.masterAnecdotes !== undefined) payload.masterAnecdotes = data.meta.masterAnecdotes;
    if (data.meta.withdrawals !== undefined) payload.withdrawals = JSON.parse(JSON.stringify(data.meta.withdrawals));
    if (data.meta.daysPerMove !== undefined) payload.daysPerMove = data.meta.daysPerMove;
    if (data.meta.rated !== undefined) payload.rated = data.meta.rated;
    // Firestore rejects undefined values (e.g. a winner without notes): the JSON round trip drops them
    if (data.meta.winners !== undefined) payload.winners = JSON.parse(JSON.stringify(data.meta.winners));
    if (data.meta.roster !== undefined) payload.roster = data.meta.roster.map(({ handle, name }) => ({ handle, name }));
    // Firestore rejects undefined values (a seed without a Lichess rating): the JSON round trip drops them
    if (data.meta.seeds !== undefined) payload.seeds = JSON.parse(JSON.stringify(data.meta.seeds));
  }
  if (data.players) {
    payload.players = data.players;
  }
  if (data.schedule) {
    payload.schedule = data.schedule;
  }
  await setDoc(ref, payload, { merge: true });
}

// Subscribe to full tournament doc (meta, players, schedule): null while it does not exist yet
export function subscribeToTournamentDoc(
  onUpdate: (doc: TournamentDocData | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => onUpdate(snap.exists() ? (snap.data() as TournamentDocData) : null),
    (err) => {
      console.warn("Sottoscrizione documento torneo fallita:", err);
      onError?.(err);
    }
  );
}

// Organizer-only notes (player anecdotes).
// Stored in a private document: Firestore rules allow only the admin to read it,
// because the anecdotes are personal and must not be exposed on the public page.
// The same document holds the organizer settings (Lichess token, challenge options),
// so they are the same on every device of the organizer.
export interface OrganizerData {
  anecdotes: Record<string, string>;
  settings?: Partial<Settings>;
  // Lichess ids of the cheating cases the organizer already acknowledged
  fairPlaySeen?: string[];
}

const organizerRef = () => doc(db, "tournaments", TOURNAMENT_DOC_ID, "private", "organizer");

export async function saveOrganizerData(data: OrganizerData): Promise<void> {
  // Firestore rejects undefined values: the JSON round trip drops them
  const clean = JSON.parse(JSON.stringify(data));
  await setDoc(organizerRef(), { ...clean, updatedAt: new Date().toISOString() });
}

// Calls onUpdate with the stored data, or null when the document does not exist yet.
// Snapshots caused by local writes are skipped so typing is never overwritten by its own echo.
export function subscribeToOrganizerData(
  onUpdate: (data: OrganizerData | null) => void,
  onError?: (err: unknown) => void
): () => void {
  return onSnapshot(
    organizerRef(),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data();
      onUpdate({
        anecdotes: d.anecdotes ?? {},
        settings: d.settings,
        fairPlaySeen: d.fairPlaySeen ?? [],
      });
    },
    (err) => {
      console.warn("Sottoscrizione note organizzatore fallita:", err);
      onError?.(err);
    }
  );
}

// Deletes every game of the tournament (used when starting a new season, after archiving)
export async function deleteAllGames(): Promise<number> {
  const snap = await getDocs(collection(db, "tournaments", TOURNAMENT_DOC_ID, "games"));
  const refs = snap.docs.map((d) => d.ref);
  // A Firestore batch holds at most 500 operations
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  return refs.length;
}

// Restore from a backup: the games collection becomes exactly the given games, results included
export async function replaceAllGames(games: HistoryGame[]): Promise<void> {
  await deleteAllGames();
  for (let i = 0; i < games.length; i += 400) {
    const batch = writeBatch(db);
    games.slice(i, i + 400).forEach((g) => {
      const data: Record<string, unknown> = {
        round: g.round,
        white: g.white,
        black: g.black,
        url: g.url || "",
        createdAt: g.createdAt || Date.now(),
        updatedAt: new Date().toISOString(),
      };
      // Firestore rejects undefined values: the JSON round trip drops them
      if (g.lichess) data.lichess = JSON.parse(JSON.stringify(g.lichess));
      batch.set(doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", gameDocIdOf(g)), data);
    });
    await batch.commit();
  }
}

// Archived seasons: publicly readable, written only by the organizer
export async function saveSeasonArchive(archive: SeasonArchive): Promise<void> {
  const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID, "seasons", archive.id);
  await setDoc(ref, archive);
}

export function subscribeToSeasons(onUpdate: (seasons: SeasonArchive[]) => void): () => void {
  return onSnapshot(
    collection(db, "tournaments", TOURNAMENT_DOC_ID, "seasons"),
    (snap) => onUpdate(snap.docs.map((d) => ({ ...(d.data() as SeasonArchive), id: d.id }))),
    (err) => console.warn("Sottoscrizione stagioni fallita:", err)
  );
}

// Uploaded photos (see lib/media.ts): publicly readable, written only by the organizer
export async function saveMediaImage(id: string, dataUrl: string): Promise<void> {
  await setDoc(doc(db, "tournaments", TOURNAMENT_DOC_ID, "media", id), { dataUrl, updatedAt: new Date().toISOString() });
}

export async function loadMediaImage(id: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "tournaments", TOURNAMENT_DOC_ID, "media", id));
  const dataUrl = snap.exists() ? snap.data().dataUrl : null;
  return typeof dataUrl === "string" ? dataUrl : null;
}

export async function loadAllMediaImages(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, "tournaments", TOURNAMENT_DOC_ID, "media"));
  const out: Record<string, string> = {};
  snap.docs.forEach((d) => {
    const dataUrl = d.data().dataUrl;
    if (typeof dataUrl === "string") out[d.id] = dataUrl;
  });
  return out;
}

// Predictable ID of a game document: r<round>_<white>_<black>
function gameDocIdOf(game: Pick<HistoryGame, "round" | "white" | "black">): string {
  return `r${game.round}_${game.white}_${game.black}`;
}

// Deletes the given games (e.g. a round created by mistake)
export async function deleteGamesFromFirebase(games: HistoryGame[]): Promise<void> {
  for (let i = 0; i < games.length; i += 400) {
    const batch = writeBatch(db);
    games.slice(i, i + 400).forEach((g) =>
      batch.delete(doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", gameDocIdOf(g)))
    );
    await batch.commit();
  }
}

// 4. Batch save multiple games
export async function saveGamesBatchToFirebase(
  games: HistoryGame[]
): Promise<void> {
  if (games.length === 0) return;
  const batch = writeBatch(db);
  games.forEach((game) => {
    const gameDocId = gameDocIdOf(game);
    const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", gameDocId);
    batch.set(
      ref,
      {
        round: game.round,
        white: game.white,
        black: game.black,
        url: game.url || "",
        createdAt: game.createdAt || Date.now(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

// A game with a new Lichess link (recreated, or created by the players): the old document goes when
// the colors changed (its id has them), and the stored Lichess state of the old link is dropped,
// replaced by the new one when it is already known
export async function replaceGameLink(old: HistoryGame, next: HistoryGame): Promise<void> {
  const batch = writeBatch(db);
  const oldId = gameDocIdOf(old);
  const newId = gameDocIdOf(next);
  if (oldId !== newId) batch.delete(doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", oldId));
  const data: Record<string, unknown> = {
    round: next.round,
    white: next.white,
    black: next.black,
    url: next.url,
    createdAt: next.createdAt || Date.now(),
    updatedAt: new Date().toISOString(),
  };
  if (next.lichess) data.lichess = JSON.parse(JSON.stringify(next.lichess));
  batch.set(doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", newId), data);
  await batch.commit();
}

// 4b. Salva lo stato Lichess (esito, mosse, apertura) sulle partite corrispondenti
export async function saveLichessStatesToFirebase(
  games: HistoryGame[],
  states: Record<string, LichessExportGame>,
  extractId: (url?: string) => string | undefined
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;
  games.forEach((game) => {
    const id = extractId(game.url);
    const state = id ? states[id] : undefined;
    if (!state) return;
    const gameDocId = gameDocIdOf(game);
    const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", gameDocId);
    // Firestore non accetta valori undefined: passiamo per JSON per ripulire l'oggetto
    const clean = JSON.parse(JSON.stringify(state));
    batch.set(
      ref,
      {
        round: game.round,
        white: game.white,
        black: game.black,
        url: game.url || "",
        lichess: clean,
        syncedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    count++;
  });
  if (count > 0) await batch.commit();
  return count;
}

// 6. Real-time subscription to tournament games
export function subscribeToGames(
  onUpdate: (games: HistoryGame[]) => void
): () => void {
  const gamesCol = collection(db, "tournaments", TOURNAMENT_DOC_ID, "games");
  return onSnapshot(
    gamesCol,
    (snap) => {
      const list: HistoryGame[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.round && data.white && data.black) {
          list.push({
            round: String(data.round),
            white: String(data.white),
            black: String(data.black),
            url: String(data.url || ""),
            createdAt: Number(data.createdAt) || undefined,
            lichess: data.lichess || undefined,
          });
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn("Sottoscrizione Firestore non riuscita:", err);
    }
  );
}
