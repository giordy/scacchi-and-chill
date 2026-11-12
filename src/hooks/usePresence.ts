import { useEffect, useRef, useState } from 'react';
import { fetchUsers } from '../lib/lichess';
import { PresenceInfo, presenceFrom } from '../lib/presence';
import { useVisiblePolling } from './useVisiblePolling';

// Public page only: from the players' Lichess profiles, when each was last on Lichess and their
// flair. One call for all the players, again at every interval while the page stays open and
// visible. Empty when Lichess does not answer, so no dot is shown rather than a misleading grey one.
export function usePresence(handles: string[], enabled: boolean, interval?: number): PresenceInfo {
  const [state, setState] = useState<PresenceInfo>(() => ({ seenAt: {}, flair: {}, now: Date.now() }));
  const key = Array.from(new Set(handles.map((h) => h.toLowerCase()).filter(Boolean))).sort().join(',');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useVisiblePolling(
    () =>
      fetchUsers(key.split(','))
        .then((users) => {
          if (alive.current) setState({ ...presenceFrom(users), now: Date.now() });
          return true;
        })
        .catch((e) => {
          console.warn('Lettura profili da Lichess non riuscita:', e);
          return false;
        }),
    key,
    enabled,
    interval
  );

  return state;
}
