import { describe, expect, it } from 'vitest';
import { medalsOf, podiumError, shortSeason, podiumFromStandings, reigningChampion, reigningChampions } from '../honours';
import { SeasonWinner } from '../../types';

const row = (handle: string, points: number, sb: number) => ({ handle, name: handle.toUpperCase(), points, sb });

describe('podiumFromStandings', () => {
  it('gives 2nd and 3rd below the champion', () => {
    expect(podiumFromStandings([row('a', 5, 9), row('b', 4, 7), row('c', 3, 5), row('d', 2, 1)])).toEqual([
      { handle: 'b', name: 'B', place: 2 },
      { handle: 'c', name: 'C', place: 3 },
    ]);
  });
  it('shares a place on equal points and tiebreak, with no third after two seconds', () => {
    expect(podiumFromStandings([row('a', 5, 9), row('b', 4, 7), row('c', 4, 7), row('d', 3, 1)]).map((p) => [p.handle, p.place])).toEqual([
      ['b', 2],
      ['c', 2],
    ]);
  });
  it('separates equal points and tiebreak by wins, as the standings do', () => {
    const withWins = (handle: string, points: number, sb: number, won: number) => ({ ...row(handle, points, sb), won });
    expect(
      podiumFromStandings([withWins('a', 5, 9, 5), withWins('b', 4, 7, 4), withWins('c', 4, 7, 3), withWins('d', 3, 1, 3)]).map((p) => [p.handle, p.place])
    ).toEqual([
      ['b', 2],
      ['c', 3],
    ]);
  });
  it('shares the place when wins are equal too, and gives the next place no medal', () => {
    const withWins = (handle: string, points: number, sb: number, won: number) => ({ ...row(handle, points, sb), won });
    expect(
      podiumFromStandings([withWins('a', 5, 9, 5), withWins('b', 4, 7, 4), withWins('c', 4, 7, 4), withWins('d', 3, 1, 3)]).map((p) => [p.handle, p.place])
    ).toEqual([
      ['b', 2],
      ['c', 2],
    ]);
  });
  it('makes a co-champion first on a full tie at the top', () => {
    expect(podiumFromStandings([row('a', 5, 9), row('b', 5, 9), row('c', 3, 1)]).map((p) => [p.handle, p.place])).toEqual([
      ['b', 1],
      ['c', 3],
    ]);
  });
  it('gives no medal without points', () => {
    expect(podiumFromStandings([row('a', 1, 0), row('b', 0, 0), row('c', 0, 0)])).toEqual([]);
  });
});

describe('podiumError', () => {
  const rows = (...places: number[]) => places.map((place, i) => ({ handle: `p${i}`, place: place as 1 | 2 | 3 }));
  it('accepts every shared ranking', () => {
    [[1, 2, 3], [1, 2, 2], [1, 1, 3], [1, 1, 1], [1, 2, 2, 2], [1, 2, 3, 3], [1], [1, 2]].forEach((p) =>
      expect(podiumError(rows(...p))).toBeNull()
    );
  });
  it('rejects places that skip or do not skip as they should', () => {
    expect(podiumError(rows(1, 2, 2, 3))).toMatch(/3° posto/);
    expect(podiumError(rows(1, 1, 2))).toMatch(/2° posto/);
    expect(podiumError(rows(2, 3))).toMatch(/primo/);
    expect(podiumError([{ handle: 'a', place: 1 }, { handle: 'A', place: 2 }])).toMatch(/due volte/);
  });
});

describe('medals and reigning champion', () => {
  const winners: SeasonWinner[] = [
    {
      season: 'Scacchi & Chill',
      handle: 'fsgach',
      name: 'Fabio',
      podium: [
        { handle: 'battimat', name: 'Matteo', place: 2 },
        { handle: 'giords', name: 'Giordano', place: 2 },
      ],
    },
    { season: 'Stagione 2', handle: 'giords', name: 'Giordano' },
  ];
  it('collects every podium of a player', () => {
    expect(medalsOf('GIORDS', winners)).toEqual([
      { season: 'Scacchi & Chill', place: 2 },
      { season: 'Stagione 2', place: 1 },
    ]);
    expect(medalsOf('nessuno', winners)).toEqual([]);
  });
  it('crowns every co-champion of the latest season', () => {
    const tied: SeasonWinner[] = [{ season: 'S', handle: 'Anna', name: 'Anna', podium: [{ handle: 'bruno', name: 'Bruno', place: 1 }] }];
    expect(reigningChampions(tied)).toEqual({ season: 'S', handles: ['anna', 'bruno'] });
  });
  it('is the champion of the latest season', () => {
    expect(reigningChampion(winners)?.handle).toBe('giords');
    expect(reigningChampion([])).toBeUndefined();
  });
});

describe('shortSeason', () => {
  it('drops the tournament title from the season name', () => {
    expect(shortSeason('Scacchi & Chill - Stagione 1', 'Scacchi & Chill')).toBe('Stagione 1');
    expect(shortSeason('Stagione 2 - Capablanca', 'Scacchi & Chill')).toBe('Stagione 2 - Capablanca');
    expect(shortSeason('Scacchi & Chill', 'Scacchi & Chill')).toBe('Scacchi & Chill');
    expect(shortSeason('Stagione 1')).toBe('Stagione 1');
  });
});
