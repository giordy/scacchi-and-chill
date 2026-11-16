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

// How long a move stays news: with 2 days per move, one older than this is the state of the game,
// not news. Who comes back after longer finds the results in the cronaca.
export const NEWS_MS = 3 * 24 * 60 * 60 * 1000;

// The games moved since what was seen, in the last NEWS_MS: none on a first visit (nothing seen yet,
// nothing is news)
export function newMoveIds(lastMoves: SeenMoves, seen: SeenMoves | null, now = Date.now()): Set<string> {
  if (!seen) return new Set();
  return new Set(
    Object.entries(lastMoves)
      .filter(([id, at]) => at > (seen[id] ?? 0) && now - at <= NEWS_MS)
      .map(([id]) => id)
  );
}
