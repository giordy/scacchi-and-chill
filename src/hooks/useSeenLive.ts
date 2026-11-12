import { useCallback, useState } from 'react';

const SEEN_LIVE_KEY = 'scacchi-partite-live-viste';

// The live games the visitor has already seen on the Partite tab, by Lichess id: the dot on the tab
// works as the cronaca's, it goes off once the tab is opened and comes back only for a game that
// turns live and was not seen yet. Kept in the browser, so a reload does not bring the dot back;
// only the games live now are kept, so the list never grows. Nothing when the browser keeps no data.
export function useSeenLive(): { seenLive: Set<string>; markLiveSeen: (ids: Set<string>) => void } {
  const [seenLive, setSeenLive] = useState<Set<string>>(() => {
    try {
      const list = JSON.parse(localStorage.getItem(SEEN_LIVE_KEY) ?? '[]');
      return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  });
  const markLiveSeen = useCallback((ids: Set<string>) => {
    setSeenLive((prev) => {
      if ([...ids].every((id) => prev.has(id)) && prev.size === ids.size) return prev;
      try {
        localStorage.setItem(SEEN_LIVE_KEY, JSON.stringify([...ids]));
      } catch {
        // ignore
      }
      return new Set(ids);
    });
  }, []);
  return { seenLive, markLiveSeen };
}
