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
  // Own times: Anna 1 h, Bruno 3 h, Carla 5 h per move; each pair meets twice (10 half-moves a game)
  const season = (extra: HistoryGame[] = [], rounds = 2) =>
    collectFinishedGames(
      players,
      [
        ...Array.from({ length: rounds }, (_, r) => [
          g(`${3 * r + 1}`, 'anna', 'bruno', { lastMoveAt: 1000 + 20 * H }), // (1 + 3) / 2 · 10
          g(`${3 * r + 2}`, 'bruno', 'carla', { lastMoveAt: 1000 + 40 * H }), // (3 + 5) / 2 · 10
          g(`${3 * r + 3}`, 'carla', 'anna', { lastMoveAt: 1000 + 30 * H }), // (5 + 1) / 2 · 10
        ]).flat(),
        ...extra,
      ],
      {}
    );
  it("tells each player's own time apart, closer to the season average while the games are few", () => {
    const few = playerMoveTimes(season());
    expect(few.get('anna')!).toBeLessThan(few.get('bruno')!);
    expect(few.get('bruno')!).toBeLessThan(few.get('carla')!);
    // The season average is 3 h: each estimate lies between it and the true time
    expect(few.get('anna')! / H).toBeGreaterThan(1);
    expect(few.get('carla')! / H).toBeLessThan(5);
    // With many games, the own games decide
    const many = playerMoveTimes(season([], 400));
    expect(many.get('anna')! / H).toBeCloseTo(1, 1);
    expect(many.get('bruno')! / H).toBeCloseTo(3, 1);
    expect(many.get('carla')! / H).toBeCloseTo(5, 1);
  });
  it('never goes below zero when a quick player meets only slow ones', () => {
    // Each game alone fits exactly with Anna at zero (or below): the average holds her up
    const history = [
      g('1', 'anna', 'bruno', { lastMoveAt: 1000 + 15 * H }),
      g('2', 'anna', 'carla', { lastMoveAt: 1000 + 20 * H }),
      g('3', 'bruno', 'carla', { lastMoveAt: 1000 + 45 * H }),
      g('4', 'carla', 'anna', { lastMoveAt: 1000 + 25 * H }),
      g('5', 'bruno', 'anna', { lastMoveAt: 1000 + 10 * H }),
      g('6', 'carla', 'bruno', { lastMoveAt: 1000 + 50 * H }),
    ];
    const t = playerMoveTimes(collectFinishedGames(players, history, {}));
    expect(t.get('anna')! / H).toBeGreaterThan(0.5);
  });
  it('adds a turn let run out to the loser', () => {
    const lost = g('7', 'anna', 'bruno', { status: 'outoftime', winner: 'white', daysPerTurn: 2, lastMoveAt: 1000 + 20 * H });
    expect(playerMoveTimes(season([lost])).get('bruno')!).toBeGreaterThan(playerMoveTimes(season()).get('bruno')!);
  });
  it('waits for three games of each player', () => {
    expect(playerMoveTimes(season([], 1)).size).toBe(0);
  });
  it('is empty when the games cannot tell the players apart', () => {
    expect(playerMoveTimes(season().slice(0, 1)).size).toBe(0);
  });
});
