import { describe, expect, it } from 'vitest';
import { completeSchedule } from '../completeSchedule';
import { roundRobin } from '../roundRobin';
import { returnLegStart } from '../legs';
import { normalizeSchedule } from '../config';
import { ScheduledMatch } from '../../types';

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

// Deterministic pseudo-random generator for reproducible tests
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

function expectValidRoundRobin(ps: string[], s: ScheduledMatch[], legs = 1) {
  const pairs = new Map<string, number>();
  s.forEach((m) => {
    const k = [m.white, m.black].sort().join('-');
    pairs.set(k, (pairs.get(k) ?? 0) + 1);
  });
  expect(pairs.size).toBe((ps.length * (ps.length - 1)) / 2);
  pairs.forEach((n) => expect(n).toBe(legs));
  const rounds = new Set(s.map((m) => m.round));
  const perLeg = ps.length % 2 === 0 ? ps.length - 1 : ps.length;
  expect(rounds.size).toBe(perLeg * legs);
  rounds.forEach((r) => {
    const inRound = s.filter((m) => m.round === r).flatMap((m) => [m.white, m.black]);
    expect(new Set(inRound).size).toBe(inRound.length);
    expect(inRound.length).toBe(ps.length % 2 === 0 ? ps.length : ps.length - 1);
  });
}

describe('completeSchedule', () => {
  it('keeps the existing rounds and adds the missing ones', () => {
    const ps = players(8);
    const existing = roundRobin(ps).filter((m) => Number(m.round) <= 2);
    const res = completeSchedule(ps, existing, { random: seeded(1) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expectValidRoundRobin(ps, res.schedule);
    existing.forEach((m) => expect(res.schedule).toContainEqual(m));
    expect(res.newRounds).toEqual(['3', '4', '5', '6', '7']);
    expect(res.added).toHaveLength(20);
  });

  it('fills rounds that are only partly planned', () => {
    const ps = players(6);
    const existing = [
      { round: '1', white: 'p1', black: 'p2' },
      { round: '2', white: 'p1', black: 'p3' },
      { round: '2', white: 'p2', black: 'p4' },
    ];
    const res = completeSchedule(ps, existing, { random: seeded(2) });
    expect(res.ok).toBe(true);
    if (res.ok) expectValidRoundRobin(ps, res.schedule);
  });

  it('works with an odd number of players (one rest per round)', () => {
    const ps = players(5);
    const existing = roundRobin(ps).filter((m) => m.round === '1');
    const res = completeSchedule(ps, existing, { random: seeded(3) });
    expect(res.ok).toBe(true);
    if (res.ok) expectValidRoundRobin(ps, res.schedule);
  });

  it('says so when the rounds cannot be completed', () => {
    const ps = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rounds = [
      [['a', 'd'], ['b', 'f'], ['c', 'e']],
      [['a', 'e'], ['b', 'c'], ['d', 'f']],
      [['a', 'b'], ['c', 'd'], ['e', 'f']],
    ];
    const existing = rounds.flatMap((r, i) => r.map(([white, black]) => ({ round: String(i + 1), white, black })));
    const res = completeSchedule(ps, existing, { random: seeded(4) });
    expect(res.ok).toBe(false);
  });

  it('rejects inconsistent rounds', () => {
    const ps = players(4);
    const twice = completeSchedule(ps, [
      { round: '1', white: 'p1', black: 'p2' },
      { round: '1', white: 'p1', black: 'p3' },
    ]);
    expect(twice).toMatchObject({ ok: false });
    const repeated = completeSchedule(ps, [
      { round: '1', white: 'p1', black: 'p2' },
      { round: '2', white: 'p2', black: 'p1' },
    ]);
    expect(repeated).toMatchObject({ ok: false });
    const stranger = completeSchedule(ps, [{ round: '1', white: 'p1', black: 'nobody' }]);
    expect(stranger).toMatchObject({ ok: false });
  });

  it('completes the andata and mirrors it as ritorno with swapped colors', () => {
    const ps = players(6);
    const existing = roundRobin(ps).filter((m) => Number(m.round) <= 2);
    const res = completeSchedule(ps, existing, { double: true, random: seeded(5) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expectValidRoundRobin(ps, res.schedule, 2);
    expect(returnLegStart(res.schedule)).toBe('6');
    const first = existing[0];
    expect(res.schedule).toContainEqual({ round: String(Number(first.round) + 5), white: first.black, black: first.white });
  });

  it('keeps colors balanced in the added games', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ps = players(8);
      const res = completeSchedule(ps, roundRobin(ps).filter((m) => m.round === '1'), { random: seeded(seed) });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      for (const p of ps) {
        const colors = res.schedule
          .slice()
          .sort((a, b) => Number(a.round) - Number(b.round))
          .filter((m) => m.white === p || m.black === p)
          .map((m) => (m.white === p ? 'W' : 'B'))
          .join('');
        const whites = colors.split('W').length - 1;
        expect(Math.abs(whites - (colors.length - whites))).toBeLessThanOrEqual(2);
        expect(colors).not.toMatch(/WWW|BBB/);
      }
    }
  });
});

describe('completeSchedule on random partial schedules', () => {
  it('always returns a valid round robin when it succeeds', () => {
    let succeeded = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const random = seeded(seed);
      const n = 4 + (seed % 7); // 4..10 players
      const ps = players(n);
      const full = roundRobin(ps);
      const keepRounds = Math.floor(random() * (n - 1));
      // Some rounds kept whole, plus a few loose games of the next round
      const existing = full.filter(
        (m) => Number(m.round) <= keepRounds || (Number(m.round) === keepRounds + 1 && random() < 0.5)
      );
      const res = completeSchedule(ps, existing, { random });
      if (!res.ok) continue;
      succeeded++;
      expectValidRoundRobin(ps, res.schedule);
      existing.forEach((m) => expect(res.schedule).toContainEqual(m));
    }
    // Prefixes of a valid round robin are always completable
    expect(succeeded).toBe(60);
  });
});

describe('normalizeSchedule', () => {
  it('drops old Lichess links and invalid entries', () => {
    expect(
      normalizeSchedule([
        { round: '1', white: 'a', black: 'b', url: 'https://lichess.org/abcdefgh' },
        { round: '2', white: 'a' },
        null,
      ])
    ).toEqual([{ round: '1', white: 'a', black: 'b' }]);
  });
});
