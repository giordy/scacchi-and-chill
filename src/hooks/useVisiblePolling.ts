import { useEffect, useRef } from 'react';

// How often the public page asks Lichess again while it stays open and visible
export const REFRESH_MS = 5 * 60 * 1000;

// Runs load now, then every 5 minutes while the page is visible. A hidden tab asks nothing; coming
// back to it asks again only when the last answer is older than 5 minutes, so switching tabs back
// and forth does not call Lichess each time. load resolves to true when the answer arrived.
export function useVisiblePolling(load: () => Promise<boolean>, key: string, enabled: boolean) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled || !key) return;
    let last = 0;
    let busy = false;
    const run = (force = false) => {
      if (busy || document.visibilityState === 'hidden') return;
      if (!force && Date.now() - last < REFRESH_MS - 5000) return;
      busy = true;
      loadRef.current()
        .then((ok) => {
          if (ok) last = Date.now();
        })
        .finally(() => {
          busy = false;
        });
    };
    run(true);
    const timer = window.setInterval(() => run(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, key]);
}
