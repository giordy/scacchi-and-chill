import { describe, expect, it, vi } from 'vitest';
import { parseBackup, restoreBackup, RestoreIO } from '../backup';
import type { SeasonArchive } from '../../types';

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

describe('restoreBackup', () => {
  const photo = 'data:image/jpeg;base64,AAAA';
  const manual = {
    ...ok,
    source: undefined,
    exportedAt: '2026-11-05T10:00:00Z',
    tournament: { ...ok.tournament, withdrawals: [{ handle: 'bruno', round: '2' }] },
    seasons: [
      { id: 'stagione-1', season: 'Stagione 1', standings: [] },
      { id: 'stagione-0', season: 'Stagione 0', standings: [] },
    ],
    media: { 'stagione-2': photo, broken: 'data:text/html;base64,AAAA' },
    anecdotes: { anna: 'Apre sempre e4' },
    settings: { days: 3, expiry: 2, rated: true, rules: {} },
    templates: { launch: 'Si parte!' },
    statusPhrases: null,
  };

  // Every step is recorded in one list, so the tests can check the order
  function fakeIO(fail: { exportCurrent?: boolean; games?: boolean } = {}) {
    const steps: string[] = [];
    const io = {
      exportCurrent: vi.fn(async () => {
        steps.push('export');
        if (fail.exportCurrent) throw new Error('download bloccato');
      }),
      replaceAllGames: vi.fn(async () => {
        steps.push('games');
        if (fail.games) throw new Error('rete assente');
      }),
      setHistory: vi.fn(() => steps.push('history')),
      onUpdatePlayers: vi.fn(() => steps.push('players')),
      onUpdateSchedule: vi.fn(() => steps.push('schedule')),
      onUpdateTournamentMeta: vi.fn(() => steps.push('meta')),
      saveSeasonArchive: vi.fn(async (_season: SeasonArchive) => {
        steps.push('season');
      }),
      saveMediaImage: vi.fn(async (_id: string, _dataUrl: string) => {
        steps.push('media');
      }),
      replaceOrganizerData: vi.fn(() => steps.push('organizer')),
    } satisfies RestoreIO;
    return { io, steps };
  }

  it('downloads the current data first, then replaces everything with the file', async () => {
    const { data, summary } = parseBackup(JSON.stringify(manual));
    const { io, steps } = fakeIO();
    await restoreBackup(data, summary, 'token-attuale', io);
    expect(steps).toEqual(['export', 'games', 'history', 'players', 'schedule', 'meta', 'season', 'season', 'media', 'organizer']);
    expect(io.replaceAllGames).toHaveBeenCalledWith(data.history);
    expect(io.setHistory).toHaveBeenCalledWith(data.history);
    expect(io.onUpdatePlayers).toHaveBeenCalledWith(manual.players);
    expect(io.onUpdateSchedule).toHaveBeenCalledWith(manual.schedule);
    expect(io.onUpdateTournamentMeta).toHaveBeenCalledWith(manual.tournament);
    expect(io.saveSeasonArchive.mock.calls.map(([s]) => s.id)).toEqual(['stagione-1', 'stagione-0']);
  });

  it('saves only the photos that are small images', async () => {
    const { data, summary } = parseBackup(JSON.stringify(manual));
    const { io } = fakeIO();
    await restoreBackup(data, summary, '', io);
    expect(io.saveMediaImage.mock.calls).toEqual([['stagione-2', photo]]);
  });

  it('restores the private data, keeping the Lichess token of now (never in a file)', async () => {
    const { data, summary } = parseBackup(JSON.stringify(manual));
    const { io } = fakeIO();
    await restoreBackup(data, summary, 'token-attuale', io);
    expect(io.replaceOrganizerData).toHaveBeenCalledWith({
      anecdotes: manual.anecdotes,
      settings: { ...manual.settings, token: 'token-attuale' },
      templates: manual.templates,
      statusPhrases: null,
    });
  });

  it('leaves the private data alone with a nightly backup, which has none', async () => {
    const { data, summary } = parseBackup(JSON.stringify(ok));
    const { io } = fakeIO();
    await restoreBackup(data, summary, 'token-attuale', io);
    expect(io.replaceOrganizerData).not.toHaveBeenCalled();
    expect(io.saveSeasonArchive).not.toHaveBeenCalled();
    expect(io.saveMediaImage).not.toHaveBeenCalled();
  });

  it('clears the current withdrawals when the file has none', async () => {
    const { data, summary } = parseBackup(JSON.stringify(ok));
    const { io } = fakeIO();
    await restoreBackup(data, summary, '', io);
    expect(io.onUpdateTournamentMeta).toHaveBeenCalledWith({ ...ok.tournament, withdrawals: [] });
  });

  it('touches nothing when the copy of the current data cannot be downloaded', async () => {
    const { data, summary } = parseBackup(JSON.stringify(manual));
    const { io, steps } = fakeIO({ exportCurrent: true });
    await expect(restoreBackup(data, summary, '', io)).rejects.toThrow('download bloccato');
    expect(steps).toEqual(['export']);
  });

  it('stops at the games when they cannot be replaced: players, schedule and season stay as they are', async () => {
    const { data, summary } = parseBackup(JSON.stringify(manual));
    const { io, steps } = fakeIO({ games: true });
    await expect(restoreBackup(data, summary, '', io)).rejects.toThrow('rete assente');
    expect(steps).toEqual(['export', 'games']);
  });
});
