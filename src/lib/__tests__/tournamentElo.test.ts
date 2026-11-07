import { describe, expect, it } from 'vitest';
import { computeElo, currentSeason, ELO_START, eloSeasonFromArchive, eloSeasonFromCurrent, expectedScore, gameKey, isNewcomer, ratingOf, tournamentElo } from '../tournamentElo';
import { HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const g = (white: string, black: string, result: '1-0' | '0-1' | '½-½', end: number) => ({ white, black, result, end });
const r = (report: ReturnType<typeof computeElo>, h: string) => Math.round(report.ratings.get(h)! * 10) / 10;

describe('Elo del torneo', () => {
  it('uses the Elo formula with K = 32, everyone from 1500', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1500, 1700)).toBeCloseTo(0.24, 2);
    const rep = computeElo([{ key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] }]);
    expect(r(rep, 'anna')).toBe(1516);
    expect(r(rep, 'bruno')).toBe(1484);
    const draw = computeElo([{ key: 's1', players: [], games: [g('anna', 'bruno', '½-½', 1)] }]);
    expect(r(draw, 'anna')).toBe(ELO_START);
  });

  it('plays the games in the order they ended, and keeps the ratings at the start of each', () => {
    const rep = computeElo([{ key: 's1', players: [], games: [{ ...g('anna', 'carla', '1-0', 20), id: 'second' }, { ...g('anna', 'bruno', '1-0', 10), id: 'first' }] }]);
    expect(rep.before.get('first')).toEqual({ white: 1500, black: 1500, newcomer: true }); // first season: all esordienti
    expect(rep.before.get('second')!.white).toBe(1516);
  });

  it('in the first season everyone is an esordiente and every rating moves', () => {
    const rep = computeElo([{ key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] }]);
    expect([...rep.seasons[0].newcomers].sort()).toEqual(['anna', 'bruno']);
    expect(r(rep, 'bruno')).toBe(1484);
  });

  it('against an esordiente only the esordiente moves', () => {
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: 's2', players: ['anna', 'bruno', 'nuovo'], games: [g('nuovo', 'anna', '1-0', 2), g('bruno', 'anna', '½-½', 3)] },
    ]);
    const s2 = rep.seasons[1];
    expect([...s2.newcomers]).toEqual(['nuovo']);
    expect(r(rep, 'nuovo')).toBeCloseTo(1500 + 32 * (1 - expectedScore(1500, 1516)), 1);
    // anna lost to the esordiente: not counted for her, then drew with bruno (counted for both)
    expect(s2.start.get('anna')).toBe(1516);
    expect(r(rep, 'anna')).toBeCloseTo(1516 - 32 * (0.5 - expectedScore(1484, 1516)) , 1);
    expect(r(rep, 'bruno')).toBeCloseTo(1484 + 32 * (0.5 - expectedScore(1484, 1516)), 1);
  });

  it('a player back after skipping a season is an esordiente again, from the rating they had', () => {
    const rep = computeElo([
      { key: 's1', players: ['anna', 'bruno'], games: [g('anna', 'bruno', '1-0', 1)] },
      { key: 's2', players: ['bruno', 'carla'], games: [] },
      { key: 's3', players: ['anna', 'bruno', 'carla'], games: [g('anna', 'bruno', '1-0', 3)] },
    ]);
    const s3 = rep.seasons[2];
    expect(isNewcomer(s3, 'Anna')).toBe(true);
    expect(isNewcomer(s3, 'carla')).toBe(false);
    expect(s3.start.get('anna')).toBe(1516);
    expect(s3.end.get('bruno')).toBe(1484); // lost to an esordiente: unchanged
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
    expect(currentSeason(rep).start.get('anna')).toBe(1516 - 32 * (1 - expectedScore(1484, 1516)));
    expect(ratingOf(rep, 'Bruno')).toBeGreaterThan(1500);
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
    const vsBruno = expectedScore(1516, 1484);
    const vsNew = expectedScore(1516, 1500);
    // The games against the esordiente are left out
    void vsNew;
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
