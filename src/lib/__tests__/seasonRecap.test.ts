import { describe, expect, it } from 'vitest';
import { pillsburyRace, pillsburyStandings } from '../pillsbury';
import { computeElo, ELO_K } from '../tournamentElo';
import { seasonEloPath } from '../eloPath';
import { pillsburyLine } from '../../components/WrappedCard';
import { PillsburyEntry } from '../../types';

const g = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end, round: String(end) });

describe('the final race as the archive keeps it', () => {
  const players = ['anna', 'bruno', 'carla', 'elena'].map((h) => ({ handle: h, name: h }));
  const report = computeElo([
    { key: 's1', players: ['anna', 'bruno', 'carla', 'elena'], games: [g('anna', 'bruno', '1-0', 1), g('anna', 'carla', '1-0', 2)] },
    { key: 'current', players: ['anna', 'bruno', 'carla', 'elena'], games: [] },
  ]);
  const history = [
    { round: '1', white: 'carla', black: 'anna', url: 'https://lichess.org/aaaaaaaa' },
    { round: '1', white: 'bruno', black: 'elena', url: 'https://lichess.org/bbbbbbbb' },
  ];
  const states = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white' as const, lastMoveAt: 10 },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'resign', winner: 'white' as const, lastMoveAt: 11 },
  };
  const race = pillsburyRace(players, report, history, history, states);
  const final = pillsburyStandings(race)!;

  it('keeps every player of the race in its order, with the winner marked', () => {
    expect(final.map((r) => r.handle)).toEqual(race.rows.map((r) => r.handle));
    expect(final[0]).toMatchObject({ handle: race.rows[0].handle, place: 1, winner: true });
    expect(final.filter((r) => r.winner)).toHaveLength(1);
    final.forEach((r, i) => expect(r.score).toBeCloseTo(race.rows[i].score, 3));
  });

  it('is nothing when the trophy is suspended', () => {
    expect(pillsburyStandings({ ...race, suspended: true })).toBeUndefined();
  });
});

describe('the Pillsbury line of «La stagione in breve»', () => {
  const entry = (handle: string, points: number, objective: number, spread: number, place: number, winner?: true): PillsburyEntry => ({
    handle, points, played: 10, objective, spread, score: (points - objective) / spread, place, ...(winner ? { winner } : {}),
  });
  const race = [entry('anna', 7, 5.2, 0.9, 1, true), entry('bruno', 9, 6.6, 1.4, 2), entry('carla', 4, 5.4, 1.2, 3)];

  it('gives the objective, the gap, the margin and the place', () => {
    expect(pillsburyLine(race[1], race)).toBe(
      'Obiettivo 6½, fatti 9: 2½ in più. Il caso da solo può spostare circa ±1,4 punti: lo scarto esatto, +2,4, vale 1,7 volte questo margine. 2° su 3 nella corsa; chi l\'ha vinto: 2,0 volte.'
    );
    expect(pillsburyLine(race[0], race)).toContain('1° su 3 nella corsa: il più alto.');
  });

  it('says no ratio below the objective', () => {
    expect(pillsburyLine(race[2], race)).toBe('Obiettivo 5½, fatti 4: 1½ in meno. Il caso da solo può spostare circa ±1,2 punti. 3° su 3 nella corsa; chi l\'ha vinto: 2,0 volte.');
  });
});

describe('the Elo of a season, game after game', () => {
  const report = computeElo([
    { key: 's1', players: ['anna', 'bruno', 'carla'], games: [g('anna', 'bruno', '1-0', 1), g('carla', 'anna', '½-½', 2), g('bruno', 'carla', '0-1', 3)] },
    { key: 's2', players: ['anna', 'bruno', 'carla', 'dario'], games: [g('anna', 'bruno', '0-1', 4), g('dario', 'anna', '1-0', 5), g('anna', 'carla', '1-0', 6)] },
  ]);

  it('moves by K times the result beyond the expected one, and ends where the season ends', () => {
    const path = seasonEloPath(report, 'Anna', 's2')!;
    expect(path.steps.map((s) => s.opponent)).toEqual(['bruno', 'dario', 'carla']);
    expect(path.start).toBe(report.seasons[1].start.get('anna'));
    const [first, vsNewcomer, last] = path.steps;
    expect(first.after - first.before).toBeCloseTo(ELO_K * (0 - first.expected));
    // Dario is an esordiente: against him Anna's rating does not move
    expect(vsNewcomer.still).toBe(true);
    expect(vsNewcomer.after).toBe(vsNewcomer.before);
    expect(last.before).toBeCloseTo(first.after);
    expect(path.end).toBeCloseTo(last.after);
    expect(path.firstSeason).toBe(false);
    expect(path.performance).toBe(false);
  });

  it('ends at the performance after a first season', () => {
    const dario = seasonEloPath(report, 'dario', 's2')!;
    expect(dario.firstSeason).toBe(true);
    expect(dario.end).toBe(report.seasons[1].end.get('dario'));
  });

  it('is nothing for who did not play the season', () => {
    expect(seasonEloPath(report, 'dario', 's1')).toBeNull();
  });
});
