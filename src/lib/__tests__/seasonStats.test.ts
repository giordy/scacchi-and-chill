import { describe, expect, it } from 'vitest';
import { seasonStats } from '../seasonStats';
import { HistoryGame, LichessExportGame } from '../../types';

const players = ['anna', 'bruno'].map((h) => ({ handle: h, name: h }));
const D = 86400e3;
const g = (s: Partial<LichessExportGame>): HistoryGame => ({
  round: '1',
  white: 'anna',
  black: 'bruno',
  url: '',
  lichess: { id: '', status: 'resign', moves: Array.from({ length: 40 }, () => 'e4').join(' '), createdAt: 1, lastMoveAt: 1 + 2 * D, ...s } as LichessExportGame,
});

describe('seasonStats', () => {
  it('waits for a few games', () => {
    expect(seasonStats(players, [g({ winner: 'white' }), g({ winner: 'black' })], {})).toBeNull();
  });

  it('gives anonymous numbers over the games played on the board', () => {
    const history = [
      g({ status: 'mate', winner: 'white', opening: { name: 'Sicilian Defense: Najdorf' } }),
      g({ winner: 'white', opening: { name: 'Sicilian Defense: Dragon' } }),
      g({ winner: 'black', opening: { name: 'Owen Defense' }, lastMoveAt: 1 + 4 * D }),
      g({ status: 'draw', moves: '' }),
      g({ status: 'forfeit', winner: 'white' }), // not played: left out
      g({ status: 'started' }), // not finished
    ];
    expect(seasonStats(players, history, {})).toEqual({
      games: 4,
      whiteWins: 2,
      blackWins: 1,
      draws: 1,
      mates: 1,
      resigns: 2,
      timeouts: 0,
      avgMoves: 20,
      avgDays: 2.5,
      topOpening: { name: 'Sicilian Defense', games: 2 },
    });
  });
});
