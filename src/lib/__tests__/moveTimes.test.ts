import { describe, expect, it } from 'vitest';
import { collectFinishedGames, playerMoveTimes } from '../moveTimes';
import { HistoryGame, LichessExportGame } from '../../types';

const players = ['anna', 'bruno', 'carla'].map((h) => ({ handle: h, name: h }));
const H = 3600e3;
const ten = Array.from({ length: 10 }, () => 'e4').join(' ');
const g = (round: string, white: string, black: string, s: Partial<LichessExportGame>): HistoryGame => ({
  round,
  white,
  black,
  url: '',
  lichess: { id: '', status: 'mate', winner: 'white', moves: ten, createdAt: 1000, ...s } as LichessExportGame,
});

describe('collectFinishedGames', () => {
  it('keeps the finished games played on the board between known players', () => {
    const history = [
      g('1', 'anna', 'bruno', {}),
      g('1', 'carla', 'zeta', {}), // unknown player
      g('2', 'anna', 'carla', { status: 'aborted' }),
      g('2', 'bruno', 'carla', { status: 'forfeit' }),
      g('3', 'carla', 'anna', { status: 'started' }),
    ];
    expect(collectFinishedGames(players, history, {}).map((x) => `${x.white}-${x.black}`)).toEqual(['anna-bruno']);
  });
});

describe('playerMoveTimes', () => {
  const season = (extra: HistoryGame[] = []) =>
    collectFinishedGames(
      players,
      [
        g('1', 'anna', 'bruno', { lastMoveAt: 1000 + 20 * H }), // (1 + 3) / 2 · 10
        g('2', 'bruno', 'carla', { lastMoveAt: 1000 + 40 * H }), // (3 + 5) / 2 · 10
        g('3', 'carla', 'anna', { lastMoveAt: 1000 + 30 * H }), // (5 + 1) / 2 · 10
        ...extra,
      ],
      {}
    );
  it("tells each player's own time apart", () => {
    const t = playerMoveTimes(season());
    expect(t.get('anna')! / H).toBeCloseTo(1);
    expect(t.get('bruno')! / H).toBeCloseTo(3);
    expect(t.get('carla')! / H).toBeCloseTo(5);
  });
  it('adds a turn let run out to the loser', () => {
    const lost = g('4', 'anna', 'bruno', { status: 'outoftime', winner: 'white', daysPerTurn: 2, lastMoveAt: 1000 + 20 * H });
    expect(playerMoveTimes(season([lost])).get('bruno')!).toBeGreaterThan(playerMoveTimes(season()).get('bruno')!);
  });
  it('is empty when the games cannot tell the players apart', () => {
    expect(playerMoveTimes(season().slice(0, 1)).size).toBe(0);
  });
});
