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
  masterAnecdotes: [
    { title: "Imparò a 4 anni correggendo il padre", text: "José Raúl Capablanca non prese mai lezioni. Imparò le regole semplicemente guardando il padre e un amico giocare nel salotto di casa a L'Avana. Durante una partita notò che il padre muoveva un cavallo in modo non consentito: quando glielo fece notare, il padre scosse la testa, ma il bambino gli dimostrò la mossa corretta... e lo batté nella sua prima vera partita subito dopo!" },
    { title: "Campione di Cuba a 12 anni", text: "A soli 12 anni Capablanca affrontò in un match ufficiale Juan Corzo, campione nazionale cubano in carica ed esperto teorico. Lo batté (+4 −2 =6), diventando il più giovane campione nazionale della storia dell'epoca, affidandosi quasi esclusivamente al puro intuito visivo." },
    { title: "La simultanea a tempo di record", text: "Capablanca era celebre per la sua spaventosa velocità di calcolo intuitivo. Durante una tournée negli Stati Uniti giocò una simultanea contro 103 avversari: concluse l'evento in sole 7 ore, vincendo 102 partite e pattandone una sola, camminando quasi senza fermarsi davanti alle scacchiere." },
    { title: "L'esordio a San Sebastián 1911", text: "Quando Capablanca fu invitato al prestigioso torneo di San Sebastián, alcuni dei più forti maestri europei protestarono, ritenendo il giovane cubano un \"incognito\" privo di titoli internazionali. Lui rispose sul campo, vincendo il torneo al suo esordio assoluto in Europa e aggiudicandosi anche il premio per la miglior partita." },
    { title: "L'invincibilità durata 8 anni", text: "Tra il 10 febbraio 1916 e il 15 gennaio 1924 Capablanca non perse neanche una partita in tornei o match ufficiali: 63 partite consecutive contro i migliori giocatori del mondo senza mai subire una sconfitta, un record leggendario per l'epoca." },
    { title: "\"Non studio mai gli scacchi\"", text: "A differenza dei contemporanei come Alekhine o Lasker, che passavano ore ad analizzare le aperture e ad annotare varianti, Capablanca ammetteva di non studiare quasi mai la teoria sui libri. Preferiva affidarsi alla comprensione immediata della posizione, appena seduto alla scacchiera." },
    { title: "La nascita del titolo di \"Gran Maestro\"", text: "Nel torneo di San Pietroburgo del 1914 lo zar Nicola II rimase così affascinato dai cinque finalisti (Lasker, Capablanca, Alekhine, Tarrasch e Marshall) da conferire loro, per la prima volta nella storia, il titolo d'onore di *\"Gran Maestro di Scacchi\"*." },
    { title: "Voleva cambiare le regole degli scacchi", text: "Attorno al 1920, convinto che gli scacchi ad altissimo livello portassero a troppe patte e fossero vicini all'essere \"risolti\", Capablanca propose una variante chiamata *Scacchi di Capablanca*: si giocava su una scacchiera 10x8 con due pezzi nuovi, l'*Arcivescovo* (Alfiere+Cavallo) e il *Cancelliere* (Torre+Cavallo)." },
    { title: "Il \"Mago dei Finali\"", text: "Capablanca è considerato uno dei più grandi maestri di finali di sempre. La sua capacità di trasformare un vantaggio posizionale minimo, un pedone debole o una struttura migliore, in una vittoria nei finali di torre o di pedoni era così pulita da sembrare automatica." },
    { title: "La conquista del titolo mondiale (1921)", text: "Nel 1921 Capablanca sfidò Emanuel Lasker a L'Avana per il titolo mondiale. Lasker, che deteneva la corona da ben 27 anni, fu travolto dalla precisione del maestro cubano: Capablanca vinse 4 partite, ne pattò 10 e non ne perse alcuna, diventando il 3° Campione del Mondo della storia." },
    { title: "Un'eleganza fuori dalla scacchiera", text: "Capablanca non era solo un genio sulla scacchiera, ma una figura di grande fascino pubblico. Parlava un inglese e un francese impeccabili, vestiva con eleganza sartoriale e fu una figura di rilievo nella diplomazia cubana, lavorando anche come ambasciatore straordinario per il suo Paese." },
    { title: "La sconfitta shock con Alekhine (1927)", text: "Nel match mondiale di Buenos Aires del 1927 Capablanca era il favorito assoluto contro Alexander Alekhine, che non lo aveva mai battuto prima. Tuttavia la ferocissima preparazione sulle aperture e la tenacia di Alekhine riuscirono a scalzare il campione cubano dopo 34 estenuanti partite." },
    { title: "Il ritorno trionfale a Nottingham 1936", text: "Nonostante l'età e i primi problemi di salute, nel torneo di Nottingham 1936, uno dei più forti del '900 con ben 5 campioni del mondo presenti, Capablanca dimostrò di essere ancora un gigante, vincendo a pari merito con il giovane Mikhail Botvinnik." },
    { title: "L'addio al Marshall Chess Club", text: "Nel marzo 1942, mentre osservava le partite degli amici al celebre *Marshall Chess Club* di New York, Capablanca fu colpito da un improvviso attacco apoplettico. Il suo storico rivale Emanuel Lasker scrisse di lui: _\"Non ho mai conosciuto un altro genio degli scacchi paragonabile a lui\"_." },
  ],
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
    ...(doc.masterOpening ? { masterOpening: doc.masterOpening } : {}),
    ...(doc.famousGame?.url ? { famousGame: doc.famousGame } : {}),
    imageUrl: doc.imageUrl || DEFAULT_TOURNAMENT.imageUrl,
    description: doc.description || DEFAULT_TOURNAMENT.description,
    howItWorks: doc.howItWorks || "",
    fairPlayText: doc.fairPlayText || "",
    withdrawalText: doc.withdrawalText || "",
    withdrawals: doc.withdrawals || [],
    // Before any were saved, the default ones belong only to the season they were written for
    masterAnecdotes: doc.masterAnecdotes ?? (doc.season === DEFAULT_TOURNAMENT.season ? DEFAULT_TOURNAMENT.masterAnecdotes : []),
    daysPerMove: typeof doc.daysPerMove === "number" && doc.daysPerMove > 0 ? doc.daysPerMove : undefined,
    rated: typeof doc.rated === "boolean" ? doc.rated : undefined,
    winners: doc.winners || [],
    ...(Array.isArray(doc.roster) ? { roster: doc.roster } : {}),
    ...(Array.isArray(doc.seeds) ? { seeds: doc.seeds } : {}),
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
    masterOpening: patch.masterOpening ?? current?.masterOpening ?? '',
    ...((patch.famousGame ?? current?.famousGame) ? { famousGame: patch.famousGame ?? current?.famousGame } : {}),
    imageUrl: patch.imageUrl ?? current?.imageUrl ?? d.imageUrl,
    description: patch.description ?? current?.description ?? d.description,
    howItWorks: patch.howItWorks ?? current?.howItWorks ?? d.howItWorks,
    fairPlayText: patch.fairPlayText ?? current?.fairPlayText ?? d.fairPlayText,
    withdrawalText: patch.withdrawalText ?? current?.withdrawalText ?? d.withdrawalText,
    withdrawals: patch.withdrawals ?? current?.withdrawals ?? [],
    masterAnecdotes: patch.masterAnecdotes ?? current?.masterAnecdotes ?? d.masterAnecdotes,
    daysPerMove: patch.daysPerMove ?? current?.daysPerMove,
    rated: patch.rated ?? current?.rated,
    winners: patch.winners ?? current?.winners ?? d.winners,
    ...((patch.roster ?? current?.roster) ? { roster: patch.roster ?? current?.roster } : {}),
    ...((patch.seeds ?? current?.seeds) ? { seeds: patch.seeds ?? current?.seeds } : {}),
  };
}
