// Elo del torneo: a rating of each player computed only from the games of this tournament, with
// the classic Elo formula (K = 32), game after game in the order they ended, from the first archived
// season to the current one. Everyone starts at 1500.
//
// Esordiente: a player in their first season, or back after skipping at least one season. In the
// games of an esordiente only the esordiente's rating moves: the others neither lose nor gain
// against someone whose level is not known yet. An esordiente cannot win the Premio Rivelazione.
// A player back from a break starts again from the rating they had.
//
// Lichess ratings are not used: for correspondence they are provisional for almost everyone here
// and jump by hundreds of points, and they also depend on games played outside the tournament.
import { HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { stateOf, isVoid } from './games';
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
}

export interface EloSeason {
  key: string;
  start: Map<string, number>; // ratings at the start of the season, of the players of the season
  end: Map<string, number>; // ratings at the end (or now, for the current season)
  newcomers: Set<string>; // esordienti of the season
}

export interface EloReport {
  seasons: EloSeason[]; // oldest first, the current one last
  ratings: Map<string, number>; // everyone's latest rating
  // Ratings of the two players when the game started (before its result), by gameKey, and
  // whether either was an esordiente (then the game is no colpaccio)
  before: Map<string, { white: number; black: number; newcomer: boolean }>;
}

export const CURRENT = 'current';

// Expected score of a player rated `a` against one rated `b`
export const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

const scoreOf = (r: EloResult) => (r === '1-0' ? 1 : r === '0-1' ? 0 : 0.5);
const lower = (h: string) => h.toLowerCase();

// The key a game is found by: its Lichess id, or who played it in which round
export const gameKey = (g: { id?: string; round?: string; white: string; black: string }, season = '') =>
  g.id || `${season}|${g.round ?? ''}|${lower(g.white)}|${lower(g.black)}`;

export function computeElo(inputs: EloSeasonInput[]): EloReport {
  const ratings = new Map<string, number>();
  const before = new Map<string, { white: number; black: number; newcomer: boolean }>();
  const seasons: EloSeason[] = [];
  let previous = new Set<string>();

  inputs.forEach((input, i) => {
    const present = new Set([...input.players, ...input.games.flatMap((g) => [g.white, g.black])].map(lower));
    // The very first season has no one to compare with: everyone is an esordiente, so all
    // ratings move as in plain Elo
    const newcomers = new Set([...present].filter((h) => i === 0 || !previous.has(h)));
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

    seasons.push({ key: input.key, start, end: new Map([...present].map((h) => [h, ratings.get(h)!])), newcomers });
    previous = present;
  });

  return { seasons, ratings, before };
}

// An archived season, its forfeits left out (won at the table, not on the board)
export function eloSeasonFromArchive(archive: SeasonArchive): EloSeasonInput {
  return {
    key: archive.id,
    players: archive.standings.map((s) => s.handle),
    games: (archive.games ?? [])
      .filter((g) => g.status !== 'forfeit')
      .map((g) => ({ white: g.white, black: g.black, result: g.result, end: g.end, round: g.round, id: g.id })),
  };
}

// The season being played: its finished games, aborted ones and forfeits left out
export function eloSeasonFromCurrent(
  players: string[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): EloSeasonInput {
  const games: EloGame[] = [];
  history.forEach((g) => {
    const s = stateOf(g, gameStates);
    const result = scoredResult(s);
    if (!s || !result || isVoid(s) || s.status === 'forfeit') return;
    games.push({ white: g.white, black: g.black, result, end: s.lastMoveAt, round: g.round, id: extractGameId(g.url) || undefined });
  });
  return { key: CURRENT, players, games };
}

// The whole tournament: archived seasons in the order they were closed, then the current one
export function tournamentElo(
  archives: SeasonArchive[],
  players: string[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): EloReport {
  const past = [...archives].sort((a, b) => a.archivedAt.localeCompare(b.archivedAt)).map(eloSeasonFromArchive);
  return computeElo([...past, eloSeasonFromCurrent(players, history, gameStates)]);
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
// none: their 1500 says nothing of their level. Shown rounded down (pronosticoPoints).
// The Premio Rivelazione goes to who beats it by most (points - expectedSoFar).
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

// The pronostico as shown: whole points, rounded down
export const pronosticoPoints = (f: Forecast) => Math.floor(f.expected + 1e-9);
