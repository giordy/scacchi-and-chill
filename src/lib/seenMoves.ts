import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';

// The time of the last move of every game of the season, by Lichess id. What the visitor has seen
// is kept in the same form (hooks/useSeenMoves): a game has news when its last move is later.
export type SeenMoves = Record<string, number>;

export function lastMovesOf(history: HistoryGame[], gameStates: Record<string, LichessExportGame>): SeenMoves {
  const moves: SeenMoves = {};
  history.forEach((g) => {
    const id = extractGameId(g.url);
    const at = id ? gameStates[id]?.lastMoveAt : undefined;
    if (id && typeof at === 'number' && at > 0) moves[id] = at;
  });
  return moves;
}

// The games moved since what was seen: none on a first visit (nothing seen yet, nothing is news)
export function newMoveIds(lastMoves: SeenMoves, seen: SeenMoves | null): Set<string> {
  if (!seen) return new Set();
  return new Set(Object.entries(lastMoves).filter(([id, at]) => at > (seen[id] ?? 0)).map(([id]) => id));
}
