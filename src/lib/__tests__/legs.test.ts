import { describe, expect, it } from 'vitest';
import { isReturnLeg, returnLegStart } from '../legs';
import { roundRobin } from '../roundRobin';

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('return leg', () => {
  it('finds no return leg in a single round robin', () => {
    expect(returnLegStart(roundRobin(players(8)))).toBeUndefined();
  });

  it('finds where the return leg starts in a double round robin', () => {
    expect(returnLegStart(roundRobin(players(8), { double: true }))).toBe('8');
    expect(returnLegStart(roundRobin(players(5), { double: true }))).toBe('6');
  });

  it('works on hand-made schedules with colors not swapped', () => {
    const s = [
      { round: '1', white: 'a', black: 'b' },
      { round: '2', white: 'a', black: 'c' },
      { round: '3', white: 'b', black: 'c' },
      { round: '4', white: 'a', black: 'b' },
    ];
    expect(returnLegStart(s)).toBe('4');
  });

  it('compares rounds numerically', () => {
    expect(isReturnLeg('10', '8')).toBe(true);
    expect(isReturnLeg('7', '8')).toBe(false);
    expect(isReturnLeg('7', undefined)).toBe(false);
  });
});
