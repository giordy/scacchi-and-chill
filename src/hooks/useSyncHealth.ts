import { useEffect, useState } from 'react';
import { subscribeToSyncStatus } from '../firebaseService';
import { SyncHealth, SyncStatus, syncHealth } from '../lib/syncHealth';

const MINUTE = 60 * 1000;

// Whether the automatic results sync still runs (lib/syncHealth.ts), kept up to date while the
// organizer area is open. null until the private document is read.
export function useSyncHealth(enabled: boolean): SyncHealth | null {
  const [status, setStatus] = useState<SyncStatus | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    return subscribeToSyncStatus(setStatus);
  }, [enabled]);
  // "8 minuti fa" moves on, and a sync that stops turns stale without a new snapshot
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(t);
  }, [enabled]);
  return status === undefined ? null : syncHealth(status, now);
}
