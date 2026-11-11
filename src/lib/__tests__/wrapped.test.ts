import { describe, expect, it } from 'vitest';
import { seasonWrapped } from '../wrapped';
import { ArchivedGame } from '../../types';

const g = (round: string, white: string, black: string, result: ArchivedGame['result'], plies = 40, opening?: string, status = 'resign'): ArchivedGame => ({
  round,
  white,
  black,
  result,
  plies,
  status,
  ...(opening ? { opening } : {}),
});

const games: ArchivedGame[] = [
  g('1', 'anna', 'bruno', '1-0', 41, 'Italian Game: Two Knights'),
  g('2', 'carla', 'anna', '0-1', 120, 'Italian Game'),
  g('3', 'anna', 'dario', '½-½', 60),
  g('4', 'bruno', 'anna', '1-0', 30),
  g('5', 'anna', 'carla', '1-0', 7, undefined, 'forfeit'),
  g('6', 'anna', 'bruno', '0-1', 50),
  g('1', 'bruno', 'carla', '1-0'),
];

describe('seasonWrapped', () => {
  const w = seasonWrapped('Anna', games)!;
  it('counts the results and the runs in round order', () => {
    expect([w.played, w.won, w.drawn, w.lost, w.points]).toEqual([6, 3, 1, 2, 3.5]);
    expect(w.winStreak).toBe(2);
    expect(w.unbeaten).toBe(3);
  });
  it('finds the opponent who hurt most and the one beaten most', () => {
    expect(w.nemesis).toEqual({ opponent: 'bruno', scored: 1, conceded: 2 });
    expect(w.favourite).toEqual({ opponent: 'carla', scored: 2, conceded: 0 });
  });
  it('takes the longest game and the quickest win on the board, and the opening played most', () => {
    expect(w.longest).toEqual({ opponent: 'carla', moves: 60, score: 1 });
    expect(w.quickestWin).toEqual({ opponent: 'bruno', moves: 21 });
    expect(w.opening).toEqual({ name: 'Italian Game', games: 2 });
    expect(w.upsets).toBe(0);
    expect(w.elo).toBeUndefined();
  });
  it('names no opponent when several are alike', () => {
    const lost = [g('1', 'anna', 'zoe', '1-0'), g('2', 'bruno', 'zoe', '1-0'), g('3', 'zoe', 'carla', '0-1')];
    const z = seasonWrapped('zoe', lost)!;
    expect(z.nemesis).toBeUndefined();
    expect(z.favourite).toBeUndefined();
  });

  it('is nothing for who did not play', () => {
    expect(seasonWrapped('zoe', games)).toBeNull();
  });
});
