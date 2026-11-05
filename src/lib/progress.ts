import { HistoryGame, LichessExportGame, ScheduledMatch } from '../types';
import { byRound } from './games';
import { stateOf as stateOfGame } from './games';

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
    return gameProgress(stateOfGame(g, gameStates));
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

// A state read live from Lichess wins over the stored one, unless the stored one is already final
export function mergeGameStates(
  stored: Record<string, LichessExportGame>,
  live: Record<string, LichessExportGame>
): Record<string, LichessExportGame> {
  const merged = { ...stored };
  Object.entries(live).forEach(([id, s]) => {
    if (gameProgress(stored[id]) !== 'finished') merged[id] = s;
  });
  return merged;
}
