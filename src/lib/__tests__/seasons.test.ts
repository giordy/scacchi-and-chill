import { describe, expect, it } from 'vitest';
import { buildSeasonArchive, seasonId, sortSeasons, validateNewSeasonName, withChampion } from '../seasons';
import { HistoryGame, LichessExportGame, Player, SeasonArchive, TournamentMeta } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
];
const meta: TournamentMeta = { title: 'Scacchi & Chill', season: 'Stagione 2 - Capablanca', description: '', masterName: 'Capablanca' };
const game = (id: string): HistoryGame => ({ round: '1', white: 'anna', black: 'bruno', url: `https://lichess.org/${id}` });
const st = (id: string, status: string, winner?: 'white' | 'black'): LichessExportGame => ({ id, status, winner });

describe('seasonId', () => {
  it('makes a stable slug', () => {
    expect(seasonId('Stagione 2 - Capablanca')).toBe('stagione-2-capablanca');
    expect(seasonId('Édition ñ 3!')).toBe('edition-n-3');
    expect(seasonId('???')).toBe('stagione');
  });
});

describe('buildSeasonArchive', () => {
  const now = new Date('2026-12-31T10:00:00Z');

  it('captures standings, champion and number of games', () => {
    const a = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'mate', 'black') }, now);
    expect(a.id).toBe('stagione-2-capablanca');
    expect(a.champion).toEqual({ handle: 'bruno', name: 'Bruno', points: 1 });
    expect(a.gamesPlayed).toBe(1);
    expect(a.standings.map((s) => s.handle)).toEqual(['bruno', 'anna']);
    expect(a.masterName).toBe('Capablanca');
    expect(a.archivedAt).toBe(now.toISOString());
    expect(a).not.toHaveProperty('imageUrl');
  });

  it('has no champion when nothing has been scored', () => {
    const a = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'started') }, now);
    expect(a.champion).toBeUndefined();
    expect(a.gamesPlayed).toBe(0);
  });
});

describe('withChampion', () => {
  const archive = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'mate', 'white') }, new Date('2026-12-31T10:00:00Z'));

  it('adds the champion once', () => {
    const once = withChampion([], archive);
    expect(once).toEqual([{ season: meta.season, name: 'Anna', handle: 'anna', year: '2026' }]);
    expect(withChampion(once, archive)).toBe(once);
  });

  it('keeps existing winners and handles undefined', () => {
    const prev = [{ season: 'Stagione 1', name: 'Fabio', handle: 'fsgach' }];
    expect(withChampion(prev, archive)).toHaveLength(2);
    expect(withChampion(undefined, archive)).toHaveLength(1);
  });
});

describe('sortSeasons', () => {
  it('orders newest first without mutating the input', () => {
    const a = { id: 'a', archivedAt: '2026-01-01T00:00:00Z' } as SeasonArchive;
    const b = { id: 'b', archivedAt: '2027-01-01T00:00:00Z' } as SeasonArchive;
    const input = [a, b];
    expect(sortSeasons(input).map((s) => s.id)).toEqual(['b', 'a']);
    expect(input[0]).toBe(a);
  });
});

describe('validateNewSeasonName', () => {
  const archived = [{ id: 'stagione-1' }];
  it('accepts a fresh name', () => {
    expect(validateNewSeasonName('Stagione 3 - Fischer', 'Stagione 2', archived)).toBeNull();
  });
  it('rejects empty names, the current season and archived seasons', () => {
    expect(validateNewSeasonName('  ', 'Stagione 2', archived)).toMatch(/Inserisci/);
    expect(validateNewSeasonName('stagione 2', 'Stagione 2', archived)).toMatch(/corrente/);
    expect(validateNewSeasonName('Stagione 1', 'Stagione 2', archived)).toMatch(/archiviata/);
  });
});
