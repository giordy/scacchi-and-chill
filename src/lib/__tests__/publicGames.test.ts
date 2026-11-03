import { describe, expect, it } from 'vitest';
import { withScheduledGames } from '../publicGames';

describe('withScheduledGames', () => {
  const schedule = [
    { round: '1', white: 'a', black: 'b' },
    { round: '1', white: 'c', black: 'd' },
    { round: '2', white: 'a', black: 'c' },
  ];

  it('adds scheduled games not yet created, without a link', () => {
    const history = [{ round: '1', white: 'a', black: 'b', url: 'https://lichess.org/abcdefgh' }];
    const games = withScheduledGames(history, schedule);
    expect(games).toHaveLength(3);
    expect(games[0].url).toBe('https://lichess.org/abcdefgh');
    expect(games.slice(1).map((g) => [g.round, g.white, g.black, g.url])).toEqual([
      ['1', 'c', 'd', ''],
      ['2', 'a', 'c', ''],
    ]);
  });

  it('keeps games created outside the schedule', () => {
    const history = [{ round: '9', white: 'x', black: 'y', url: 'https://lichess.org/zzzzzzzz' }];
    expect(withScheduledGames(history, [])).toEqual(history);
  });
});
