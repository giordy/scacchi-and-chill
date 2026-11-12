import { useEffect, useRef } from 'react';

// How often a page asks Lichess again while it stays open and visible, unless told otherwise
export const REFRESH_MS = 5 * 60 * 1000;
// The public page: the games are correspondence, so every 10 minutes is plenty; while a game is
// live (see lib/live.ts) every 90 seconds, so its dot comes and goes in time
export const PUBLIC_REFRESH_MS = 10 * 60 * 1000;
export const LIVE_REFRESH_MS = 90 * 1000;

// Whether to ask again now: never while a request is running or the tab is hidden; otherwise when
// forced (the first load) or when the last answer is as old as the interval (the 5 s slack lets the
// interval timer, which may fire a little early, through)
export function shouldPoll({ force, busy, hidden, now, last, interval = REFRESH_MS }: { force: boolean; busy: boolean; hidden: boolean; now: number; last: number; interval?: number }) {
  if (busy || hidden) return false;
  return force || now - last >= interval - 5000;
}

// Runs load now, then every interval while the page is visible. A hidden tab asks nothing; coming
// back to it asks again only when the last answer is older than the interval, so switching tabs back
// and forth does not call Lichess each time. A new interval (a game turning live, or no longer)
// takes effect at once, without asking again before its time. load resolves to true when the
// answer arrived.
export function useVisiblePolling(load: () => Promise<boolean>, key: string, enabled: boolean, interval = REFRESH_MS) {
  const loadRef = useRef(load);
  loadRef.current = load;
  // When the last answer arrived, and for what: kept across a change of interval, reset with the key
  const lastRef = useRef({ key: '', at: 0 });
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !key) return;
    const run = (force = false) => {
      if (!shouldPoll({ force, busy: busyRef.current, hidden: document.visibilityState === 'hidden', now: Date.now(), last: lastRef.current.at, interval })) return;
      busyRef.current = true;
      loadRef.current()
        .then((ok) => {
          if (ok) lastRef.current = { key, at: Date.now() };
        })
        .finally(() => {
          busyRef.current = false;
        });
    };
    run(lastRef.current.key !== key);
    const timer = window.setInterval(() => run(), Math.min(interval, 60 * 1000));
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, key, interval]);
}
