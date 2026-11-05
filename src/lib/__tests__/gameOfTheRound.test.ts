import { describe, expect, it } from 'vitest';
import { gamesOfTheRound } from '../gameOfTheRound';
import { HistoryGame, LichessExportGame } from '../../types';

const plies = (n: number) => Array.from({ length: n }, () => 'e4').join(' ');
const states: Record<string, LichessExportGame> = {};
const game = (round: string, id: string, status: string, n: number, winner?: 'white' | 'black'): HistoryGame => {
  states[id] = { id, status, moves: plies(n), winner };
  return { round, white: 'a', black: 'b', url: `https://lichess.org/${id}` } as HistoryGame;
};
const stateOf = (g: HistoryGame) => states[g.url!.split('/').pop()!];

describe('gamesOfTheRound', () => {
  it('picks the longest game of each concluded round', () => {
    const games = [game('1', 'a1', 'mate', 40, 'white'), game('1', 'a2', 'resign', 90, 'black'), game('1', 'a3', 'aborted', 0)];
    expect([...gamesOfTheRound(games, stateOf)]).toEqual(['https://lichess.org/a2']);
  });
  it('skips rounds still open, with a single game or an unbreakable tie', () => {
    const open = [game('2', 'b1', 'mate', 40, 'white'), game('2', 'b2', 'started', 90)];
    const single = [game('3', 'c1', 'mate', 40, 'white')];
    const tie = [game('4', 'd1', 'mate', 40, 'white'), game('4', 'd2', 'resign', 40, 'black')];
    expect(gamesOfTheRound([...open, ...single, ...tie], stateOf).size).toBe(0);
  });
  it('breaks a tie in favour of the decisive game', () => {
    const games = [game('5', 'e1', 'draw', 60), game('5', 'e2', 'mate', 60, 'black')];
    expect([...gamesOfTheRound(games, stateOf)]).toEqual(['https://lichess.org/e2']);
  });
});
