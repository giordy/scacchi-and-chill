import { HistoryGame, LichessExportGame, Player } from '../types';
import { collectFinishedGames } from './moveTimes';

export interface SeasonStats {
  games: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  mates: number;
  resigns: number;
  timeouts: number;
  avgMoves?: number; // over the games with moves
  avgDays?: number; // from the first to the last move
  topOpening?: { name: string; games: number }; // the most played family, when played at least twice
}

const DAY = 86400e3;
const MIN_GAMES = 3;

// A few anonymous numbers of the season, from the games played on the board (no forfeits).
// Nothing names a player. Null until there are enough games to say something.
export function seasonStats(players: Player[], history: HistoryGame[], gameStates: Record<string, LichessExportGame>): SeasonStats | null {
  const games = collectFinishedGames(players, history, gameStates);
  if (games.length < MIN_GAMES) return null;
  const count = (f: (g: (typeof games)[number]) => boolean) => games.filter(f).length;
  const withMoves = games.filter((g) => g.moves > 0);
  const timed = games.filter((g) => g.state.createdAt && g.state.lastMoveAt && g.state.lastMoveAt >= g.state.createdAt);
  const openings = new Map<string, number>();
  games.forEach((g) => {
    const family = g.state.opening?.name?.split(':')[0].trim();
    if (family) openings.set(family, (openings.get(family) ?? 0) + 1);
  });
  const [top] = [...openings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    games: games.length,
    whiteWins: count((g) => g.state.winner === 'white'),
    blackWins: count((g) => g.state.winner === 'black'),
    draws: count((g) => !g.state.winner),
    mates: count((g) => g.status === 'mate'),
    resigns: count((g) => g.status === 'resign'),
    timeouts: count((g) => g.status === 'outoftime' || g.status === 'timeout'),
    avgMoves: withMoves.length > 0 ? withMoves.reduce((n, g) => n + g.moves, 0) / withMoves.length : undefined,
    avgDays: timed.length > 0 ? timed.reduce((n, g) => n + (g.state.lastMoveAt! - g.state.createdAt!), 0) / timed.length / DAY : undefined,
    topOpening: top && top[1] >= 2 ? { name: top[0], games: top[1] } : undefined,
  };
}
