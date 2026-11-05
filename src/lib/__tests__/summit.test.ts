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

// Three rounds: Anna 3, Carla and Elena 2, Bruno 1½: three players in the top three places
const firstRounds = () => [
  g('1', 'anna', 'bruno', 'white'),
  g('1', 'carla', 'dario', 'white'),
  g('1', 'elena', 'fabio', 'draw'),
  g('2', 'anna', 'dario', 'white'),
  g('2', 'carla', 'fabio', 'white'),
  g('2', 'elena', 'bruno', 'draw'),
  g('3', 'anna', 'fabio', 'white'),
  g('3', 'bruno', 'carla', 'white'),
  g('3', 'elena', 'dario', 'white'),
];

describe('summitGames', () => {
  it('finds the games between the top three from the 4th round', () => {
    const r4 = [g('4', 'anna', 'carla'), g('4', 'elena', 'bruno'), g('4', 'dario', 'fabio')];
    const s = summitGames(players, [...firstRounds(), ...r4], states);
    expect(s.get(summitKey(r4[0]))).toBe('1° contro 2°');
    expect(s.has(summitKey(r4[1]))).toBe(false);
    expect(s.size).toBe(1);
  });

  it('says nothing in the first three rounds, even between the leaders', () => {
    const games = [g('1', 'anna', 'bruno', 'white'), g('1', 'carla', 'dario', 'white'), g('2', 'anna', 'carla')];
    expect(summitGames(players, games, states).size).toBe(0);
  });

  it('says nothing when ties crowd the top three', () => {
    // After three rounds of draws everyone is level
    const draws = ['1', '2', '3'].flatMap((r) => [g(r, 'anna', 'bruno', 'draw'), g(r, 'carla', 'dario', 'draw'), g(r, 'elena', 'fabio', 'draw')]);
    expect(summitGames(players, [...draws, g('4', 'anna', 'carla')], states).size).toBe(0);
  });
});

describe('positionsText', () => {
  it('orders the positions', () => {
    expect(positionsText(3, 1)).toBe('1° contro 3°');
    expect(positionsText(2, 2)).toBe('entrambi al 2° posto');
  });
});
