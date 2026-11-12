import { useCallback, useState } from 'react';

const SEEN_LIVE_KEY = 'scacchi-partite-mosse-viste';
const DAY = 24 * 60 * 60 * 1000;

// The last move the visitor has seen on the Partite tab, by Lichess id: the time of the game's last
// move when the tab was open. The dot on the tab works as the cronaca's: it lights at every move
// of a live game not seen yet, and goes off once the tab is opened. Kept in the browser, so a
// reload does not bring the dot back; moves older than a day are dropped, so the list stays short.
// Nothing when the browser keeps no data.
export type SeenMoves = Record<string, number>;

export function useSeenLive(): { seenMoves: SeenMoves; markMovesSeen: (moves: SeenMoves) => void } {
  const [seenMoves, setSeenMoves] = useState<SeenMoves>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_LIVE_KEY) ?? '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  });
  const markMovesSeen = useCallback((moves: SeenMoves) => {
    setSeenMoves((prev) => {
      if (Object.entries(moves).every(([id, at]) => (prev[id] ?? 0) >= at)) return prev;
      const now = Date.now();
      const next: SeenMoves = {};
      Object.entries({ ...prev, ...moves }).forEach(([id, at]) => {
        if (typeof at === 'number' && now - at < DAY) next[id] = Math.max(at, prev[id] ?? 0);
      });
      try {
        localStorage.setItem(SEEN_LIVE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return { seenMoves, markMovesSeen };
}
