import { describe, expect, it } from 'vitest';
import { computeSeasonProgress, gameProgress } from '../progress';
import { HistoryGame, LichessExportGame } from '../../types';

const game = (round: string, white: string, black: string, id: string): HistoryGame => ({
  round,
  white,
  black,
  url: `https://lichess.org/${id}`,
});

describe('season progress', () => {
  it('maps Lichess statuses to finished / ongoing / pending', () => {
    expect(gameProgress(undefined)).toBe('pending');
    expect(gameProgress({ id: 'a', status: 'created' })).toBe('pending');
    expect(gameProgress({ id: 'a', status: 'started' })).toBe('ongoing');
    expect(gameProgress({ id: 'a', status: 'mate', winner: 'white' })).toBe('finished');
    expect(gameProgress({ id: 'a', status: 'draw' })).toBe('finished');
  });

  it('follows the schedule order and counts games not created yet as pending', () => {
    const schedule = [
      { round: '1', white: 'a', black: 'b' },
      { round: '1', white: 'c', black: 'd' },
      { round: '2', white: 'a', black: 'c' },
    ];
    const history = [game('1', 'c', 'd', 'gameAAA2'), game('1', 'a', 'b', 'gameAAA1')];
    const states: Record<string, LichessExportGame> = {
      gameAAA1: { id: 'gameAAA1', status: 'resign', winner: 'black' },
      gameAAA2: { id: 'gameAAA2', status: 'started' },
    };
    const p = computeSeasonProgress(history, states, schedule);
    expect(p.games).toEqual(['finished', 'ongoing', 'pending']);
    expect(p).toMatchObject({ finished: 1, ongoing: 1, total: 3, currentRound: '1' });
  });

  it('includes games outside the schedule and sorts rounds numerically', () => {
    const history = [game('9', 'a', 'b', 'gameXXX1'), game('10', 'c', 'd', 'gameYYY1')];
    const p = computeSeasonProgress(history, {});
    expect(p.total).toBe(2);
    expect(p.currentRound).toBe('10');
  });

  it('uses the state saved on Firestore when the live one is missing', () => {
    const g = { ...game('1', 'a', 'b', 'gameZZZ1'), lichess: { id: 'gameZZZ1', status: 'draw' } };
    expect(computeSeasonProgress([g], {}).finished).toBe(1);
  });
});
