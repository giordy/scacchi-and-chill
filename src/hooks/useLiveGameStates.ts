import { useEffect, useMemo, useState } from 'react';
import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from '../lib/utils';
import { fetchGameStates } from '../lib/lichess';
import { gameProgress, mergeGameStates } from '../lib/progress';

// How often the public page asks Lichess again while it stays open and visible
const REFRESH_MS = 5 * 60 * 1000;

// Public page only: reads from Lichess the games that Firestore does not have as finished yet,
// so visitors see fresh results even when the organizer has not synced. Nothing is written:
// saving to Firestore stays the organizer's sync (only the organizer may write there).
export function useLiveGameStates(
  history: HistoryGame[],
  storedStates: Record<string, LichessExportGame>,
  enabled: boolean
) {
  const [live, setLive] = useState<Record<string, LichessExportGame>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Stable key: refetch only when the set of open games changes, not on every snapshot
  const openIds = useMemo(() => {
    const ids = history
      .map((g) => extractGameId(g.url))
      .filter((id): id is string => Boolean(id) && gameProgress(storedStates[id as string]) !== 'finished');
    return Array.from(new Set(ids)).sort().join(',');
  }, [history, storedStates]);

  useEffect(() => {
    if (!enabled || !openIds) return;
    let cancelled = false;
    const ids = openIds.split(',');

    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchGameStates(ids)
        .then((states) => {
          if (cancelled) return;
          setLive((prev) => ({ ...prev, ...states }));
          setUpdatedAt(new Date());
        })
        .catch((e) => console.warn('Lettura risultati da Lichess non riuscita:', e));
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, openIds]);

  const gameStates = useMemo(() => mergeGameStates(storedStates, live), [storedStates, live]);
  return { gameStates, updatedAt };
}
