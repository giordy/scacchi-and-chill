import { HistoryGame, LichessExportGame, Player, ScheduledMatch, SeasonArchive, TournamentMeta } from '../types';
import { buildSeasonArchive, withChampion } from './seasons';

// What closing a season writes, passed in so the order of the steps can be tested without Firestore
export interface SeasonCloseIO {
  saveSeasonArchive: (archive: SeasonArchive) => Promise<void>;
  deleteAllGames: () => Promise<number>;
  clearHistory: () => void;
  onSeasonReset: () => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}

export interface SeasonCloseInput {
  meta: TournamentMeta;
  players: Player[];
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  nextSeason: string;
  nextMaster: string;
  clearSchedule: boolean;
}

// Closes the season and starts the next one. The archive is saved first: if that fails, it throws
// before anything is deleted. Returns the archive that was saved.
export async function closeSeason(input: SeasonCloseInput, io: SeasonCloseIO): Promise<SeasonArchive> {
  const { meta, players, history, gameStates, seasons } = input;
  // 1. Archive first: if this fails nothing is deleted
  const snapshot = buildSeasonArchive(meta, players, history, gameStates, undefined, seasons);
  await io.saveSeasonArchive(snapshot);
  // 2. Remove the old season's games from Firestore and from this device
  await io.deleteAllGames();
  io.clearHistory();
  io.onSeasonReset();
  // 3. New season details (the champion goes to the hall of fame)
  io.onUpdateTournamentMeta({
    season: input.nextSeason.trim(),
    masterName: input.nextMaster.trim(),
    imageUrl: '',
    subtitle: '',
    masterOpening: '', // chosen again with the new master
    famousGame: { url: '', title: '' },
    winners: withChampion(meta.winners, snapshot),
    withdrawals: [],
    masterAnecdotes: [],
    seeds: [], // the next season's esordienti get theirs at their first game (see lib/seeds.ts)
  });
  if (input.clearSchedule) io.onUpdateSchedule([]);
  return snapshot;
}
