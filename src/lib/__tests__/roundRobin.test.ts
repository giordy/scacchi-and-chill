import { describe, expect, it } from 'vitest';
import { roundRobin, shuffled } from '../roundRobin';
import { ScheduledMatch } from '../../types';

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

const colorsOf = (schedule: ScheduledMatch[], p: string) =>
  [...schedule]
    .sort((a, b) => Number(a.round) - Number(b.round))
    .filter((m) => m.white === p || m.black === p)
    .map((m) => (m.white === p ? 'W' : 'B'));

describe('roundRobin', () => {
  it.each([4, 6, 7, 8, 9, 10])('pairs every player with every other exactly once (%i players)', (n) => {
    const s = roundRobin(players(n));
    expect(s).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(s.map((m) => [m.white, m.black].sort().join('-')));
    expect(pairs.size).toBe(s.length);
    // One game per player per round
    const rounds = new Set(s.map((m) => m.round));
    expect(rounds.size).toBe(n % 2 === 0 ? n - 1 : n);
    for (const r of rounds) {
      const inRound = s.filter((m) => m.round === r).flatMap((m) => [m.white, m.black]);
      expect(new Set(inRound).size).toBe(inRound.length);
    }
  });

  it.each([4, 6, 8, 10, 12])('balances colors (%i players)', (n) => {
    const s = roundRobin(players(n));
    for (const p of players(n)) {
      const c = colorsOf(s, p);
      const whites = c.filter((x) => x === 'W').length;
      expect(Math.abs(whites - (c.length - whites))).toBeLessThanOrEqual(1);
      expect(c.join('')).not.toMatch(/WWW|BBB/);
    }
  });

  it('gives one rest per round with an odd number of players', () => {
    const s = roundRobin(players(7));
    for (let r = 1; r <= 7; r++) {
      expect(s.filter((m) => m.round === String(r))).toHaveLength(3);
    }
  });

  it('builds the return leg with swapped colors', () => {
    const s = roundRobin(players(4), { double: true });
    expect(s).toHaveLength(12);
    const first = s.find((m) => m.round === '1')!;
    expect(s).toContainEqual({ round: '4', white: first.black, black: first.white });
  });

  it('returns nothing with fewer than two players', () => {
    expect(roundRobin(['solo'])).toEqual([]);
  });

  it('shuffles without losing players', () => {
    const list = players(8);
    expect(shuffled(list).sort()).toEqual([...list].sort());
  });
});
