// Elo del torneo: a rating of each player computed only from the games of this tournament, with
// the classic Elo formula (K = 32), game after game in the order they ended, from the first archived
// season to the current one. Everyone starts at 1500; at the end of a player's first season their
// rating becomes their performance in it (see performanceRatings), as FIDE does for a first rating.
//
// First season: a player who never played a season before (a player back from a break is a
// regular, with the rating they had). Their first rating is set as follows:
// - with a seed (see lib/seeds.ts: their Lichess rating, 30 days before their first game, moved
//   onto the tournament's scale) they start from it and count as a regular from the first game:
//   both ratings move, their games count for objectives, the Trofeo Pillsbury and colpacci;
// - without one they are an esordiente: they start at 1500, in their games only their own rating
//   moves (the others neither lose nor gain against someone whose level is not known yet), and
//   they are out of the race for the Trofeo Pillsbury.
// Either way, at the end of their first season their rating becomes their performance in it.
//
// Lichess ratings are used only for that first step: for correspondence they are provisional for
// almost everyone here, and they also depend on games played outside the tournament.
import { EloSeed, HistoryGame, LichessExportGame, SeasonArchive, SeasonDeparture } from '../types';
import { byRound, stateOf, isVoid } from './games';
import { scoredResult } from './standings';
import { extractGameId } from './utils';

export const ELO_START = 1500;
export const ELO_K = 32;

export type EloResult = '1-0' | '0-1' | '½-½';

export interface EloGame {
  white: string;
  black: string;
  result: EloResult;
  end?: number; // last move, ms: the order of the games
  round?: string;
  id?: string; // Lichess game id
}

export interface EloSeasonInput {
  key: string; // the archive id, or CURRENT for the season being played
  players: string[]; // who played the season (games or standings)
  games: EloGame[];
  // Players whose rating of this season is not only theirs (a substitute whose first round is not
  // known): in their first season again in the next one
  doubtful?: string[];
  // Starting ratings of players in their first season, by handle (see lib/seeds.ts)
  seeds?: Record<string, number>;
}

export interface EloSeason {
  key: string;
  start: Map<string, number>; // ratings at the start of the season, of the players of the season
  end: Map<string, number>; // ratings at the end (or now, for the current season)
  newcomers: Set<string>; // esordienti of the season: in their first season, without a seed
  firstSeason: Set<string>; // everyone in their first season, seeded or not
}

export interface EloReport {
  seasons: EloSeason[]; // oldest first, the current one last
  ratings: Map<string, number>; // everyone's latest rating
  // Ratings of the two players when the game started (before its result), by gameKey, and
  // whether either was an esordiente (then the game is no colpaccio)
  before: Map<string, { white: number; black: number; newcomer: boolean }>;
}

export const CURRENT = 'current';

// The seeds with a rating, by handle, as computeElo takes them (a seed without one leaves an esordiente)
export const seedRatings = (seeds: EloSeed[] | undefined): Record<string, number> =>
  Object.fromEntries((seeds ?? []).filter((s) => typeof s.rating === 'number').map((s) => [s.handle.toLowerCase(), s.rating as number]));

// Expected score of a player rated `a` against one rated `b`
export const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

const scoreOf = (r: EloResult) => (r === '1-0' ? 1 : r === '0-1' ? 0 : 0.5);
const lower = (h: string) => h.toLowerCase();

// The key a game is found by: its Lichess id, or who played it in which round
export const gameKey = (g: { id?: string; round?: string; white: string; black: string }, season = '') =>
  g.id || `${season}|${g.round ?? ''}|${lower(g.white)}|${lower(g.black)}`;

// Performance ratings of the esordienti of a season: the ratings that make the expected points of
// each equal to the points they made, over all their games of the season at once (as FIDE gives a
// first rating from a performance). The opponents who are not esordienti keep the rating they had
// in each game; esordienti are solved together. One virtual draw each keeps a perfect or empty score
// finite: against a 1500 player, or against their seed for who has one (what was known of them before
// the season; a substitute with few games then stays near it rather than near 1500). When everyone is
// an esordiente (the first season) the scale is centred on 1500.
export function performanceRatings(
  games: EloGame[],
  newcomers: Set<string>,
  ratingsAt: (g: EloGame) => { white: number; black: number },
  priors?: Map<string, number> // seeds, by handle in lower case
): Map<string, number> {
  const played = games.filter((g) => newcomers.has(lower(g.white)) || newcomers.has(lower(g.black)));
  const who = [...new Set(played.flatMap((g) => [lower(g.white), lower(g.black)]).filter((h) => newcomers.has(h)))];
  const prior = (h: string) => priors?.get(h) ?? ELO_START;
  const fit = new Map(who.map((h) => [h, prior(h)]));
  if (who.length === 0) return fit;
  // Newton's method, one player at a time on the diagonal: a few dozen steps, not thousands
  const LN = Math.LN10 / 400;
  for (let step = 0; step < 200; step++) {
    const grad = new Map(who.map((h) => [h, 0.5 - expectedScore(fit.get(h)!, prior(h))]));
    const curv = new Map(who.map((h) => {
      const e = expectedScore(fit.get(h)!, prior(h));
      return [h, e * (1 - e)];
    }));
    played.forEach((g) => {
      const w = lower(g.white);
      const b = lower(g.black);
      const at = ratingsAt(g);
      const rw = fit.get(w) ?? at.white;
      const rb = fit.get(b) ?? at.black;
      const e = expectedScore(rw, rb);
      const d = scoreOf(g.result) - e;
      if (grad.has(w)) {
        grad.set(w, grad.get(w)! + d);
        curv.set(w, curv.get(w)! + e * (1 - e));
      }
      if (grad.has(b)) {
        grad.set(b, grad.get(b)! - d);
        curv.set(b, curv.get(b)! + e * (1 - e));
      }
    });
    let moved = 0;
    who.forEach((h) => {
      // At most 400 points a step, so a lopsided start cannot overshoot
      const delta = Math.max(-400, Math.min(400, grad.get(h)! / (LN * curv.get(h)!)));
      fit.set(h, fit.get(h)! + delta);
      moved = Math.max(moved, Math.abs(delta));
    });
    if (moved < 0.001) break;
  }
  const everyone = played.every((g) => newcomers.has(lower(g.white)) && newcomers.has(lower(g.black)));
  if (everyone) {
    const shift = ELO_START - who.reduce((sum, h) => sum + fit.get(h)!, 0) / who.length;
    who.forEach((h) => fit.set(h, fit.get(h)! + shift));
  }
  return fit;
}

export function computeElo(inputs: EloSeasonInput[]): EloReport {
  const ratings = new Map<string, number>();
  const before = new Map<string, { white: number; black: number; newcomer: boolean }>();
  const seasons: EloSeason[] = [];
  // Who played a season before (a doubtful rating does not count, see EloSeasonInput)
  const known = new Set<string>();

  inputs.forEach((input, i) => {
    const present = new Set([...input.players, ...input.games.flatMap((g) => [g.white, g.black])].map(lower));
    // The very first season has no one to compare with: everyone is an esordiente, so all
    // ratings move as in plain Elo
    const firstSeason = new Set([...present].filter((h) => i === 0 || !known.has(h)));
    const seeds = new Map(Object.entries(input.seeds ?? {}).map(([h, r]) => [lower(h), r]));
    const newcomers = new Set([...firstSeason].filter((h) => i === 0 || !seeds.has(h)));
    firstSeason.forEach((h) => {
      if (!newcomers.has(h)) ratings.set(h, seeds.get(h)!);
    });
    present.forEach((h) => ratings.has(h) || ratings.set(h, ELO_START));
    const start = new Map([...present].map((h) => [h, ratings.get(h)!]));

    const ordered = input.games
      .map((g, n) => ({ g, n }))
      .sort((a, b) => (a.g.end ?? Infinity) - (b.g.end ?? Infinity) || a.n - b.n)
      .map(({ g }) => g);
    ordered.forEach((g) => {
      const w = lower(g.white);
      const b = lower(g.black);
      const rw = ratings.get(w) ?? ELO_START;
      const rb = ratings.get(b) ?? ELO_START;
      const wNew = newcomers.has(w);
      const bNew = newcomers.has(b);
      before.set(gameKey(g, input.key), { white: rw, black: rb, newcomer: wNew || bNew });
      const delta = ELO_K * (scoreOf(g.result) - expectedScore(rw, rb));
      // Against an esordiente only the esordiente moves; two esordienti (or two regulars) both move
      if (!bNew || wNew) ratings.set(w, rw + delta);
      if (!wNew || bNew) ratings.set(b, rb - delta);
    });

    // At the end of a first (archived) season, the rating becomes the performance: 14 games one
    // at a time are too few to reach a level from 1500, or from a Lichess rating that was wrong
    if (input.key !== CURRENT) {
      const fitted = performanceRatings(ordered, firstSeason, (g) => before.get(gameKey(g, input.key))!, seeds);
      fitted.forEach((r, h) => ratings.set(h, r));
    }

    seasons.push({ key: input.key, start, end: new Map([...present].map((h) => [h, ratings.get(h)!])), newcomers, firstSeason });
    // A doubtful rating (see EloSeasonInput) does not count as a season played
    const doubtful = new Set((input.doubtful ?? []).map(lower));
    present.forEach((h) => doubtful.has(h) || known.add(h));
  });

  return { seasons, ratings, before };
}

// An archived season, its forfeits left out (won at the table, not on the board)
// After a replacement the archive gives the substitute the games already played by who left (as
// the standings do). With the round the substitute started from, those games go back to who
// played them; without it, the substitute's rating of that season is doubtful.
export function eloSeasonFromArchive(archive: SeasonArchive): EloSeasonInput {
  const replaced = (archive.departures ?? []).filter((d) => d.mode === 'replaced' && d.replacedBy);
  // Rounds are known only for seasons archived since they were kept ("–" before)
  const before = (d: SeasonDeparture, round: string, end?: number) =>
    d.fromRound && /\d/.test(round)
      ? byRound(round, d.fromRound) < 0
      : !!d.fromDate && end !== undefined && end < Date.parse(d.fromDate);
  const known = (d: SeasonDeparture) => !!d.fromRound || !!d.fromDate;
  const playedBy = (handle: string, round: string, end?: number) => {
    const d = replaced.find((x) => known(x) && lower(x.replacedBy!.handle) === lower(handle) && before(x, round, end));
    return d ? d.handle : handle;
  };
  return {
    key: archive.id,
    players: [...archive.standings.map((s) => s.handle), ...replaced.filter(known).map((d) => d.handle)],
    games: (archive.games ?? [])
      .filter((g) => g.status !== 'forfeit')
      .map((g) => ({ white: playedBy(g.white, g.round, g.end), black: playedBy(g.black, g.round, g.end), result: g.result, end: g.end, round: g.round, id: g.id })),
    doubtful: replaced.filter((d) => !known(d)).map((d) => d.replacedBy!.handle),
    seeds: seedRatings(archive.seeds),
  };
}

// Who actually played a game, by the Lichess accounts (a substitute takes over the games of who
// left in the standings, not on the board); the handles of the calendar otherwise
export function playersOnBoard(g: HistoryGame, s: LichessExportGame | undefined, players: string[]): { white: string; black: string } {
  const known = (id?: string) => (id ? players.find((h) => lower(h) === lower(id)) : undefined);
  // Someone no longer in the list (who left) is still who played: their Lichess account then
  const side = (id: string | undefined, fallback: string) => known(id) ?? id ?? fallback;
  return { white: side(s?.players?.white?.user?.id, g.white), black: side(s?.players?.black?.user?.id, g.black) };
}

// The season being played: its finished games, aborted ones and forfeits left out
export function eloSeasonFromCurrent(
  players: string[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  seeds?: EloSeed[] // of the current season, from the tournament
): EloSeasonInput {
  const games: EloGame[] = [];
  history.forEach((g) => {
    const s = stateOf(g, gameStates);
    const result = scoredResult(s);
    if (!s || !result || isVoid(s) || s.status === 'forfeit') return;
    games.push({ ...playersOnBoard(g, s, players), result, end: s.lastMoveAt, round: g.round, id: extractGameId(g.url) || undefined });
  });
  return { key: CURRENT, players, games, seeds: seedRatings(seeds) };
}

// The whole tournament: archived seasons in the order they were closed, then the current one
export function tournamentElo(
  archives: SeasonArchive[],
  players: string[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  seeds?: EloSeed[] // of the current season (TournamentMeta.seeds)
): EloReport {
  const past = [...archives].sort((a, b) => a.archivedAt.localeCompare(b.archivedAt)).map(eloSeasonFromArchive);
  return computeElo([...past, eloSeasonFromCurrent(players, history, gameStates, seeds)]);
}

// The current season of a report
export const currentSeason = (report: EloReport): EloSeason => report.seasons[report.seasons.length - 1];

// Rating of a player in a report, rounded; undefined when they never played
export function ratingOf(report: EloReport, handle: string): number | undefined {
  const r = report.ratings.get(lower(handle));
  return r === undefined ? undefined : Math.round(r);
}

export const isNewcomer = (season: EloSeason, handle: string) => season.newcomers.has(lower(handle));

// Pronostico: the points a player was expected to make in the season, from the Elo del torneo at
// its start, against every opponent of the calendar (games still to play included); and so far,
// on the games already finished. Games against an esordiente are left out, and an esordiente has
// none: their 1500 says nothing of their level. Shown to the half point (pronosticoPoints).
// The Trofeo Pillsbury goes to who beats it by most (points - expectedSoFar).
export interface Forecast {
  expected: number; // whole season
  games: number; // games of the season in the calendar
  expectedSoFar: number; // on the finished games
  points: number; // made on the finished games
  played: number;
}

export function seasonForecast(
  handle: string,
  season: EloSeason,
  calendar: { white: string; black: string }[],
  finished: EloGame[]
): Forecast | null {
  const me = lower(handle);
  const mine = season.start.get(me);
  if (mine === undefined || season.newcomers.has(me)) return null;
  const opponentOf = (g: { white: string; black: string }) => {
    const opp = lower(g.white) === me ? lower(g.black) : lower(g.black) === me ? lower(g.white) : null;
    return opp === null || season.newcomers.has(opp) ? null : opp;
  };
  const expectedVs = (opp: string) => expectedScore(mine, season.start.get(opp) ?? ELO_START);
  let expected = 0;
  let games = 0;
  calendar.forEach((g) => {
    const opp = opponentOf(g);
    if (opp === null) return;
    expected += expectedVs(opp);
    games++;
  });
  let expectedSoFar = 0;
  let points = 0;
  let played = 0;
  finished.forEach((g) => {
    const opp = opponentOf(g);
    if (opp === null) return;
    expectedSoFar += expectedVs(opp);
    const s = scoreOf(g.result);
    points += lower(g.white) === me ? s : 1 - s;
    played++;
  });
  return { expected, games, expectedSoFar, points, played };
}

// The pronostico as shown: rounded to the nearest half point, as the scores are
export const pronosticoPoints = (f: Forecast) => Math.round(f.expected * 2) / 2;
export const roundHalf = (n: number) => Math.round(n * 2) / 2;

// The calendar as played on the board: a created game by its Lichess accounts (a substitute does
// not get the games played by who left), a game still to create by the calendar
export function boardCalendar(
  calendar: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  players: string[]
): { white: string; black: string }[] {
  return calendar.map((g) => playersOnBoard(g, g.url || g.lichess ? stateOf(g, gameStates) : undefined, players));
}
