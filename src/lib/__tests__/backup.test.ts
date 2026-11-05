import { describe, expect, it } from 'vitest';
import { parseBackup } from '../backup';

const ok = {
  version: '2.0',
  source: 'backup automatico',
  tournament: { title: 'Scacchi & Chill', season: 'Stagione 2', description: '' },
  players: [{ handle: 'anna', name: 'Anna' }],
  schedule: [{ round: '1', white: 'anna', black: 'bruno' }],
  history: [{ round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/abcdefgh' }],
  seasons: [],
};

describe('parseBackup', () => {
  it('reads a nightly backup', () => {
    const { summary } = parseBackup(JSON.stringify(ok));
    expect(summary).toMatchObject({ season: 'Stagione 2', automatic: true, players: 1, scheduled: 1, games: 1, privateData: false });
  });
  it('reads a manual export with the private data', () => {
    const { summary } = parseBackup(JSON.stringify({ ...ok, source: undefined, exportedAt: '2026-11-05T10:00:00Z', anecdotes: {} }));
    expect(summary).toMatchObject({ automatic: false, savedAt: '2026-11-05T10:00:00Z', privateData: true });
  });
  it('refuses files that are not a backup', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/copia/);
    expect(() => parseBackup(JSON.stringify({ ...ok, players: [] }))).toThrow(/giocatori/);
    expect(() => parseBackup(JSON.stringify({ ...ok, history: [{ round: '1' }] }))).toThrow(/partite/);
    expect(() => parseBackup(JSON.stringify({ ...ok, tournament: {} }))).toThrow(/stagione/);
  });
});
