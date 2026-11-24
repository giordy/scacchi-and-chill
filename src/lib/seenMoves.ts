import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';

// The time of the last move of every game of the season, by Lichess id. What the visitor has seen
// is kept in the same form (hooks/useSeenMoves): a game has news when its last move is later.
export type SeenMoves = Record<string, number>;

// Where the browser keeps what the visitor has seen (hooks/useSeenMoves)
export const SEEN_MOVES_KEY = 'scacchi-partite-mosse-viste';

export function savedSeenMoves(): SeenMoves | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SEEN_MOVES_KEY) ?? 'null');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function lastMovesOf(history: HistoryGame[], gameStates: Record<string, LichessExportGame>): SeenMoves {
  const moves: SeenMoves = {};
  history.forEach((g) => {
    // A game decided by the organizer (lib/decisions.ts) has no news, also when moved on Lichess
    if (g.decision) return;
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
