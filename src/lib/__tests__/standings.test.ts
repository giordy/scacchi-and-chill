import { describe, expect, it } from 'vitest';
import { computeStandings } from '../standings';
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
