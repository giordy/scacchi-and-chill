import { HistoryGame, LichessExportGame, ScheduledMatch } from '../types';
import { extractGameId } from './utils';

export type GameProgress = 'finished' | 'ongoing' | 'pending';

export interface SeasonProgress {
  // One entry per game of the season, in schedule order: drawn as the squares of the hero strip
  games: GameProgress[];
  finished: number;
  ongoing: number;
  total: number;
  // Highest round with at least one game created on Lichess
  currentRound?: string;
}

const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function gameProgress(state?: LichessExportGame): GameProgress {
  if (!state || !state.status || state.status === 'created') return 'pending';
  return state.status === 'started' ? 'ongoing' : 'finished';
}

export function computeSeasonProgress(
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  schedule: ScheduledMatch[] = []
): SeasonProgress {
  const stateOf = (g: HistoryGame) => {
    const id = extractGameId(g.url);
    return gameProgress((id && gameStates[id]) || g.lichess);
  };
  const sameGame = (m: ScheduledMatch, g: HistoryGame) =>
    m.round === g.round && m.white === g.white && m.black === g.black;

  // Scheduled games first (the full season), then games created outside the schedule
  const games: GameProgress[] = schedule.map((m) => {
    const g = history.find((h) => sameGame(m, h));
    return g ? stateOf(g) : 'pending';
  });
  history.filter((g) => !schedule.some((m) => sameGame(m, g))).forEach((g) => games.push(stateOf(g)));

  const rounds = [...new Set(history.filter((g) => g.url).map((g) => g.round))].sort(byRound);
  return {
    games,
    finished: games.filter((s) => s === 'finished').length,
    ongoing: games.filter((s) => s === 'ongoing').length,
    total: games.length,
    currentRound: rounds[rounds.length - 1],
  };
}
