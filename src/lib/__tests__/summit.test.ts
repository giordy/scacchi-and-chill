import { describe, expect, it } from 'vitest';
import { positionsText, summitGames, summitKey } from '../summit';
import { HistoryGame, LichessExportGame, Player } from '../../types';

const players: Player[] = ['anna', 'bruno', 'carla', 'dario', 'elena', 'fabio'].map((h) => ({ handle: h, name: h }));
const states: Record<string, LichessExportGame> = {};
let n = 0;
const g = (round: string, white: string, black: string, winner?: 'white' | 'black' | 'draw'): HistoryGame => {
  const id = `game${String(n++).padStart(4, '0')}`;
  if (winner) states[id] = { id, status: winner === 'draw' ? 'draw' : 'resign', winner: winner === 'draw' ? undefined : winner };
  return { round, white, black, url: `https://lichess.org/${id}` };
};

describe('summitGames', () => {
  it('finds the games between players in the top 3 at the start of the round', () => {
    const games = [
      g('1', 'anna', 'bruno', 'white'), // anna 1
      g('1', 'carla', 'dario', 'white'), // carla 1
      g('1', 'elena', 'fabio', 'draw'), // elena, fabio ½
      g('2', 'anna', 'carla'), // 1st vs 1st
      g('2', 'elena', 'bruno'), // 3rd (tied with fabio) vs last
      g('2', 'fabio', 'dario'),
    ];
    const s = summitGames(players, games, states);
    expect(s.get(summitKey(games[3]))).toBe('entrambi al 1° posto');
    expect(s.has(summitKey(games[4]))).toBe(false);
    expect(s.size).toBe(1);
  });
  it('says nothing in the first round or when ties crowd the top', () => {
    const games = [
      g('1', 'anna', 'bruno', 'draw'),
      g('1', 'carla', 'dario', 'draw'),
      g('1', 'elena', 'fabio', 'draw'),
      g('2', 'anna', 'carla'),
    ];
    expect(summitGames(players, games, states).size).toBe(0);
  });
});

describe('positionsText', () => {
  it('orders the positions', () => {
    expect(positionsText(3, 1)).toBe('1° contro 3°');
    expect(positionsText(2, 2)).toBe('entrambi al 2° posto');
  });
});
