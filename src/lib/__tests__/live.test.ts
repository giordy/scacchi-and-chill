import { describe, expect, it } from 'vitest';
import { isLiveGame, LIVE_WINDOW_MS, liveGameIds } from '../live';
import { LichessExportGame } from '../../types';

const now = 1_800_000_000_000;
const MIN = 60 * 1000;
const game = { white: 'Anna', black: 'bruno', url: 'https://lichess.org/abcdefgh', round: '1' };
const started = (lastMoveAt?: number): LichessExportGame => ({ id: 'abcdefgh', status: 'started', lastMoveAt });
const seen = (anna?: number, bruno?: number) => ({
  seenAt: { ...(anna ? { anna } : {}), ...(bruno ? { bruno } : {}) },
  flair: {},
  now,
});

describe('isLiveGame', () => {
  it('is live with a move in the last 15 minutes and both players seen in the last 15 minutes', () => {
    expect(isLiveGame(game, started(now - 3 * MIN), seen(now - 3 * MIN, now - 1 * MIN), now)).toBe(true);
    expect(isLiveGame(game, started(now - LIVE_WINDOW_MS), seen(now - LIVE_WINDOW_MS, now - LIVE_WINDOW_MS), now)).toBe(true);
  });

  it('is not live when the other player has not been on Lichess lately', () => {
    expect(isLiveGame(game, started(now - 3 * MIN), seen(now - 3 * MIN, now - 2 * 60 * MIN), now)).toBe(false);
    expect(isLiveGame(game, started(now - 3 * MIN), seen(now - 3 * MIN), now)).toBe(false);
  });

  it('stops being live 15 minutes after the last move, even with both players around', () => {
    expect(isLiveGame(game, started(now - 16 * MIN), seen(now - 1 * MIN, now - 1 * MIN), now)).toBe(false);
    expect(isLiveGame(game, started(undefined), seen(now, now), now)).toBe(false);
  });

  it('is never live once over, or without the profiles', () => {
    expect(isLiveGame(game, { ...started(now - MIN), status: 'mate' }, seen(now, now), now)).toBe(false);
    expect(isLiveGame(game, started(now - MIN), undefined, now)).toBe(false);
    expect(isLiveGame(game, undefined, seen(now, now), now)).toBe(false);
  });
});

describe('liveGameIds', () => {
  it('lists the live games by their Lichess id', () => {
    const other = { white: 'carla', black: 'dario', url: 'https://lichess.org/zzzzzzzz', round: '1' };
    const states = { abcdefgh: started(now - MIN), zzzzzzzz: { ...started(now - MIN), id: 'zzzzzzzz' } };
    expect([...liveGameIds([game, other], states, seen(now - MIN, now - MIN), now)]).toEqual(['abcdefgh']);
  });
});
