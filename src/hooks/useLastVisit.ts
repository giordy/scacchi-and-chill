import { useCallback, useState } from 'react';

const LAST_VISIT_KEY = 'scacchi-cronaca-visita';

// When the visitor last opened the cronaca, read once when the page opens: what happened since is
// news (the dot on the Partite tab, the line in the hero, the marks in the cronaca). Opening the
// cronaca saves the time for the next visit and clears the dot and the line; the marks stay for
// this visit. Nothing when the browser keeps no data, or on a first visit.
export function useLastVisit(): { lastVisit: number | undefined; seen: boolean; markSeen: () => void } {
  const [lastVisit] = useState<number | undefined>(() => {
    try {
      const n = Number(localStorage.getItem(LAST_VISIT_KEY));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
      return undefined;
    }
  });
  const [seen, setSeen] = useState(false);
  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);
  return { lastVisit, seen, markSeen };
}
