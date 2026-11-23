import { useCallback, useEffect, useState } from 'react';
import { savedSeenMoves, SEEN_MOVES_KEY, type SeenMoves } from '../lib/seenMoves';
import { reportSeenMoves } from '../lib/push';

// The last move the visitor has seen on the Partite tab, by Lichess id: the time of each game's last
// move when the tab was open. The dot on the tab works as the cronaca's: it lights at every move made
// while the visitor is elsewhere, and goes off once the tab is opened. Kept in the browser, so a
// reload does not bring the dot back; only the games of the season are kept, so the list stays short.
// null on a first visit (or when the browser keeps no data): nothing is news then. With the
// notifications on, what was seen goes to the subscription too, so a move already seen on the tab is
// not notified afterwards (lib/push.ts reportSeenMoves).
export type { SeenMoves };

export function useSeenMoves(): { seenMoves: SeenMoves | null; markMovesSeen: (moves: SeenMoves) => void } {
  const [seenMoves, setSeenMoves] = useState<SeenMoves | null>(savedSeenMoves);
  useEffect(() => {
    if (seenMoves) reportSeenMoves(seenMoves).catch(() => {});
  }, [seenMoves]);
  // moves: the last move of every game of the season; the games no longer there are dropped
  const markMovesSeen = useCallback((moves: SeenMoves) => {
    setSeenMoves((prev) => {
      const next: SeenMoves = {};
      Object.entries(moves).forEach(([id, at]) => {
        next[id] = Math.max(at, prev?.[id] ?? 0);
      });
      if (prev && Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([id, at]) => prev[id] === at)) return prev;
      try {
        localStorage.setItem(SEEN_MOVES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return { seenMoves, markMovesSeen };
}
