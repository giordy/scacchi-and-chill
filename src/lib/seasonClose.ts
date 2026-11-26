import { GameAnalysis, HistoryGame, LichessExportGame, Player, ScheduledMatch, SeasonArchive, TournamentMeta } from '../types';
import { archivedAnalyses, buildSeasonArchive, withChampion } from './seasons';
import { withAwardsBanRule } from './fairPlay';

// What closing a season writes, passed in so the order of the steps can be tested without Firestore
export interface SeasonCloseIO {
  saveSeasonArchive: (archive: SeasonArchive) => Promise<void>;
  saveAnalyses: (analyses: Record<string, GameAnalysis>) => Promise<void>;
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

// Closes the season and starts the next one. The archive and the key moments of the games are saved
// first: if either fails, it throws before anything is deleted. Returns the archive that was saved.
export async function closeSeason(input: SeasonCloseInput, io: SeasonCloseIO): Promise<SeasonArchive> {
  const { meta, players, history, gameStates, seasons } = input;
  // 1. Archive first: if this fails nothing is deleted
  const snapshot = buildSeasonArchive(meta, players, history, gameStates, undefined, seasons);
  await io.saveSeasonArchive(snapshot);
  // The key moments live on the games, which are about to be deleted: they go to a collection of their own
  const analyses = archivedAnalyses(history, gameStates);
  if (Object.keys(analyses).length > 0) await io.saveAnalyses(analyses);
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
    masterColor: '', // as the colour of the scudetto
    famousGame: { url: '', title: '' },
    winners: withChampion(meta.winners, snapshot),
    withdrawals: [],
    masterAnecdotes: [],
    roundEnds: [], // the next season's rounds start again from 1 (the length of a round stays)
    seeds: [], // the next season's esordienti get theirs at their first game (see lib/seeds.ts)
    // A game closed for cheating also costs the Trofeo Pillsbury and the awards: decided during
    // Stagione 2 for the seasons after it, so it starts with the next one, and the rules say so
    fairPlayAwardsBan: true,
    ...(meta.fairPlayText !== undefined ? { fairPlayText: withAwardsBanRule(meta.fairPlayText) } : {}),
  });
  if (input.clearSchedule) io.onUpdateSchedule([]);
  return snapshot;
}
