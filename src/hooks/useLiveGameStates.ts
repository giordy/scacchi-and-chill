import { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from '../lib/utils';
import { fetchGameStates } from '../lib/lichess';
import { gameProgress, mergeGameStates } from '../lib/progress';
import { useVisiblePolling } from './useVisiblePolling';

// Public page only: reads from Lichess the games that Firestore does not have as finished yet,
// so visitors see fresh results even when the organizer has not synced. Nothing is written:
// saving to Firestore stays the organizer's sync (only the organizer may write there).
export function useLiveGameStates(
  history: HistoryGame[],
  storedStates: Record<string, LichessExportGame>,
  enabled: boolean,
  interval?: number // how often to ask Lichess again (see useVisiblePolling)
) {
  const [live, setLive] = useState<Record<string, LichessExportGame>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Stable key: refetch only when the set of open games changes, not on every snapshot
  const openIds = useMemo(() => {
    const ids = history
      .map((g) => extractGameId(g.url))
      .filter((id): id is string => Boolean(id) && gameProgress(storedStates[id as string]) !== 'finished');
    return Array.from(new Set(ids)).sort().join(',');
  }, [history, storedStates]);

  useVisiblePolling(
    () =>
      fetchGameStates(openIds.split(','))
        .then((states) => {
          if (alive.current) {
            setLive((prev) => ({ ...prev, ...states }));
            setUpdatedAt(new Date());
          }
          return true;
        })
        .catch((e) => {
          console.warn('Lettura risultati da Lichess non riuscita:', e);
          return false;
        }),
    openIds,
    enabled,
    interval
  );

  const gameStates = useMemo(() => mergeGameStates(storedStates, live), [storedStates, live]);
  return { gameStates, updatedAt };
}
