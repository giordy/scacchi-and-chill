import { describe, expect, it } from 'vitest';
import { fieldsOf, gameFromDoc } from '../firestoreRest';
import { retryDelay } from '../../hooks/usePublicData';

describe('firestoreRest', () => {
  it('turns REST values into plain JSON', () => {
    expect(
      fieldsOf({
        round: { stringValue: '2' },
        createdAt: { integerValue: '1791532106538' },
        lichess: { mapValue: { fields: { status: { stringValue: 'mate' }, rated: { booleanValue: true }, moves: { nullValue: null } } } },
        tags: { arrayValue: { values: [{ stringValue: 'a' }, { doubleValue: 1.5 }] } },
        empty: { arrayValue: {} },
      })
    ).toEqual({ round: '2', createdAt: 1791532106538, lichess: { status: 'mate', rated: true, moves: null }, tags: ['a', 1.5], empty: [] });
  });
  it('reads a game document as the site uses it, none when incomplete', () => {
    expect(gameFromDoc({ round: 1, white: 'anna', black: 'bruno', createdAt: 5 })).toEqual({ round: '1', white: 'anna', black: 'bruno', url: '', createdAt: 5, lichess: undefined });
    expect(gameFromDoc({ round: '1', white: 'anna' })).toBeNull();
  });
});

describe('retryDelay (public page: a failed read is tried again soon)', () => {
  it('waits a little longer each time, never more than 30 s', () => {
    expect([1, 2, 3, 4, 9].map(retryDelay)).toEqual([3000, 8000, 20000, 30000, 30000]);
  });
});
