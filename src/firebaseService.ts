import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
  getDocFromServer,
} from "firebase/firestore";
import firebaseConfigRaw from "../firebase-applet-config.json";
import {
  HistoryGame,
  TournamentMeta,
  Player,
  ScheduledMatch,
  SeasonWinner,
  LichessExportGame,
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

// Test connection
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("client is offline")) {
      console.warn("Firestore client appears offline:", error.message);
    }
    return false;
  }
}

export interface TournamentDocData {
  title?: string;
  season?: string;
  subtitle?: string;
  imageUrl?: string;
  masterName?: string;
  description?: string;
  rulesText?: string;
  howItWorks?: string;
  fairPlayText?: string;
  winners?: SeasonWinner[];
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
    payload.description = data.meta.description;
    payload.rulesText = data.meta.rulesText;
    if (data.meta.howItWorks !== undefined) payload.howItWorks = data.meta.howItWorks;
    if (data.meta.fairPlayText !== undefined) payload.fairPlayText = data.meta.fairPlayText;
    if (data.meta.winners !== undefined) payload.winners = data.meta.winners;
  }
  if (data.players) {
    payload.players = data.players;
  }
  if (data.schedule) {
    payload.schedule = data.schedule;
  }
  await setDoc(ref, payload, { merge: true });
}

// 2. Load complete tournament document
export async function loadTournamentFullFromFirebase(): Promise<TournamentDocData | null> {
  try {
    const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as TournamentDocData;
    }
  } catch (err) {
    console.warn("Errore caricamento dati torneo da Firestore:", err);
  }
  return null;
}

// Subscribe to full tournament doc (meta, players, schedule)
export function subscribeToTournamentDoc(
  onUpdate: (doc: TournamentDocData) => void
): () => void {
  const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as TournamentDocData);
      }
    },
    (err) => {
      console.warn("Sottoscrizione documento torneo fallita:", err);
    }
  );
}

// Backward-compat helpers
export async function saveTournamentMetaToFirebase(
  meta: TournamentMeta
): Promise<void> {
  return saveTournamentFullToFirebase({ meta });
}

export async function loadTournamentMetaFromFirebase(): Promise<TournamentMeta | null> {
  const d = await loadTournamentFullFromFirebase();
  if (d && d.title && d.season) {
    return {
      title: d.title,
      season: d.season,
      subtitle: d.subtitle || "",
      imageUrl: d.imageUrl || "",
      masterName: d.masterName || "",
      description: d.description || "",
      rulesText: d.rulesText || "",
      howItWorks: d.howItWorks || "",
      fairPlayText: d.fairPlayText || "",
      winners: d.winners || [],
    };
  }
  return null;
}

// 3. Save a game to Firestore
export async function saveGameToFirebase(game: HistoryGame): Promise<void> {
  // Use a predictable ID for the game: round_white_black
  const gameDocId = `r${game.round}_${game.white}_${game.black}`;
  const ref = doc(db, "tournaments", TOURNAMENT_DOC_ID, "games", gameDocId);
  await setDoc(
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
}

// 4. Batch save multiple games
export async function saveGamesBatchToFirebase(
  games: HistoryGame[]
): Promise<void> {
  if (games.length === 0) return;
  const batch = writeBatch(db);
  games.forEach((game) => {
    const gameDocId = `r${game.round}_${game.white}_${game.black}`;
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
    const gameDocId = `r${game.round}_${game.white}_${game.black}`;
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

// 5. Load all games from Firestore
export async function loadGamesFromFirebase(): Promise<HistoryGame[]> {
  try {
    const gamesCol = collection(db, "tournaments", TOURNAMENT_DOC_ID, "games");
    const snap = await getDocs(gamesCol);
    const result: HistoryGame[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.round && data.white && data.black) {
        result.push({
          round: String(data.round),
          white: String(data.white),
          black: String(data.black),
          url: String(data.url || ""),
          createdAt: Number(data.createdAt) || undefined,
          lichess: data.lichess || undefined,
        });
      }
    });
    return result;
  } catch (err) {
    console.warn("Errore caricamento partite da Firestore:", err);
    return [];
  }
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

// 7. Admin authentication (Google sign-in via Firebase Authentication)
// L'email autorizzata deve coincidere con quella scritta in firestore.rules.
export const ADMIN_EMAILS = ["jordan83@gmail.com"];

const auth = getAuth(app);

export function isAdminUser(user: User | null): boolean {
  return (
    !!user &&
    !!user.email &&
    user.emailVerified &&
    ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

export function subscribeToAuth(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, onChange);
}

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

