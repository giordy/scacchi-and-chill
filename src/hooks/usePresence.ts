import { useEffect, useMemo, useState } from 'react';
import { fetchSeenAt, PresenceInfo } from '../lib/presence';

// Same pace as the live results
const REFRESH_MS = 5 * 60 * 1000;

// Public page only: when each player was last on Lichess, by lower-case handle. One call for
// all the players, again every 5 minutes while the page stays open and visible. Empty when
// Lichess does not answer, so no dot is shown rather than a misleading grey one.
export function usePresence(handles: string[], enabled: boolean): PresenceInfo {
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const key = Array.from(new Set(handles.map((h) => h.toLowerCase()).filter(Boolean))).sort().join(',');

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchSeenAt(key.split(','))
        .then((map) => {
          if (cancelled) return;
          setSeenAt(map);
          setCheckedAt(Date.now());
        })
        .catch((e) => console.warn('Lettura presenza da Lichess non riuscita:', e));
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
  }, [enabled, key]);

  return useMemo(() => ({ seenAt, now: checkedAt }), [seenAt, checkedAt]);
}
