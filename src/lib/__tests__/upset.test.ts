import { describe, expect, it } from 'vitest';
import { bestUpset, upsetFrom, upsetOf, upsetSentence, UPSET_DRAW_GAP, UPSET_WIN_GAP } from '../upset';
import { computeElo, CURRENT, EloReport, gameKey } from '../tournamentElo';
import { computeSeasonAwards } from '../awards';
import { HistoryGame, LichessExportGame } from '../../types';

describe('colpaccio', () => {
  it('is a win against an opponent with at least 200 points more of Elo del torneo', () => {
    expect(UPSET_WIN_GAP).toBe(200);
    expect(upsetFrom('1-0', { white: 1400, black: 1620 })).toEqual({ kind: 'win', player: 'white', gap: 220 });
    expect(upsetFrom('0-1', { white: 1700, black: 1500 })).toEqual({ kind: 'win', player: 'black', gap: 200 });
    expect(upsetFrom('1-0', { white: 1400, black: 1599 })).toBeNull();
    expect(upsetFrom('1-0', { white: 1700, black: 1400 })).toBeNull(); // the favourite won
  });

  it('is also a draw against an opponent with at least 400 points more', () => {
    expect(UPSET_DRAW_GAP).toBe(400);
    expect(upsetFrom('½-½', { white: 1900, black: 1480 })).toEqual({ kind: 'draw', player: 'black', gap: 420 });
    expect(upsetFrom('½-½', { white: 1400, black: 1800 })).toEqual({ kind: 'draw', player: 'white', gap: 400 });
    expect(upsetFrom('½-½', { white: 1400, black: 1750 })).toBeNull();
  });

  it('needs a result and the ratings', () => {
    expect(upsetFrom(null, { white: 1000, black: 2000 })).toBeNull();
    expect(upsetFrom('1-0', undefined)).toBeNull();
  });

  it('reads the Elo del torneo the two players had when the game started', () => {
    // Last season Anna beat Bruno five times: this season Bruno, far below, beats her
    const games = [1, 2, 3, 4, 5].map((n) => ({ white: 'anna', black: 'bruno', result: '1-0' as const, end: n, round: String(n) }));
    const report = computeElo([
      { key: 's1', players: [], games },
      { key: CURRENT, players: ['anna', 'bruno'], games: [{ white: 'bruno', black: 'anna', result: '1-0', end: 9, round: '6', id: 'last' }] },
    ]);
    const state: LichessExportGame = { id: 'last', status: 'resign', winner: 'white' };
    const u = upsetOf(state, report, { round: '6', white: 'bruno', black: 'anna', id: 'last' });
    expect(u).toMatchObject({ kind: 'win', player: 'white' });
    expect(u!.gap).toBeGreaterThanOrEqual(UPSET_WIN_GAP);
    expect(upsetOf({ ...state, status: 'forfeit' }, report, { round: '6', white: 'bruno', black: 'anna', id: 'last' })).toBeNull();
    expect(upsetSentence(u!, 'Bruno')).toBe("Bruno ha battuto un avversario molto più forte, secondo l'Elo del torneo");
    expect(upsetSentence({ kind: 'draw', player: 'white', gap: 250 }, 'Bruno')).toBe("Bruno ha pareggiato con un avversario molto più forte, secondo l'Elo del torneo");
  });

  it('never happens in a game with an esordiente', () => {
    expect(upsetFrom('1-0', { white: 1300, black: 1700, newcomer: true })).toBeNull();
    // In the very first season everyone is an esordiente
    const report = computeElo([{ key: CURRENT, players: [], games: [{ white: 'anna', black: 'bruno', result: '1-0', end: 1, round: '1', id: 'x' }] }]);
    expect(upsetOf({ id: 'x', status: 'resign', winner: 'white' }, report, { round: '1', white: 'anna', black: 'bruno', id: 'x' })).toBeNull();
  });
});

describe('season awards', () => {
  it("no longer give L'ammazzagiganti", () => {
    const players = [
      { name: 'Anna', handle: 'anna' },
      { name: 'Bruno', handle: 'bruno' },
    ];
    const history: HistoryGame[] = [{ round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa' }];
    const states = { aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white' as const } };
    expect(computeSeasonAwards(players, history, states).some((a) => a.id === 'upsets')).toBe(false);
  });
});

describe('best colpaccio of a player', () => {
  const game = (white: string, black: string, result: '1-0' | '0-1' | '½-½', round: string) => ({ white, black, result, round, id: `g${round}` });
  const report = (games: { season: string; game: ReturnType<typeof game>; ratings: { white: number; black: number } }[]) =>
    ({
      seasons: [],
      ratings: new Map(),
      peaks: new Map(),
      played: games.map(({ season, game }) => ({ season, game })),
      before: new Map(games.map(({ season, game, ratings }) => [gameKey(game, season), { ...ratings, newcomer: false }])),
    }) as EloReport;

  it('is a win before any draw, then the largest gap, then the earliest', () => {
    const rep = report([
      { season: 's1', game: game('anna', 'bruno', '½-½', '1'), ratings: { white: 1400, black: 1900 } }, // draw, 500
      { season: 's1', game: game('carla', 'anna', '0-1', '2'), ratings: { white: 1650, black: 1400 } }, // win, 250
      { season: CURRENT, game: game('anna', 'dario', '1-0', '3'), ratings: { white: 1450, black: 1700 } }, // win, 250: later
      { season: CURRENT, game: game('anna', 'bruno', '1-0', '4'), ratings: { white: 1700, black: 1500 } }, // the favourite won
    ]);
    expect(bestUpset(rep, 'Anna')).toMatchObject({ season: 's1', opponent: 'carla', upset: { kind: 'win', gap: 250 } });
    // A draw when there is no win
    expect(bestUpset(report([{ season: 's1', game: game('anna', 'bruno', '½-½', '1'), ratings: { white: 1400, black: 1900 } }]), 'anna')).toMatchObject({
      opponent: 'bruno',
      upset: { kind: 'draw' },
    });
  });

  it('is only of who pulled it off', () => {
    const rep = report([{ season: 's1', game: game('anna', 'bruno', '0-1', '1'), ratings: { white: 1800, black: 1500 } }]);
    expect(bestUpset(rep, 'bruno')?.opponent).toBe('anna');
    expect(bestUpset(rep, 'anna')).toBeUndefined();
  });

  it('reads the games of every season from the Elo del torneo', () => {
    const games = [1, 2, 3, 4, 5].map((n) => ({ white: 'anna', black: 'bruno', result: '1-0' as const, end: n, round: String(n) }));
    const rep = computeElo([
      { key: 's1', players: [], games },
      { key: CURRENT, players: ['anna', 'bruno'], games: [{ white: 'bruno', black: 'anna', result: '1-0', end: 9, round: '6', id: 'last' }] },
    ]);
    expect(bestUpset(rep, 'bruno')).toMatchObject({ season: CURRENT, opponent: 'anna', game: { id: 'last' } });
    expect(bestUpset(rep, 'anna')).toBeUndefined(); // the first season had only esordienti
  });
});
