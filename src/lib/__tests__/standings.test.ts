import { describe, expect, it } from 'vitest';
import { computeStandings, isTied, leadersOf, leaderText, podiumPlace, seasonStarted, sharedRanks } from '../standings';
import { HistoryGame, LichessExportGame, Player } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
  { name: 'Carla', handle: 'carla' },
];

const game = (white: string, black: string, id: string): HistoryGame => ({
  round: '1',
  white,
  black,
  url: `https://lichess.org/${id}`,
});
const state = (id: string, status: string, winner?: 'white' | 'black'): [string, LichessExportGame] => [
  id,
  { id, status, winner },
];
const states = (...entries: Array<[string, LichessExportGame]>) => Object.fromEntries(entries);

describe('computeStandings', () => {
  it('returns zeroed standings sorted by name when nothing was played', () => {
    const { standings } = computeStandings(players, [], {});
    expect(standings.map((s) => s.handle)).toEqual(['anna', 'bruno', 'carla']);
    expect(standings.every((s) => s.points === 0 && s.played === 0)).toBe(true);
  });

  it('scores wins, losses and draws', () => {
    const history = [game('anna', 'bruno', 'aaaaaaaa'), game('bruno', 'carla', 'bbbbbbbb')];
    const gs = states(state('aaaaaaaa', 'mate', 'white'), state('bbbbbbbb', 'draw'));
    const { standings } = computeStandings(players, history, gs);
    const by = Object.fromEntries(standings.map((s) => [s.handle, s]));
    expect(by.anna).toMatchObject({ points: 1, won: 1, played: 1 });
    expect(by.bruno).toMatchObject({ points: 0.5, lost: 1, drawn: 1, played: 2 });
    expect(by.carla).toMatchObject({ points: 0.5, drawn: 1, played: 1 });
    expect(standings[0].handle).toBe('anna');
  });

  it('ignores games that are unfinished, aborted or without a known state', () => {
    const history = [
      game('anna', 'bruno', 'aaaaaaaa'),
      game('anna', 'carla', 'bbbbbbbb'),
      game('bruno', 'carla', 'cccccccc'),
      game('carla', 'anna', 'dddddddd'),
    ];
    const gs = states(
      state('aaaaaaaa', 'started'),
      state('bbbbbbbb', 'aborted'),
      state('cccccccc', 'noStart')
    );
    const { standings } = computeStandings(players, history, gs);
    expect(standings.every((s) => s.played === 0)).toBe(true);
  });

  it('counts timeouts and resignations with a winner as wins', () => {
    const history = [game('anna', 'bruno', 'aaaaaaaa')];
    const gs = states(state('aaaaaaaa', 'outoftime', 'black'));
    const { standings } = computeStandings(players, history, gs);
    expect(standings[0]).toMatchObject({ handle: 'bruno', points: 1, won: 1 });
  });

  it('breaks ties on points with Sonneborn-Berger', () => {
    // Anna beats Carla, Bruno beats Dario: Anna and Bruno both have 1 point.
    // Carla also beats Dario so Anna's victim (Carla, 1pt) is worth more than Bruno's (Dario, 0pt).
    const four: Player[] = [...players, { name: 'Dario', handle: 'dario' }];
    const history = [
      game('anna', 'carla', 'aaaaaaaa'),
      game('bruno', 'dario', 'bbbbbbbb'),
      game('carla', 'dario', 'cccccccc'),
    ];
    const gs = states(
      state('aaaaaaaa', 'mate', 'white'),
      state('bbbbbbbb', 'mate', 'white'),
      state('cccccccc', 'mate', 'white')
    );
    const { standings } = computeStandings(four, history, gs);
    const anna = standings.find((s) => s.handle === 'anna')!;
    const bruno = standings.find((s) => s.handle === 'bruno')!;
    expect(anna.points).toBe(1);
    expect(bruno.points).toBe(1);
    expect(anna.sb).toBe(1); // beat Carla (1 point)
    expect(bruno.sb).toBe(0); // beat Dario (0 points)
    expect(standings.findIndex((s) => s.handle === 'anna')).toBeLessThan(
      standings.findIndex((s) => s.handle === 'bruno')
    );
  });

  it('gives half the opponent points to Sonneborn-Berger on a draw', () => {
    const history = [game('anna', 'bruno', 'aaaaaaaa'), game('bruno', 'carla', 'bbbbbbbb')];
    const gs = states(state('aaaaaaaa', 'draw'), state('bbbbbbbb', 'mate', 'white'));
    const { standings } = computeStandings(players, history, gs);
    const anna = standings.find((s) => s.handle === 'anna')!;
    // Bruno ends with 0.5 + 1 = 1.5 points, Anna drew him: 0.5 * 1.5
    expect(anna.sb).toBe(0.75);
  });

  it('falls back to wins and then name when points and SB are equal', () => {
    const { standings } = computeStandings(
      [
        { name: 'Zeno', handle: 'zeno' },
        { name: 'Ada', handle: 'ada' },
      ],
      [],
      {}
    );
    expect(standings.map((s) => s.name)).toEqual(['Ada', 'Zeno']);
  });

  it('fills the crosstable symmetrically', () => {
    const history = [game('anna', 'bruno', 'aaaaaaaa'), game('bruno', 'carla', 'bbbbbbbb')];
    const gs = states(state('aaaaaaaa', 'mate', 'white'), state('bbbbbbbb', 'draw'));
    const { crosstable } = computeStandings(players, history, gs);
    expect(crosstable.anna.bruno).toBe('1');
    expect(crosstable.bruno.anna).toBe('0');
    expect(crosstable.bruno.carla).toBe('½');
    expect(crosstable.carla.bruno).toBe('½');
    expect(crosstable.anna.carla).toBe('-');
    expect(crosstable.anna.anna).toBe('✕');
  });

  it('does not crash on games with players missing from the roster', () => {
    const history = [game('anna', 'ghost', 'aaaaaaaa')];
    const gs = states(state('aaaaaaaa', 'mate', 'white'));
    const { standings, crosstable } = computeStandings(players, history, gs);
    expect(standings.find((s) => s.handle === 'anna')!.points).toBe(1);
    expect(standings.some((s) => s.handle === 'ghost')).toBe(false);
    expect(crosstable.anna.ghost).toBeUndefined();
  });
});

describe('sharedRanks', () => {
  const r = (points: number, sb: number, won?: number) => ({ points, sb, won });

  it('numbers players apart on points, then Sonneborn-Berger, then wins', () => {
    expect(sharedRanks([r(3, 4, 3), r(2, 5, 2), r(2, 3, 2), r(2, 3, 1)])).toEqual([1, 2, 3, 4]);
  });

  it('shares the place on a full tie, and the next place skips', () => {
    // two seconds, then a fourth
    expect(sharedRanks([r(3, 4, 3), r(2, 3, 2), r(2, 3, 2), r(1, 1, 1)])).toEqual([1, 2, 2, 4]);
    // three firsts, then a fourth
    expect(sharedRanks([r(2, 1, 2), r(2, 1, 2), r(2, 1, 2), r(0, 0, 0)])).toEqual([1, 1, 1, 4]);
    // two ties in the same table
    expect(sharedRanks([r(3, 2, 3), r(3, 2, 3), r(1, 0, 1), r(1, 0, 1)])).toEqual([1, 1, 3, 3]);
  });

  it('ignores wins when an old archive does not have them', () => {
    expect(sharedRanks([r(2, 1), r(2, 1), r(1, 0)])).toEqual([1, 1, 3]);
  });

  it('gives everyone the first place when nobody has played', () => {
    expect(sharedRanks([r(0, 0, 0), r(0, 0, 0)])).toEqual([1, 1]);
    expect(sharedRanks([])).toEqual([]);
  });
});

describe('isTied', () => {
  it('tells whether a place is shared', () => {
    const ranks = [1, 2, 2, 4];
    expect([0, 1, 2, 3].map((i) => isTied(ranks, i))).toEqual([false, true, true, false]);
  });
});

describe('seasonStarted', () => {
  it('is false until someone has played a game', () => {
    expect(seasonStarted(computeStandings(players, [], {}).standings)).toBe(false);
    expect(seasonStarted([{ played: 0 }, { played: 1 }])).toBe(true);
  });
});

describe('podiumPlace', () => {
  it('gives gold, silver and bronze to the first three places with points', () => {
    expect([1, 2, 3, 4].map((rank) => podiumPlace(rank, 1))).toEqual([1, 2, 3, undefined]);
    expect(podiumPlace(1, 0)).toBeUndefined();
  });
  it('gives two silvers to two shared seconds, then no bronze to the fourth', () => {
    expect([1, 2, 2, 4].map((rank) => podiumPlace(rank, 1))).toEqual([1, 2, 2, undefined]);
  });
});

describe('shared places from real games', () => {
  const four: Player[] = [...players, { name: 'Dario', handle: 'dario' }];

  it('shares the place of players level on points, tiebreak and wins, ordered by name', () => {
    // Anna and Carla each beat a player who scored nothing: same points, SB and wins
    const history = [game('anna', 'bruno', 'aaaaaaaa'), game('carla', 'dario', 'bbbbbbbb')];
    const gs = states(state('aaaaaaaa', 'mate', 'white'), state('bbbbbbbb', 'resign', 'white'));
    const { standings } = computeStandings(four, history, gs);
    expect(standings.map((s) => s.handle)).toEqual(['anna', 'carla', 'bruno', 'dario']);
    expect(sharedRanks(standings)).toEqual([1, 1, 3, 3]);
  });

  it('separates equal points by the tiebreak, and shares the place where it does not', () => {
    // Everyone but Dario scores 1 point. Anna beat Bruno, who has 1 point (SB 1); Carla and Bruno
    // beat Dario, who has none (SB 0 each, one win each): Anna 1st, Bruno and Carla both 2nd
    const history = [
      game('anna', 'bruno', 'aaaaaaaa'),
      game('carla', 'dario', 'bbbbbbbb'),
      game('bruno', 'dario', 'cccccccc'),
    ];
    const gs = states(state('aaaaaaaa', 'mate', 'white'), state('bbbbbbbb', 'mate', 'white'), state('cccccccc', 'mate', 'white'));
    const { standings } = computeStandings(four, history, gs);
    expect(standings.map((s) => [s.handle, s.points, s.sb])).toEqual([
      ['anna', 1, 1],
      ['bruno', 1, 0],
      ['carla', 1, 0],
      ['dario', 0, 0],
    ]);
    expect(sharedRanks(standings)).toEqual([1, 2, 2, 4]);
  });
});

describe('leaderText', () => {
  const r = (name: string, points: number, sb = 0, won = 0) => ({ name, points, sb, won });

  it('names the leader', () => {
    expect(leaderText([r('Anna', 3, 2, 3), r('Bruno', 2)])).toBe(' In testa Anna con 3 punti.');
    expect(leaderText([r('Anna', 1, 0, 1), r('Bruno', 0)])).toBe(' In testa Anna con 1 punto.');
  });

  it('names tied leaders together', () => {
    expect(leaderText([r('Anna', 2, 1, 2), r('Bruno', 2, 1, 2), r('Carla', 1)])).toBe(' In testa a pari merito Anna e Bruno, con 2 punti.');
    expect(leaderText([r('Anna', 1, 0, 1), r('Bruno', 1, 0, 1), r('Carla', 1, 0, 1), r('Dario', 0)])).toBe(
      ' In testa a pari merito Anna, Bruno e Carla, con 1 punto.'
    );
  });

  it('only counts more than three tied leaders', () => {
    const five = ['A', 'B', 'C', 'D', 'E'].map((n) => r(n, 1, 0, 1));
    expect(leaderText(five)).toBe(' In testa 5 giocatori a pari merito, con 1 punto.');
  });

  it('names one leader when the tiebreak separates equal points', () => {
    expect(leaderText([r('Anna', 2, 3, 2), r('Bruno', 2, 1, 2)])).toBe(' In testa Anna con 2 punti.');
  });

  it('says nothing while nobody has points', () => {
    expect(leaderText([r('Anna', 0), r('Bruno', 0)])).toBe('');
    expect(leaderText([])).toBe('');
    expect(leadersOf([r('Anna', 0)])).toEqual([]);
  });
});
