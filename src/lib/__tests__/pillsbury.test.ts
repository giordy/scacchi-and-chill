import { describe, expect, it } from 'vitest';
import { objectiveReached, pillsburyRace, pillsburyWins, reigningPillsbury } from '../pillsbury';
import { computeElo } from '../tournamentElo';
import { parsePublicView, publicViewHref, tabOfView } from '../routes';
import { SeasonArchive } from '../../types';

const players = ['anna', 'bruno', 'carla', 'dario', 'elena'].map((h) => ({ handle: h, name: h }));
const g = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end, round: String(end) });

describe('the race for the Trofeo Pillsbury', () => {
  // Last season Anna beat Bruno and Carla: this season Carla beats Anna, Bruno loses to Carla
  const report = computeElo([
    { key: 's1', players: ['anna', 'bruno', 'carla', 'elena'], games: [g('anna', 'bruno', '1-0', 1), g('anna', 'carla', '1-0', 2)] },
    { key: 'current', players: ['anna', 'bruno', 'carla', 'dario', 'elena'], games: [] },
  ]);
  const history = [
    { round: '1', white: 'carla', black: 'anna', url: 'https://lichess.org/aaaaaaaa' },
    { round: '1', white: 'bruno', black: 'carla', url: 'https://lichess.org/bbbbbbbb' },
    { round: '1', white: 'dario', black: 'anna', url: 'https://lichess.org/cccccccc' },
  ];
  const states = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white' as const, lastMoveAt: 10 },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'resign', winner: 'black' as const, lastMoveAt: 11 },
    cccccccc: { id: 'cccccccc', status: 'resign', winner: 'white' as const, lastMoveAt: 12 },
  };
  const race = pillsburyRace(players, report, history, history, states);

  it('orders who played by the points beyond the pronostico, with an arrow each', () => {
    expect(race.rows.map((r) => r.handle)).toEqual(['carla', 'bruno', 'anna']);
    expect(race.rows[0].trend).toBe('up');
    expect(race.rows.map((r) => r.trend)).toContain('down');
  });

  it('keeps apart who has not played a game that counts, and the esordienti', () => {
    expect(race.waiting).toEqual(['elena']);
    // The games that count, played of all: Carla played Anna and Bruno; Dario, an esordiente, has none
    expect(race.counted.carla).toEqual({ played: 2, games: 2 });
    expect(race.counted.elena).toEqual({ played: 0, games: 0 });
    expect(race.counted.dario).toBeUndefined();
    expect(race.newcomers).toEqual(['dario']);
  });
});

describe('the race, with who left and the games won at the table', () => {
  const report = computeElo([
    { key: 's1', players: ['anna', 'bruno', 'carla', 'elena'], games: [g('anna', 'bruno', '1-0', 1), g('carla', 'elena', '1-0', 2)] },
    { key: 'current', players: ['anna', 'bruno', 'carla', 'elena'], games: [] },
  ]);
  const four = players.filter((p) => p.handle !== 'dario');
  // Bruno beat Anna, then left: his game against Carla is a forfeit (a win for Carla at the table)
  const history = [
    { round: '1', white: 'bruno', black: 'anna', url: 'https://lichess.org/aaaaaaaa' },
    { round: '2', white: 'carla', black: 'bruno', url: '', lichess: { id: '', status: 'forfeit', winner: 'white' as const } },
    { round: '2', white: 'anna', black: 'elena', url: 'https://lichess.org/bbbbbbbb' },
  ];
  const states = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white' as const, lastMoveAt: 10 },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'aborted' },
  };
  const withdrawals = [{ handle: 'bruno', name: 'bruno', mode: 'forfeit' as const, played: 1, total: 3, at: '2026-11-01' }];
  const race = pillsburyRace(four, report, history, history, states as never, withdrawals as never);

  it('leaves out who left the season, though their name stays in the list (forfeits)', () => {
    expect([...race.rows, ...race.waiting.map((handle) => ({ handle }))].map((r) => r.handle)).not.toContain('bruno');
    expect(race.forecasts.bruno).toBeUndefined();
    // Without the withdrawal Bruno would lead the race with his win
    expect(pillsburyRace(four, report, history, history, states as never).rows[0].handle).toBe('bruno');
  });

  it('makes no objective of a forfeit or an aborted game', () => {
    // Carla's only game is a forfeit, Anna's second was aborted: no game that counts for either
    expect(race.counted.carla).toEqual({ played: 0, games: 0 });
    expect(race.counted.anna).toEqual({ played: 1, games: 1 }); // the game lost to Bruno, played
  });
});

describe('the reigning Trofeo Pillsbury', () => {
  const season = (id: string, archivedAt: string, winner?: string): SeasonArchive => ({
    id, season: id, title: 'T', archivedAt, standings: [], gamesPlayed: 0,
    awards: winner ? [{ id: 'pillsbury', emoji: '🌱', title: 'Trofeo Pillsbury', description: '', winners: [{ handle: winner, name: winner }], detail: '' }] : [],
  });
  const seasons = [season('s1', '2026-01-01'), season('s2', '2027-01-01', 'Carla'), season('s3', '2028-01-01', 'bruno'), season('s4', '2029-01-01')];

  it('is the winner of the latest season that gave it', () => {
    expect(reigningPillsbury(seasons)).toEqual({ season: 's3', handles: ['bruno'] });
    expect(reigningPillsbury([seasons[0]])).toBeUndefined();
    expect(pillsburyWins('carla', seasons)).toEqual(['s2']);
  });
});

describe('the Pillsbury view', () => {
  it('has its own address, under the standings tab', () => {
    expect(publicViewHref('pillsbury')).toBe('#/pillsbury');
    expect(parsePublicView('#/pillsbury')).toBe('pillsbury');
    expect(tabOfView('pillsbury')).toBe('standings');
  });
});

describe('objectiveReached', () => {
  const f = (expected: number, points: number) => ({ expected, games: 6, expectedSoFar: 0, points, played: 3 });
  it('compares the points with the objective as shown, to the half point', () => {
    expect(objectiveReached(f(2.3, 2.5))).toBe(true); // objective 2½
    expect(objectiveReached(f(2.3, 2))).toBe(false);
    expect(objectiveReached(f(1.1, 1))).toBe(true); // objective 1
  });
  it('never counts an objective of zero as reached', () => {
    expect(objectiveReached(f(0.2, 0))).toBe(false);
  });
});
