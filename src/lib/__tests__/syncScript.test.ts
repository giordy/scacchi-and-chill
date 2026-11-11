import { describe, expect, it } from 'vitest';
// @ts-expect-error a Node script without types
import { changed, gameIdOf, syncTargets, toValue } from '../../../scripts/sync-results.mjs';
// @ts-expect-error a Node script without types
import { fields } from '../../../scripts/backup.mjs';

describe('results sync script', () => {
  it('writes values that read back the same', () => {
    const state = { id: 'abcdefgh', status: 'mate', winner: 'white', createdAt: 1791532106538, rated: true, players: { white: { rating: 1814 } }, list: ['a', 1.5], none: null };
    expect(fields(toValue(state).mapValue.fields)).toEqual(state);
    expect(toValue({ a: undefined, b: 1 })).toEqual({ mapValue: { fields: { b: { integerValue: '1' } } } });
  });

  it('reads again only the games with a link and no final result', () => {
    const games = [
      { url: 'https://lichess.org/aaaaaaaa', lichess: { status: 'mate' } },
      { url: 'https://lichess.org/bbbbbbbb', lichess: { status: 'started' } },
      { url: 'https://lichess.org/cccccccc' },
      { url: '' },
    ];
    expect(syncTargets(games).map((g: { url: string }) => gameIdOf(g.url))).toEqual(['bbbbbbbb', 'cccccccc']);
  });

  it('saves a state only when it changed', () => {
    expect(changed(undefined, undefined)).toBe(false);
    expect(changed(undefined, { status: 'created' })).toBe(true);
    expect(changed({ status: 'started', moves: 'e4' }, { status: 'started', moves: 'e4' })).toBe(false);
    expect(changed({ status: 'started', moves: 'e4' }, { status: 'started', moves: 'e4 e5' })).toBe(true);
    expect(changed({ status: 'started', moves: 'e4' }, { status: 'resign', moves: 'e4' })).toBe(true);
  });
});
