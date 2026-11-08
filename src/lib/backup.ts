import { BackupData, HistoryGame, Player, ScheduledMatch, SeasonArchive, TournamentMeta } from '../types';
import type { OrganizerData } from '../firebaseService';
import { isStorableImage } from './media';

export interface BackupSummary {
  season?: string;
  savedAt?: string; // ISO date, when the file says it
  automatic: boolean; // nightly backup from the "backups" branch (public data only)
  players: number;
  scheduled: number;
  games: number;
  seasons: number;
  privateData: boolean; // anecdotes, settings or message texts
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isPlayer = (p: unknown): p is Player => !!p && isText((p as Player).handle) && isText((p as Player).name);
const isMatch = (m: unknown): m is ScheduledMatch =>
  !!m && isText((m as ScheduledMatch).round) && isText((m as ScheduledMatch).white) && isText((m as ScheduledMatch).black);

// Reads a file from "Scarica copia JSON" or from the nightly backup. Throws with a message
// for the organizer when the file is not a backup of this tournament.
export function parseBackup(text: string): { data: BackupData; summary: BackupSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  const d = raw as BackupData & { source?: string };
  if (!d || typeof d !== 'object' || !isText(d.version)) throw new Error('Il file non è una copia dei dati del torneo.');
  if (!Array.isArray(d.players) || !d.players.every(isPlayer) || d.players.length === 0) {
    throw new Error('Nel file manca l’elenco dei giocatori.');
  }
  if (!Array.isArray(d.history) || !d.history.every(isMatch)) throw new Error('Le partite nel file non sono leggibili.');
  if (d.schedule !== undefined && (!Array.isArray(d.schedule) || !d.schedule.every(isMatch))) {
    throw new Error('Il calendario nel file non è leggibile.');
  }
  if (!d.tournament || !isText(d.tournament.title) || !isText(d.tournament.season)) {
    throw new Error('Nel file mancano i dati della stagione.');
  }
  const data: BackupData = {
    ...d,
    history: d.history.map((g: HistoryGame) => ({ ...g, url: g.url ?? '' })),
    schedule: d.schedule ?? [],
    seasons: Array.isArray(d.seasons) ? d.seasons.filter((s) => s && isText(s.id)) : [],
  };
  return {
    data,
    summary: {
      season: d.tournament.season,
      savedAt: isText(d.exportedAt) ? d.exportedAt : undefined,
      automatic: d.source === 'backup automatico',
      players: d.players.length,
      scheduled: data.schedule!.length,
      games: data.history!.length,
      seasons: data.seasons!.length,
      privateData: !!(d.anecdotes || d.settings || d.templates || d.statusPhrases),
    },
  };
}

// What a restore writes, passed in so the order of the steps can be tested without Firestore
export interface RestoreIO {
  exportCurrent: () => Promise<void>; // a copy of the data as it is now, downloaded first
  replaceAllGames: (games: HistoryGame[]) => Promise<void>;
  setHistory: (games: HistoryGame[]) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  saveSeasonArchive: (archive: SeasonArchive) => Promise<void>;
  saveMediaImage: (id: string, dataUrl: string) => Promise<void>;
  replaceOrganizerData: (data: Partial<OrganizerData>) => void;
}

// Restores a backup read by parseBackup. The data as it is now is downloaded before anything is
// replaced; the Lichess token is never in a file, so the current one is kept.
export async function restoreBackup(data: BackupData, summary: BackupSummary, currentToken: string, io: RestoreIO): Promise<void> {
  await io.exportCurrent();
  const games = data.history ?? [];
  await io.replaceAllGames(games);
  io.setHistory(games);
  io.onUpdatePlayers(data.players ?? []);
  io.onUpdateSchedule(data.schedule ?? []);
  // A file from before the withdrawals had none: the current ones must not survive the restore
  io.onUpdateTournamentMeta({ ...data.tournament, withdrawals: data.tournament?.withdrawals ?? [] });
  for (const s of data.seasons ?? []) await io.saveSeasonArchive(s);
  for (const [id, dataUrl] of Object.entries(data.media ?? {})) {
    if (isStorableImage(dataUrl)) await io.saveMediaImage(id, dataUrl);
  }
  if (summary.privateData) {
    io.replaceOrganizerData({
      ...(data.anecdotes ? { anecdotes: data.anecdotes } : {}),
      ...(data.settings ? { settings: { ...data.settings, token: currentToken } } : {}),
      ...(data.templates ? { templates: data.templates } : {}),
      ...(data.statusPhrases !== undefined ? { statusPhrases: data.statusPhrases } : {}),
    });
  }
}
