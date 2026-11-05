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
  howItWorks:
    "1. All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.\n2. Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.",
  fairPlayText:
    "• Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.\n• In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.\n• Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore.",
  withdrawalText:
    "• Chi si ritira prima di aver giocato metà delle sue partite esce dal torneo e tutte le sue partite vengono annullate, anche quelle già giocate.\n• Chi si ritira dopo aver giocato almeno metà delle sue partite resta in classifica con i risultati ottenuti; le partite che non giocherà valgono come vittoria a tavolino per gli avversari.\n• Se pensi di ritirarti, avvisa prima l'organizzatore in privato.",
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
    howItWorks: doc.howItWorks || "",
    fairPlayText: doc.fairPlayText || "",
    withdrawalText: doc.withdrawalText || "",
    withdrawals: doc.withdrawals || [],
    daysPerMove: typeof doc.daysPerMove === "number" && doc.daysPerMove > 0 ? doc.daysPerMove : undefined,
    rated: typeof doc.rated === "boolean" ? doc.rated : undefined,
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
    withdrawalText: patch.withdrawalText ?? current?.withdrawalText ?? d.withdrawalText,
    withdrawals: patch.withdrawals ?? current?.withdrawals ?? [],
    daysPerMove: patch.daysPerMove ?? current?.daysPerMove,
    rated: patch.rated ?? current?.rated,
    winners: patch.winners ?? current?.winners ?? d.winners,
  };
}
