import { describe, expect, it } from 'vitest';
import { upsetOf } from '../upset';
import { computeSeasonAwards } from '../awards';
import { HistoryGame, LichessExportGame } from '../../types';

const game = (w: number, b: number, winner?: 'white' | 'black', provisional?: 'white' | 'black'): LichessExportGame => ({
  id: 'x',
  status: winner ? 'resign' : 'draw',
  winner,
  players: {
    white: { user: { id: 'anna' }, rating: w, provisional: provisional === 'white' },
    black: { user: { id: 'bruno' }, rating: b, provisional: provisional === 'black' },
  },
});

describe('upsetOf', () => {
  it('is a win against an opponent rated at least 150 points higher', () => {
    expect(upsetOf(game(1400, 1580, 'white'))).toEqual({ winner: 'white', gap: 180 });
    expect(upsetOf(game(1700, 1550, 'black'))).toEqual({ winner: 'black', gap: 150 });
    expect(upsetOf(game(1400, 1549, 'white'))).toBeNull();
    expect(upsetOf(game(1600, 1400, 'white'))).toBeNull(); // the favourite won
    expect(upsetOf(game(1400, 1800))).toBeNull(); // draw
  });
  it('ignores provisional or missing ratings', () => {
    expect(upsetOf(game(1400, 1800, 'white', 'black'))).toBeNull();
    expect(upsetOf(game(1400, 1800, 'white', 'white'))).toBeNull();
    expect(upsetOf({ id: 'x', status: 'resign', winner: 'white' })).toBeNull();
  });
});

describe("L'ammazzagiganti", () => {
  it('goes to the player with the most colpacci', () => {
    const players = [
      { name: 'Anna', handle: 'anna' },
      { name: 'Bruno', handle: 'bruno' },
    ];
    const history: HistoryGame[] = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'].map((id) => ({
      round: '1',
      white: 'anna',
      black: 'bruno',
      url: `https://lichess.org/${id}`,
    }));
    const states = {
      aaaaaaaa: { ...game(1400, 1600, 'white'), id: 'aaaaaaaa' },
      bbbbbbbb: { ...game(1400, 1700, 'white'), id: 'bbbbbbbb' },
      cccccccc: { ...game(1400, 1600, 'black'), id: 'cccccccc' }, // Bruno, the favourite, wins
    };
    const award = computeSeasonAwards(players, history, states).find((a) => a.id === 'upsets');
    expect(award?.winners.map((w) => w.handle)).toEqual(['anna']);
    expect(award?.detail).toBe('2 colpacci');
  });
});
