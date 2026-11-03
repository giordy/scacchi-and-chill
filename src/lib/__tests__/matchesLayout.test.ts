import { describe, expect, it } from 'vitest';
import { layoutMatches } from '../matchesLayout';
import { GameProgress } from '../progress';
import { HistoryGame } from '../../types';

const game = (round: string, white: string, black: string, url = `https://lichess.org/${white}${black}${round}`): HistoryGame => ({
  round,
  white,
  black,
  url,
});
const progress = (map: Record<string, GameProgress>) => (g: HistoryGame) => map[g.url] ?? 'pending';

describe('matches layout', () => {
  it('puts the current round first, played rounds newest first and upcoming rounds in order', () => {
    const games = [
      game('1', 'a', 'b'),
      game('2', 'a', 'c'),
      game('3', 'b', 'c'),
      game('4', 'a', 'd', ''),
      game('10', 'b', 'd', ''),
    ];
    const l = layoutMatches(
      games,
      progress({ [games[0].url]: 'finished', [games[1].url]: 'finished', [games[2].url]: 'ongoing' })
    );
    expect(l.current?.round).toBe('3');
    expect(l.played.map((r) => r.round)).toEqual(['2', '1']);
    expect(l.upcoming.map((r) => r.round)).toEqual(['4', '10']);
    expect(l.late).toEqual([]);
    expect(l.concluded).toBe(false);
  });

  it('brings forward unfinished games of earlier rounds, oldest round first', () => {
    const games = [game('1', 'a', 'b'), game('1', 'c', 'd'), game('2', 'a', 'c'), game('2', 'b', 'd'), game('3', 'a', 'd')];
    const l = layoutMatches(
      games,
      progress({
        [games[0].url]: 'finished',
        [games[1].url]: 'ongoing',
        [games[2].url]: 'finished',
        [games[3].url]: 'pending',
        [games[4].url]: 'ongoing',
      })
    );
    expect(l.current?.round).toBe('3');
    expect(l.late).toEqual([games[1], games[3]]);
  });

  it('ignores pairings of earlier rounds never created on Lichess', () => {
    const games = [game('1', 'a', 'b', ''), game('2', 'a', 'c')];
    const l = layoutMatches(games, progress({}));
    expect(l.current?.round).toBe('2');
    expect(l.late).toEqual([]);
  });

  it('keeps plain round order before the season starts', () => {
    const games = [game('1', 'a', 'b', ''), game('2', 'a', 'c', '')];
    const l = layoutMatches(games, progress({}));
    expect(l.current).toBeUndefined();
    expect(l.upcoming.map((r) => r.round)).toEqual(['1', '2']);
    expect(l.played).toEqual([]);
  });

  it('marks the season as concluded when every game is over', () => {
    const games = [game('1', 'a', 'b'), game('2', 'a', 'c')];
    const l = layoutMatches(games, progress({ [games[0].url]: 'finished', [games[1].url]: 'finished' }));
    expect(l.concluded).toBe(true);
    expect(l.current?.round).toBe('2');
    expect(l.played.map((r) => r.round)).toEqual(['1']);
  });
});
