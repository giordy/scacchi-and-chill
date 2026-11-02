import { TournamentMeta } from '../types';
import type { TournamentDocData } from '../firebaseService';

export const DEFAULT_TOURNAMENT: TournamentMeta = {
  title: "Scacchi & Chill",
  season: "Stagione 2 - Capablanca",
  subtitle: "La macchina degli scacchi",
  masterName: "José Raúl Capablanca",
  imageUrl: "assets/capablanca.jpg",
  description:
    "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
  rulesText: "",
  howItWorks:
    "1. All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.\n2. Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.",
  fairPlayText:
    "• Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.\n• In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.\n• Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore.",
  winners: [
    { season: "Stagione 1", name: "Fabio", handle: "fsgach", year: "2026", notes: "Campione 1ª Edizione" },
  ],
};

// Builds the tournament metadata from a Firestore document (null if title/season are missing).
export function tournamentFromDoc(doc: TournamentDocData): TournamentMeta | null {
  if (!doc.title || !doc.season) return null;
  return {
    title: doc.title,
    season: doc.season,
    subtitle: doc.subtitle || DEFAULT_TOURNAMENT.subtitle,
    masterName: doc.masterName || DEFAULT_TOURNAMENT.masterName,
    imageUrl: doc.imageUrl || DEFAULT_TOURNAMENT.imageUrl,
    description: doc.description || DEFAULT_TOURNAMENT.description,
    rulesText: doc.rulesText || "",
    howItWorks: doc.howItWorks || "",
    fairPlayText: doc.fairPlayText || "",
    winners: doc.winners || [],
  };
}

// Applies a partial update on top of the current metadata, falling back to the defaults.
export function mergeTournamentMeta(
  current: TournamentMeta | undefined,
  patch: Partial<TournamentMeta>
): TournamentMeta {
  const d = DEFAULT_TOURNAMENT;
  return {
    title: patch.title ?? current?.title ?? d.title,
    season: patch.season ?? current?.season ?? d.season,
    subtitle: patch.subtitle ?? current?.subtitle ?? d.subtitle,
    masterName: patch.masterName ?? current?.masterName ?? d.masterName,
    imageUrl: patch.imageUrl ?? current?.imageUrl ?? d.imageUrl,
    description: patch.description ?? current?.description ?? d.description,
    howItWorks: patch.howItWorks ?? current?.howItWorks ?? d.howItWorks,
    fairPlayText: patch.fairPlayText ?? current?.fairPlayText ?? d.fairPlayText,
    winners: patch.winners ?? current?.winners ?? d.winners,
    rulesText: patch.rulesText ?? current?.rulesText ?? "",
  };
}
