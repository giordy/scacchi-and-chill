import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STALE_AFTER_MS, syncHealth } from '../syncHealth';
import { AutoSyncAlert, AutoSyncNote } from '../../components/AutoSyncStatus';
// @ts-expect-error a Node script without types
import { failureOf } from '../../../scripts/sync-results.mjs';

const NOW = Date.UTC(2026, 10, 24, 18);
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60e3;

describe('whether the automatic sync still runs', () => {
  it('knows nothing before the first run', () => {
    expect(syncHealth(null, NOW)).toEqual({ kind: 'unknown' });
    expect(syncHealth({}, NOW)).toEqual({ kind: 'unknown' });
    expect(syncHealth({ at: 'not a date' }, NOW)).toEqual({ kind: 'unknown' });
  });

  it('is fine with a run through in the last hour, also when a later one failed', () => {
    expect(syncHealth({ at: iso(NOW - 8 * MIN) }, NOW)).toEqual({ kind: 'ok', at: NOW - 8 * MIN });
    expect(syncHealth({ at: iso(NOW - 20 * MIN), errorAt: iso(NOW - 10 * MIN), error: 'Lichess: HTTP 503' }, NOW).kind).toBe('ok');
  });

  it('is stale after an hour without a run through, with the last error when newer', () => {
    const at = NOW - STALE_AFTER_MS;
    expect(syncHealth({ at: iso(at) }, NOW)).toEqual({ kind: 'stale', at });
    expect(syncHealth({ at: iso(at), errorAt: iso(NOW - 5 * MIN), error: 'Token Google: HTTP 400' }, NOW)).toEqual({ kind: 'stale', at, error: 'Token Google: HTTP 400' });
    // An error before the last run through is over
    expect(syncHealth({ at: iso(at), errorAt: iso(at - MIN), error: 'old' }, NOW)).toEqual({ kind: 'stale', at });
    // Never through, only errors
    expect(syncHealth({ errorAt: iso(NOW - MIN), error: 'Lettura partite: HTTP 403' }, NOW)).toEqual({ kind: 'stale', error: 'Lettura partite: HTTP 403' });
  });

  it('records a failed run briefly', () => {
    const date = new Date(NOW);
    expect(failureOf(new Error('Lichess: HTTP 429'), date)).toEqual({ errorAt: iso(NOW), error: 'Lichess: HTTP 429' });
    expect(failureOf(new Error('x'.repeat(400)), date).error).toHaveLength(300);
  });

  it('says it in the sync bar, and warns only when it stopped', () => {
    const note = (h: Parameters<typeof syncHealth>[0]) => renderToStaticMarkup(React.createElement(AutoSyncNote, { health: syncHealth(h, NOW), now: NOW }));
    const alert = (h: Parameters<typeof syncHealth>[0]) => renderToStaticMarkup(React.createElement(AutoSyncAlert, { health: syncHealth(h, NOW), now: NOW }));
    expect(note({ at: iso(NOW - 8 * MIN) })).toContain('Automatica: 8 minuti fa');
    expect(note(null)).toContain('nessun giro registrato');
    expect(alert({ at: iso(NOW - 8 * MIN) })).toBe('');
    expect(alert(null)).toBe('');
    const stale = alert({ at: iso(NOW - 3 * 60 * MIN), errorAt: iso(NOW - MIN), error: 'Lichess: HTTP 500' });
    expect(stale).toContain("l&#x27;ultimo giro riuscito è di 3 ore fa");
    expect(stale).toContain('Lichess: HTTP 500');
    expect(note({ at: iso(NOW - 3 * 60 * MIN) })).toBe('');
  });
});
