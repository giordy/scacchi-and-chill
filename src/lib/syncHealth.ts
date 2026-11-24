// Whether the automatic results sync (GitHub Action "Sincronizza risultati", scripts/sync-results.mjs)
// still runs. Each run leaves its time in the private document tournaments/<id>/private/syncStatus
// (`at`, or `errorAt` and `error` for a run that did not go through). When the outside cron stops (its
// GitHub token expired) or a secret breaks, nothing else would say so: the standings just stop moving.

// The outside cron starts a run every 10 minutes; GitHub's own hourly schedule is a slow fallback
export const STALE_AFTER_MS = 60 * 60 * 1000;

export interface SyncStatus {
  at?: string; // last run that went through
  errorAt?: string; // last run that did not
  error?: string;
}

export type SyncHealth =
  | { kind: 'unknown' } // no run recorded yet (not set up, or before the first run)
  | { kind: 'ok'; at: number }
  | { kind: 'stale'; at?: number; error?: string }; // no run through for a while; the last error, if newer

const time = (iso?: string): number | undefined => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : undefined;
};

// A single run that fails (Lichess busy for a moment) is no alarm: the sync is stale only when no run
// went through for STALE_AFTER_MS
export function syncHealth(status: SyncStatus | null | undefined, now: number): SyncHealth {
  const at = time(status?.at);
  const errorAt = time(status?.errorAt);
  if (at === undefined && errorAt === undefined) return { kind: 'unknown' };
  if (at !== undefined && now - at < STALE_AFTER_MS) return { kind: 'ok', at };
  const error = errorAt !== undefined && (at === undefined || errorAt > at) && status?.error ? status.error : undefined;
  return { kind: 'stale', ...(at !== undefined ? { at } : {}), ...(error ? { error } : {}) };
}
