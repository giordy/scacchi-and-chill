import { describe, expect, it } from 'vitest';
import { pillsburyRace, pillsburyWins, reigningPillsbury } from '../pillsbury';
import { computeElo } from '../tournamentElo';
import { parsePublicView, publicViewHref, tabOfView } from '../routes';
import { SeasonArchive } from '../../types';

const players = ['anna', 'bruno', 'carla', 'dario', 'elena'].map((h) => ({ handle: h, name: h }));
const g = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end, round: String(end) });

describe('the race for the Premio Pillsbury', () => {
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

describe('the reigning Premio Pillsbury', () => {
  const season = (id: string, archivedAt: string, winner?: string): SeasonArchive => ({
    id, season: id, title: 'T', archivedAt, standings: [], gamesPlayed: 0,
    awards: winner ? [{ id: 'pillsbury', emoji: '🌱', title: 'Premio Pillsbury', description: '', winners: [{ handle: winner, name: winner }], detail: '' }] : [],
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

describe('forma', () => {
  it('reads the last 3 games that count (none with an esordiente), against the Elo of each game', async () => {
    const { formOf } = await import('../pillsbury');
    const { computeElo } = await import('../tournamentElo');
    const game = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end, round: String(end), id: `g${end}` });
    const games = [
      game('anna', 'bruno', '1-0', 1), // three wins that count: on fire
      game('anna', 'carla', '1-0', 2),
      game('nuova', 'anna', '1-0', 3), // a loss to an esordiente: left out
      game('anna', 'bruno', '1-0', 4),
      game('bruno', 'carla', '½-½', 5),
      game('carla', 'bruno', '½-½', 6),
    ];
    const report = computeElo([
      { key: 's1', players: ['anna', 'bruno', 'carla'], games: [] },
      { key: 'current', players: ['anna', 'bruno', 'carla', 'nuova'], games },
    ]);
    expect(formOf('anna', report, games)).toBe('fire');
    expect(formOf('carla', report, games)).toBe('calm'); // a loss and two draws, nothing unexpected
    expect(formOf('nuova', report, games)).toBeUndefined(); // one game only
    const losses = [game('anna', 'bruno', '0-1', 1), game('carla', 'anna', '1-0', 2), game('anna', 'carla', '0-1', 3)];
    const r2 = computeElo([{ key: 's1', players: ['anna', 'bruno', 'carla'], games: [] }, { key: 'current', players: [], games: losses }]);
    expect(formOf('anna', r2, losses)).toBe('rain');
  });
});
