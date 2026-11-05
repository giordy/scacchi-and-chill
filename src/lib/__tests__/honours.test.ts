import { describe, expect, it } from 'vitest';
import { medalsOf, podiumFromPicks, podiumFromStandings, reigningChampion } from '../honours';
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
  it('gives no medal without points', () => {
    expect(podiumFromStandings([row('a', 1, 0), row('b', 0, 0), row('c', 0, 0)])).toEqual([]);
  });
});

describe('podiumFromPicks', () => {
  it('drops the third place after a tie for second', () => {
    expect(podiumFromPicks(['b', 'c'], ['d'])).toEqual([
      { handle: 'b', place: 2 },
      { handle: 'c', place: 2 },
    ]);
    expect(podiumFromPicks(['b', ''], ['d'])).toEqual([
      { handle: 'b', place: 2 },
      { handle: 'd', place: 3 },
    ]);
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
  it('is the champion of the latest season', () => {
    expect(reigningChampion(winners)?.handle).toBe('giords');
    expect(reigningChampion([])).toBeUndefined();
  });
});
