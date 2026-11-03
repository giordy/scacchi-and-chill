import { describe, expect, it } from 'vitest';
import { addMatch, currentRound, nextRoundNumber, removeMatch, removeRound, roundsOf, swapColors } from '../rounds';

const url = (id: string) => `https://lichess.org/${id}`;

describe('roundsOf', () => {
  const schedule = [
    { round: '1', white: 'a', black: 'b' },
    { round: '1', white: 'c', black: 'd' },
    { round: '2', white: 'a', black: 'c' },
    { round: '10', white: 'b', black: 'd' },
  ];

  it('merges schedule and created games, rounds in numeric order', () => {
    const history = [
      { round: '1', white: 'c', black: 'd', url: url('cd000000') },
      { round: '1', white: 'x', black: 'y', url: url('xy000000') },
    ];
    const rounds = roundsOf(schedule, history);
    expect(rounds.map((r) => r.round)).toEqual(['1', '2', '10']);
    expect(rounds[0].matches.map((m) => [m.white, m.black, m.url, m.scheduled])).toEqual([
      ['a', 'b', '', true],
      ['c', 'd', url('cd000000'), true],
      ['x', 'y', url('xy000000'), false],
    ]);
    expect(rounds[0].created).toBe(2);
    expect(rounds[1].created).toBe(0);
  });

  it('shows rounds that exist only on Lichess', () => {
    const rounds = roundsOf([], [{ round: '3', white: 'a', black: 'b', url: url('ab000000') }]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ round: '3', created: 1 });
  });

  it('picks the first round with games still to create as current', () => {
    const history = [
      { round: '1', white: 'a', black: 'b', url: url('ab000000') },
      { round: '1', white: 'c', black: 'd', url: url('cd000000') },
    ];
    expect(currentRound(roundsOf(schedule, history))).toBe('2');
    expect(currentRound(roundsOf([], history))).toBe('1');
    expect(currentRound([])).toBeUndefined();
  });
});

describe('nextRoundNumber', () => {
  it('follows the highest numeric round', () => {
    expect(nextRoundNumber([])).toBe('1');
    expect(nextRoundNumber([{ round: '2' }, { round: '10' }, { round: 'x' }])).toBe('11');
  });
});

describe('schedule editing', () => {
  const schedule = [
    { round: '1', white: 'a', black: 'b' },
    { round: '2', white: 'a', black: 'b' },
  ];

  it('adds a match only once', () => {
    expect(addMatch(schedule, { round: '1', white: 'c', black: 'd' })).toHaveLength(3);
    expect(addMatch(schedule, { round: '1', white: 'a', black: 'b' })).toBe(schedule);
  });

  it('removes and swaps only the given round', () => {
    expect(removeMatch(schedule, { round: '1', white: 'a', black: 'b' })).toEqual([schedule[1]]);
    expect(swapColors(schedule, { round: '2', white: 'a', black: 'b' })).toEqual([
      schedule[0],
      { round: '2', white: 'b', black: 'a' },
    ]);
    expect(removeRound(schedule, '2')).toEqual([schedule[0]]);
  });
});
