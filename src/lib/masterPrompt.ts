import { FamousGame, MasterAnecdote, TournamentMeta } from '../types';
import { OPENING_FAMILIES, openingFamily } from './masterOpening';

// A new master with an AI: the organizer copies a prompt into Claude or ChatGPT, pastes the reply
// back, and the season's fields are filled in, to be read over before the season starts. The reply
// is JSON, so it can be read without guessing; the photo and the link of the famous game are left to
// the organizer (a model would make them up).

export interface MasterPromptInput {
  master: string;
  rounds: number; // one anecdote per round
  tournamentTitle: string;
}

export function buildMasterPrompt({ master, rounds, tournamentTitle }: MasterPromptInput): string {
  const openings = OPENING_FAMILIES.map((f) => `- ${f.key}: ${f.label} (${f.side === 'white' ? 'la sceglie il bianco' : 'la sceglie il nero'})`);
  return [
    `Prepara i testi per la nuova stagione del torneo di scacchi per corrispondenza tra amici "${tournamentTitle}", dedicata a ${master}.`,
    `I testi vanno sul sito del torneo e nel gruppo WhatsApp: italiano semplice, tono da amici appassionati, frasi brevi.`,
    ``,
    `ACCURATEZZA`,
    `- Solo fatti noti e documentati. Meglio un aneddoto famoso e verificabile che uno raro.`,
    `- Non inventare date, cifre, citazioni o partite. Se un dettaglio è incerto, scrivilo in "toCheck".`,
    `- Non scrivere link, notazioni delle partite (PGN) o indirizzi di immagini.`,
    `- Ogni testo va sul sito così com'è: niente frasi rivolte a me, come «ecco» o «perfetta per la presentazione».`,
    ``,
    `COSA SERVE`,
    `1. motto: una frase breve che lo riassuma, senza virgolette (es. per Capablanca "La macchina degli scacchi").`,
    `2. presentation: chi era, in 2 o 3 paragrafi brevi (in tutto 80-150 parole). Formattazione WhatsApp: *grassetto* per uno o due passaggi chiave, nient'altro.`,
    `3. anecdotes: esattamente ${rounds} aneddoti, uno per turno del torneo, in ordine cronologico della sua vita. Ognuno con un titolo breve (al massimo 8 parole, senza numerazione) e un testo di 40-80 parole. Aneddoti diversi tra loro: carriera, partite, carattere, curiosità.`,
    `4. opening: la famiglia di aperture più legata a lui, scelta SOLO tra queste chiavi:`,
    ...openings,
    `   Se nessuna è davvero sua, scegli quella che giocava più spesso e spiegalo in "toCheck".`,
    `5. famousGame: la sua partita più celebre, preferibilmente una sua vittoria, con white e black (cognomi), place, year e note (2 o 3 frasi su perché è famosa, scritte per chi legge il sito: niente commenti sulla scelta o su questa richiesta).`,
    `6. photo: dove trovare una sua foto libera da diritti (per esempio cosa cercare su Wikimedia Commons).`,
    `7. toCheck: l'elenco dei dettagli da verificare, vuoto se non ce ne sono.`,
    ``,
    `FORMATO DELLA RISPOSTA`,
    `Rispondi solo con questo JSON, in un blocco di codice, senza testo prima o dopo:`,
    '```json',
    `{`,
    `  "motto": "…",`,
    `  "presentation": "…",`,
    `  "anecdotes": [{ "title": "…", "text": "…" }],`,
    `  "opening": "…",`,
    `  "famousGame": { "white": "…", "black": "…", "place": "…", "year": 1918, "note": "…" },`,
    `  "photo": "…",`,
    `  "toCheck": ["…"]`,
    `}`,
    '```',
  ].join('\n');
}

export interface MasterReply {
  patch: Partial<TournamentMeta>; // the fields to fill in
  photo?: string; // where to look for a photo
  toCheck: string[]; // details the model was unsure of
  warnings: string[]; // parts of the reply that could not be used
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// The JSON of the reply, inside a ```json block or bare, with anything around it ignored
function jsonOf(reply: string): unknown {
  const block = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? reply;
  const start = block.indexOf('{');
  const end = block.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Nella risposta non trovo il blocco JSON.');
  try {
    return JSON.parse(block.slice(start, end + 1));
  } catch {
    throw new Error("Il JSON della risposta non è valido: chiedi all'AI di rimandarlo intero.");
  }
}

// Reads the reply; throws when nothing usable is in it
export function parseMasterReply(reply: string, currentGame?: FamousGame): MasterReply {
  const data = jsonOf(reply) as Record<string, unknown>;
  if (!data || typeof data !== 'object') throw new Error('Nella risposta non trovo il blocco JSON.');
  const patch: Partial<TournamentMeta> = {};
  const warnings: string[] = [];

  const motto = text(data.motto).replace(/^["«“]|["»”]$/g, '');
  if (motto) patch.subtitle = motto;
  const presentation = text(data.presentation);
  if (presentation) patch.description = presentation;

  const anecdotes: MasterAnecdote[] = Array.isArray(data.anecdotes)
    ? data.anecdotes
        .map((a) => ({ title: text((a as Record<string, unknown>)?.title), text: text((a as Record<string, unknown>)?.text) }))
        .filter((a) => a.title && a.text)
    : [];
  if (anecdotes.length > 0) patch.masterAnecdotes = anecdotes;
  else warnings.push('Nessun aneddoto nella risposta.');

  const opening = text(data.opening);
  if (openingFamily(opening)) patch.masterOpening = opening;
  else if (opening) warnings.push(`Apertura "${opening}" non tra quelle del sito: scegline una dall'elenco.`);

  const g = (data.famousGame ?? {}) as Record<string, unknown>;
  const white = text(g.white);
  const black = text(g.black);
  if (white && black) {
    const where = [text(g.place), typeof g.year === 'number' || text(g.year) ? String(g.year).trim() : ''].filter(Boolean).join(' ');
    const title = `${white} – ${black}${where ? `, ${where}` : ''}`;
    const note = text(g.note);
    // The link is the organizer's: kept only if it is for the same game
    const url = currentGame?.title === title ? currentGame.url : '';
    patch.famousGame = { url, title, ...(note ? { note } : {}) };
  }

  if (Object.keys(patch).length === 0) throw new Error('Nella risposta non trovo nessun campo da usare.');
  const toCheck = Array.isArray(data.toCheck) ? data.toCheck.map(text).filter(Boolean) : [];
  const photo = text(data.photo) || undefined;
  return { patch, photo, toCheck, warnings };
}
