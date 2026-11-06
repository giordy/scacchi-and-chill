import { describe, expect, it } from 'vitest';
import { agoLabel, presenceOf, seenAtFrom, seenAtOf } from '../presence';

const MIN = 60 * 1000;
const H = 60 * MIN;
const D = 24 * H;
const NOW = 100 * D;

describe('presenceOf', () => {
  it('is green within the hour, yellow within the day, grey beyond', () => {
    expect(presenceOf(NOW - 59 * MIN, NOW)).toBe('online');
    expect(presenceOf(NOW - H, NOW)).toBe('recent');
    expect(presenceOf(NOW - 23 * H, NOW)).toBe('recent');
    expect(presenceOf(NOW - D, NOW)).toBe('away');
  });
});

describe('agoLabel', () => {
  it('says how long ago, in words', () => {
    expect(agoLabel(NOW - 2 * MIN, NOW)).toBe('poco fa');
    expect(agoLabel(NOW + MIN, NOW)).toBe('poco fa');
    expect(agoLabel(NOW - 20 * MIN, NOW)).toBe('20 minuti fa');
    expect(agoLabel(NOW - 90 * MIN, NOW)).toBe("un'ora fa");
    expect(agoLabel(NOW - 5 * H, NOW)).toBe('5 ore fa');
    expect(agoLabel(NOW - 30 * H, NOW)).toBe('ieri');
    expect(agoLabel(NOW - 3 * D, NOW)).toBe('3 giorni fa');
    expect(agoLabel(NOW - 40 * D, NOW)).toBe('più di un mese fa');
  });
});

describe('seenAtFrom', () => {
  it('keys the seenAt by lower-case handle and skips users without one', () => {
    const users = [
      { id: 'anna', username: 'Anna', seenAt: 5 },
      { username: 'Bruno', seenAt: 7 },
      { id: 'carla', username: 'Carla' },
      null,
    ];
    expect(seenAtFrom(users)).toEqual({ anna: 5, bruno: 7 });
    expect(seenAtFrom({ error: 'x' })).toEqual({});
  });

  it('is read in any case', () => {
    expect(seenAtOf({ seenAt: { anna: 5 }, now: 0 }, 'Anna')).toBe(5);
    expect(seenAtOf(undefined, 'Anna')).toBeUndefined();
  });
});
