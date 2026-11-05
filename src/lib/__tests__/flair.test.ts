import { describe, expect, it } from 'vitest';
import { flairFromGames, flairUrl } from '../flair';
import { HistoryGame, LichessExportGame } from '../../types';

const game = (id: string, at: number, flair?: string): HistoryGame => ({
  round: '1',
  white: 'anna',
  black: 'bruno',
  url: `https://lichess.org/${id}`,
  lichess: {
    id,
    status: 'mate',
    lastMoveAt: at,
    players: { white: { user: { id: 'Anna', flair } }, black: { user: { id: 'bruno', flair: 'x.y' } } },
  } as LichessExportGame,
});

describe('flairFromGames', () => {
  it('takes the flair of the latest game, matching the handle in any case', () => {
    expect(flairFromGames('anna', [game('aaaaaaaa', 1, 'old.one'), game('bbbbbbbb', 2, 'food-drink.rice-ball')], {})).toBe('food-drink.rice-ball');
  });
  it('drops a flair the player removed since', () => {
    expect(flairFromGames('anna', [game('aaaaaaaa', 1, 'old.one'), game('bbbbbbbb', 2)], {})).toBeUndefined();
  });
  it('is undefined without games', () => {
    expect(flairFromGames('anna', [], {})).toBeUndefined();
  });
  it('points to the Lichess asset', () => {
    expect(flairUrl('food-drink.rice-ball')).toBe('https://lichess1.org/assets/flair/img/food-drink.rice-ball.webp');
  });
});
