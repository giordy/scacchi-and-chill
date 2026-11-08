import { describe, expect, it } from 'vitest';
import { computeElo, CURRENT, currentSeason, ELO_START, eloSeasonFromArchive, eloSeasonFromCurrent, expectedScore, gameKey, isNewcomer, ratingOf, tournamentElo } from '../tournamentElo';
import { HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const g = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end });
const r = (report: ReturnType<typeof computeElo>, h: string) => Math.round(report.ratings.get(h)! * 10) / 10;

describe('Elo del torneo', () => {
  it('uses the Elo formula with K = 32, everyone from 1500, game after game', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1500, 1700)).toBeCloseTo(0.24, 2);
    // The season being played: plain Elo (the performance is only for archived seasons)
    const rep = computeElo([{ key: CURRENT, players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] }]);
    expect(r(rep, 'anna')).toBe(1516);
    expect(r(rep, 'bruno')).toBe(1484);
    const draw = computeElo([{ key: CURRENT, players: [], games: [g('anna', 'bruno', '½-½', 1)] }]);
    expect(r(draw, 'anna')).toBe(ELO_START);
  });

  it('plays the games in the order they ended, and keeps the ratings at the start of each', () => {
    const rep = computeElo([{ key: CURRENT, players: [], games: [{ ...g('anna', 'carla', '1-0', 20), id: 'second' }, { ...g('anna', 'bruno', '1-0', 10), id: 'first' }] }]);
    expect(rep.before.get('first')).toEqual({ white: 1500, black: 1500, newcomer: true }); // first season: all esordienti
    expect(rep.before.get('second')!.white).toBe(1516);
  });

  it('at the end of an archived first season, everyone gets their performance, centred on 1500', () => {
    // Anna won all, Bruno 1½, Carla ½
    const games = [g('anna', 'bruno', '1-0', 1), g('anna', 'carla', '1-0', 2), g('bruno', 'carla', '1-0', 3), g('carla', 'bruno', '½-½', 4)];
    const rep = computeElo([{ key: 's1', players: ['anna', 'bruno', 'carla'], games }]);
    expect([...rep.seasons[0].newcomers].sort()).toEqual(['anna', 'bruno', 'carla']);
    const [a, b, c] = ['anna', 'bruno', 'carla'].map((h) => rep.ratings.get(h)!);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect((a + b + c) / 3).toBeCloseTo(1500, 6);
    // Far wider than 14 games one at a time would reach: Anna is well ahead
    expect(a - c).toBeGreaterThan(300);
    expect(rep.seasons[0].end.get('anna')).toBe(a);
  });

  it('gives an esordiente of an archived season the performance against the others as they were', () => {
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: 's2', players: ['anna', 'bruno', 'nuovo'], games: [g('nuovo', 'anna', '1-0', 2), g('nuovo', 'bruno', '½-½', 3)] },
    ]);
    const s2 = rep.seasons[1];
    expect([...s2.newcomers]).toEqual(['nuovo']);
    // Performance: expected points (and the virtual draw against 1500) equal the points made
    const nuovo = rep.ratings.get('nuovo')!;
    const expected = expectedScore(nuovo, s2.start.get('anna')!) + expectedScore(nuovo, s2.start.get('bruno')!) + expectedScore(nuovo, 1500);
    expect(expected).toBeCloseTo(1.5 + 0.5, 3);
    // Against the esordiente the others did not move
    expect(rep.ratings.get('anna')).toBe(s2.start.get('anna'));
    expect(rep.ratings.get('bruno')).toBe(s2.start.get('bruno'));
  });

  it('against an esordiente only the esordiente moves, during the season', () => {
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: CURRENT, players: ['anna', 'bruno', 'nuovo'], games: [g('nuovo', 'anna', '1-0', 2), g('bruno', 'anna', '½-½', 3)] },
    ]);
    const s2 = rep.seasons[1];
    const [a0, b0] = [s2.start.get('anna')!, s2.start.get('bruno')!];
    expect(rep.ratings.get('nuovo')).toBeCloseTo(1500 + 32 * (1 - expectedScore(1500, a0)), 6);
    // anna lost to the esordiente: not counted for her, then drew with bruno (counted for both)
    expect(rep.ratings.get('anna')).toBeCloseTo(a0 + 32 * (0.5 - expectedScore(a0, b0)), 6);
    expect(rep.ratings.get('bruno')).toBeCloseTo(b0 + 32 * (0.5 - expectedScore(b0, a0)), 6);
  });

  it('a player back after skipping a season is a regular, from the rating they had', () => {
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: 's2', players: ['bruno', 'carla'], games: [] },
      { key: CURRENT, players: ['anna', 'bruno', 'carla'], games: [g('anna', 'bruno', '1-0', 3)] },
    ]);
    const s3 = rep.seasons[2];
    expect(isNewcomer(s3, 'Anna')).toBe(false);
    expect(s3.firstSeason.has('anna')).toBe(false);
    expect(isNewcomer(s3, 'carla')).toBe(false);
    expect(s3.start.get('anna')).toBe(rep.seasons[0].end.get('anna'));
    expect(s3.end.get('bruno')).toBeLessThan(s3.start.get('bruno')!); // lost to a regular: it moves
  });

  describe('a seed (the Lichess rating of an esordiente, on the tournament scale)', () => {
    const s1 = { key: 's1', players: ['anna', 'bruno', 'carla'], games: [g('anna', 'bruno', '1-0', 1), g('bruno', 'carla', '½-½', 2), g('carla', 'anna', '0-1', 3)] };

    it('makes a newcomer start from it and count as a regular from the first game', () => {
      const rep = computeElo([s1, { key: CURRENT, players: ['anna', 'bruno', 'carla', 'dario'], seeds: { Dario: 1650 }, games: [{ ...g('dario', 'bruno', '1-0', 5), id: 'd1' }] }]);
      const now = rep.seasons[1];
      expect(now.start.get('dario')).toBe(1650);
      expect(isNewcomer(now, 'dario')).toBe(false); // in the race, games against him count
      expect(now.firstSeason.has('dario')).toBe(true);
      expect(rep.before.get('d1')).toEqual({ white: 1650, black: now.start.get('bruno'), newcomer: false }); // can be a colpaccio
      expect(now.end.get('bruno')).toBeLessThan(now.start.get('bruno')!); // both move
      expect(now.end.get('dario')).toBeGreaterThan(1650);
    });

    it('leaves a newcomer without one an esordiente, as before', () => {
      const rep = computeElo([s1, { key: CURRENT, players: ['anna', 'bruno', 'carla', 'dario', 'elena'], seeds: { dario: 1650 }, games: [g('elena', 'bruno', '1-0', 5)] }]);
      const now = rep.seasons[1];
      expect(isNewcomer(now, 'elena')).toBe(true);
      expect(now.start.get('elena')).toBe(ELO_START);
      expect(now.end.get('bruno')).toBe(now.start.get('bruno')); // lost to an esordiente: unchanged
    });

    it('is replaced by the performance at the end of the first season, as a 1500 start is', () => {
      const season = (seeds?: Record<string, number>) =>
        computeElo([s1, { key: 's2', players: ['anna', 'bruno', 'carla', 'dario'], seeds, games: [g('dario', 'bruno', '1-0', 5), g('anna', 'dario', '½-½', 6), g('dario', 'carla', '1-0', 7)] }]);
      const seeded = season({ dario: 1400 });
      expect(seeded.seasons[1].start.get('dario')).toBe(1400);
      // The performance is solved against the opponents' ratings in each game: close, whatever the start
      expect(Math.abs(seeded.ratings.get('dario')! - season().ratings.get('dario')!)).toBeLessThan(25);
      expect(seeded.ratings.get('dario')).toBeGreaterThan(1600);
    });

    it('is what a performance on few games leans on, instead of 1500', () => {
      // A substitute with one draw against Bruno: their performance is pulled towards what was known of them
      const season = (seeds?: Record<string, number>) =>
        computeElo([s1, { key: 's2', players: ['anna', 'bruno', 'carla', 'dario'], seeds, games: [g('dario', 'bruno', '½-½', 5)] }]).ratings.get('dario')!;
      expect(season({ dario: 1800 })).toBeGreaterThan(season() + 100);
      expect(season({ dario: 1800 })).toBeLessThan(1800); // the draw against a weaker player still counts
    });

    it('is read back from an archived season, without the seeds that have no rating', () => {
      const archive: SeasonArchive = {
        id: 's2', season: 's2', title: 'T', archivedAt: '2027-01-01', gamesPlayed: 0, standings: [],
        seeds: [{ handle: 'Dario', rating: 1650, date: '2026-09-08' }, { handle: 'elena', rating: null, date: '2026-09-08' }],
      };
      expect(eloSeasonFromArchive(archive).seeds).toEqual({ dario: 1650 });
    });

    it('is ignored in the very first season, where everyone is an esordiente', () => {
      const rep = computeElo([{ ...s1, seeds: { anna: 1900 } }]);
      expect(rep.seasons[0].start.get('anna')).toBe(ELO_START);
      expect(isNewcomer(rep.seasons[0], 'anna')).toBe(true);
    });
  });

  it('leaves out the games decided at the table: forfeits and games closed for cheating', () => {
    const history: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa' },
      { round: '2', white: 'carla', black: 'anna', url: 'https://lichess.org/bbbbbbbb' },
    ];
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'white', lastMoveAt: 1 },
      bbbbbbbb: { id: 'bbbbbbbb', status: 'resign', winner: 'white', lastMoveAt: 2 },
    };
    expect(eloSeasonFromCurrent(['anna', 'bruno', 'carla'], history, states).games.map((x) => x.round)).toEqual(['2']);
    const archive = {
      id: 's1', season: 's1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: 2, standings: [],
      games: [
        { round: '1', white: 'anna', black: 'bruno', result: '1-0' as const, status: 'cheat' },
        { round: '2', white: 'anna', black: 'carla', result: '1-0' as const, status: 'forfeit' },
        { round: '3', white: 'bruno', black: 'carla', result: '0-1' as const, status: 'mate' },
      ],
    } as SeasonArchive;
    expect(eloSeasonFromArchive(archive).games.map((x) => x.round)).toEqual(['3']);
  });

  it('reads archived seasons in the order they were closed, forfeits left out, then the current one', () => {
    const archive = (id: string, archivedAt: string, games: SeasonArchive['games']): SeasonArchive => ({
      id, season: id, title: 'T', archivedAt, gamesPlayed: 0, games,
      standings: [{ handle: 'anna', name: 'Anna', played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 }, { handle: 'bruno', name: 'Bruno', played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 }],
    });
    const later = archive('s2', '2027-01-01', [{ round: '1', white: 'anna', black: 'bruno', result: '0-1', end: 5 }, { round: '2', white: 'anna', black: 'bruno', result: '1-0', status: 'forfeit' }]);
    const first = archive('s1', '2026-01-01', [{ round: '1', white: 'anna', black: 'bruno', result: '1-0', end: 1, id: 'abc' }]);
    expect(eloSeasonFromArchive(later).games).toHaveLength(1);
    const history: HistoryGame[] = [{ round: '1', white: 'bruno', black: 'anna', url: 'https://lichess.org/cccccccc' }];
    const states: Record<string, LichessExportGame> = { cccccccc: { id: 'cccccccc', status: 'mate', winner: 'white', lastMoveAt: 9 } };
    expect(eloSeasonFromCurrent(['anna', 'bruno'], history, states).games[0]).toMatchObject({ result: '1-0', id: 'cccccccc' });
    const rep = tournamentElo([later, first], ['anna', 'bruno'], history, states);
    expect(rep.seasons.map((s) => s.key)).toEqual(['s1', 's2', 'current']);
    expect(rep.before.get('abc')).toEqual({ white: 1500, black: 1500, newcomer: true });
    // After s1 Anna leads; in s2 Bruno beat her
    expect(rep.seasons[1].start.get('anna')).toBeGreaterThan(rep.seasons[1].start.get('bruno')!);
    expect(currentSeason(rep).start.get('anna')).toBeLessThan(rep.seasons[1].start.get('anna')!);
    expect(ratingOf(rep, 'Bruno')).toBeGreaterThan(Math.round(currentSeason(rep).start.get('bruno')!));
    expect(gameKey({ round: '2', white: 'Anna', black: 'bruno' }, 's2')).toBe('s2|2|anna|bruno');
  });
});

describe('pronostico', () => {
  it('adds up the expected points against the opponents of the calendar, from the season start', async () => {
    const { seasonForecast } = await import('../tournamentElo');
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: 'current', players: ['anna', 'bruno', 'nuovo'], games: [g('bruno', 'anna', '1-0', 2)] },
    ]);
    const season = rep.seasons[1];
    const calendar = [
      { white: 'anna', black: 'bruno' }, { white: 'bruno', black: 'anna' },
      { white: 'anna', black: 'nuovo' }, { white: 'nuovo', black: 'anna' },
    ];
    const f = seasonForecast('Anna', season, calendar, [g('bruno', 'anna', '1-0', 2)])!;
    // The games against the esordiente are left out
    const vsBruno = expectedScore(season.start.get('anna')!, season.start.get('bruno')!);
    expect(f.games).toBe(2);
    expect(f.expected).toBeCloseTo(2 * vsBruno, 6);
    expect(f).toMatchObject({ played: 1, points: 0 });
    expect(f.expectedSoFar).toBeCloseTo(vsBruno, 6);
    expect(seasonForecast('nuovo', season, calendar, [])).toBeNull(); // esordiente
  });
});

describe('substitutes', () => {
  const row = (handle: string) => ({ handle, name: handle, played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 });
  // Greta beat Anna in round 1, then left; Sub took her place and lost to Anna in round 2. The
  // archive gives both games to Sub, as the standings do.
  const archive = (fromRound?: string): SeasonArchive => ({
    id: 's1', season: 's1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: 2,
    standings: ['anna', 'sub'].map(row),
    games: [
      { round: '1', white: 'sub', black: 'anna', result: '1-0', end: 1 },
      { round: '2', white: 'anna', black: 'sub', result: '1-0', end: 2 },
    ],
    departures: [{ handle: 'greta', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'sub', name: 'Sub' }, ...(fromRound ? { fromRound } : {}) }],
  });

  it('give back to who left the games before the round the substitute started from', () => {
    const input = eloSeasonFromArchive(archive('2'));
    expect(input.games.map((x) => x.white)).toEqual(['greta', 'anna']);
    const rep = tournamentElo([archive('2')], ['anna', 'sub'], [], {});
    expect(isNewcomer(currentSeason(rep), 'sub')).toBe(false); // kept for this season
    expect(rep.ratings.get('greta')).toBeGreaterThan(1500);
    expect(rep.ratings.get('sub')).toBeLessThan(1500);
  });

  it('can be told apart by a date, for seasons archived without the rounds', () => {
    const old: SeasonArchive = { ...archive(), games: archive().games!.map((g) => ({ ...g, round: '–' })) };
    old.departures = [{ ...old.departures![0], fromDate: '1970-01-01T00:00:00.002Z' }]; // between the two games
    expect(eloSeasonFromArchive(old).games.map((x) => x.white)).toEqual(['greta', 'anna']);
    // A round given for games without rounds is not used
    old.departures = [{ ...old.departures![0], fromDate: undefined, fromRound: '2' }];
    expect(eloSeasonFromArchive(old).games.map((x) => x.white)).toEqual(['sub', 'anna']);
  });

  it('are esordienti in the next season when their first round is not known', () => {
    const rep = tournamentElo([archive()], ['anna', 'sub'], [], {});
    expect(isNewcomer(currentSeason(rep), 'sub')).toBe(true);
    expect(isNewcomer(currentSeason(rep), 'anna')).toBe(false);
  });

  it('in the current season, the games are of who played them on Lichess', async () => {
    const { playersOnBoard } = await import('../tournamentElo');
    const g = { round: '1', white: 'sub', black: 'anna', url: 'https://lichess.org/aaaaaaaa' };
    const s = { id: 'aaaaaaaa', status: 'mate', winner: 'white' as const, players: { white: { user: { id: 'greta' } }, black: { user: { id: 'Anna' } } } };
    expect(playersOnBoard(g, s, ['sub', 'anna'])).toEqual({ white: 'greta', black: 'anna' });
    expect(playersOnBoard(g, undefined, ['sub', 'anna'])).toEqual({ white: 'sub', black: 'anna' });
    expect(eloSeasonFromCurrent(['sub', 'anna'], [g], { aaaaaaaa: s }).games[0]).toMatchObject({ white: 'greta', black: 'anna' });
  });
});
