import { describe, expect, it } from 'vitest';
import { lastMovesOf, newMoveIds, NEWS_MS } from '../seenMoves';
import { HistoryGame, LichessExportGame } from '../../types';

const g = (id: string): HistoryGame => ({ round: '1', white: 'anna', black: 'bruno', url: id ? `https://lichess.org/${id}` : '' });

describe('lastMovesOf', () => {
  it('keeps the last move of the games with a link and a move', () => {
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'started', lastMoveAt: 50 },
      bbbbbbbb: { id: 'bbbbbbbb', status: 'created' }, // not started: no move
      cccccccc: { id: 'cccccccc', status: 'mate', lastMoveAt: 0 },
    };
    expect(lastMovesOf([g('aaaaaaaa'), g('bbbbbbbb'), g('cccccccc'), g('')], states)).toEqual({ aaaaaaaa: 50 });
  });
});

describe('newMoveIds', () => {
  it('the games whose last move is later than the one seen, new games included', () => {
    expect([...newMoveIds({ a: 10, b: 20, c: 5 }, { a: 10, b: 15 }, 100)]).toEqual(['b', 'c']);
  });
  it('none on a first visit', () => {
    expect(newMoveIds({ a: 10 }, null, 100).size).toBe(0);
  });
  it('a move seen later than the one read (another device, an older answer) is no news', () => {
    expect(newMoveIds({ a: 10 }, { a: 12 }, 100).size).toBe(0);
  });
  it('a move older than 3 days is no longer news, even if not seen', () => {
    const now = 10 * NEWS_MS;
    expect([...newMoveIds({ a: now - NEWS_MS, b: now - NEWS_MS - 1 }, {}, now)]).toEqual(['a']);
  });
});
