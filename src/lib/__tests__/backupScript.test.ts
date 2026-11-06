import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JavaScript module of the nightly backup workflow
import { fields, sorted, toBackup } from '../../../scripts/backup.mjs';
import { parseBackup } from '../backup';

describe('nightly backup script', () => {
  it('turns Firestore REST values into plain JSON', () => {
    expect(
      fields({
        s: { stringValue: 'x' },
        i: { integerValue: '42' },
        b: { booleanValue: true },
        n: { nullValue: null },
        a: { arrayValue: { values: [{ stringValue: 'y' }] } },
        m: { mapValue: { fields: { k: { doubleValue: 1.5 } } } },
        e: { arrayValue: {} },
      })
    ).toEqual({ s: 'x', i: 42, b: true, n: null, a: ['y'], m: { k: 1.5 }, e: [] });
  });

  it('writes a stable file the restore accepts, with only link and status of ongoing games', () => {
    const doc = { title: 'Scacchi & Chill', season: 'Stagione 2', updatedAt: 'now', players: [{ handle: 'anna', name: 'Anna' }], schedule: [] };
    const games = [
      { id: 'r2', round: '2', white: 'anna', black: 'bruno', url: 'u2', updatedAt: 't', lichess: { id: 'b', status: 'started', moves: 'e4 e5' } },
      { id: 'r10', round: '10', white: 'anna', black: 'bruno', url: 'u10', lichess: { id: 'c', status: 'mate', moves: 'e4' } },
      { id: 'r1', round: '1', white: 'anna', black: 'bruno', url: 'u1', syncedAt: 't' },
    ];
    const backup = toBackup(doc, games, []);
    expect(backup.tournament).toEqual({ season: 'Stagione 2', title: 'Scacchi & Chill' });
    expect(backup.history.map((g: { round: string }) => g.round)).toEqual(['1', '2', '10']);
    expect(backup.history[1].lichess).toEqual({ id: 'b', status: 'started' });
    expect(backup.history[2].lichess.moves).toBe('e4');
    expect(JSON.stringify(toBackup(doc, [...games].reverse(), []))).toBe(JSON.stringify(backup));
    expect(parseBackup(JSON.stringify(backup)).summary).toMatchObject({ automatic: true, games: 3, players: 1 });
  });

  it('sorts keys at every level', () => {
    expect(JSON.stringify(sorted({ b: 1, a: { d: 1, c: [{ f: 1, e: 2 }] } }))).toBe('{"a":{"c":[{"e":2,"f":1}],"d":1},"b":1}');
  });

  it('adds the uploaded photos only when there are some', () => {
    const doc = { title: 'T', season: 'S', players: [], schedule: [] };
    expect(toBackup(doc, [], [])).not.toHaveProperty('media');
    const withPhoto = toBackup(doc, [], [], [{ id: 'stagione-3', dataUrl: 'data:image/jpeg;base64,AAAA', updatedAt: 'x' }]);
    expect(withPhoto.media).toEqual({ 'stagione-3': 'data:image/jpeg;base64,AAAA' });
    expect(parseBackup(JSON.stringify({ ...withPhoto, players: [{ handle: 'a', name: 'A' }] })).data.media).toEqual(withPhoto.media);
  });
});

