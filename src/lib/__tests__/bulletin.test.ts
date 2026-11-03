import { describe, expect, it } from 'vitest';
import { leaderLine, roundDeadline, roundSummary } from '../bulletin';
import { PlayerStanding } from '../standings';

const DAY = 86400000;

describe('roundDeadline', () => {
  it('counts the expiry from the oldest created game', () => {
    expect(roundDeadline([{ createdAt: 5000 }, { createdAt: 1000 }, {}], 2, 99999)).toBe(1000 + 2 * DAY);
  });

  it('falls back to now when no game has a creation time', () => {
    expect(roundDeadline([{}, {}], 3, 7000)).toBe(7000 + 3 * DAY);
  });
});

describe('roundSummary', () => {
  it('omits zero parts and uses the singular', () => {
    expect(roundSummary({ finished: 3, ongoing: 1, pending: 0 })).toBe('3 finite · 1 in corso');
    expect(roundSummary({ finished: 1, ongoing: 0, pending: 2 })).toBe('1 finita · 2 da avviare');
    expect(roundSummary({ finished: 0, ongoing: 0, pending: 0 })).toBe('');
  });
});

describe('leaderLine', () => {
  const s = (name: string, points: number): PlayerStanding => ({
    handle: name.toLowerCase(),
    name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points,
    sb: 0,
  });

  it('names the leader, or the players tied on points', () => {
    expect(leaderLine([s('Anna', 3), s('Bruno', 2)])).toBe('🥇 In testa Anna con 3 punti.');
    expect(leaderLine([s('Anna', 1), s('Bruno', 0)])).toBe('🥇 In testa Anna con 1 punto.');
    expect(leaderLine([s('Anna', 2.5), s('Bruno', 2.5), s('Carla', 1)])).toBe(
      '🥇 In testa a pari punti Anna e Bruno, con 2½ punti.'
    );
  });

  it('says nothing before any point or when too many share the lead', () => {
    expect(leaderLine([s('Anna', 0)])).toBe('');
    expect(leaderLine([s('A', 1), s('B', 1), s('C', 1), s('D', 1)])).toBe('');
  });
});
