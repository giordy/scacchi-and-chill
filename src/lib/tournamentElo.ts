// Elo del torneo: a rating of each player computed only from the games of this tournament, with
// the classic Elo formula (K = 32), game after game in the order they ended, from the first archived
// season to the current one. Everyone starts at 1500; at the end of a player's first season their
// rating becomes their performance in it (see performanceRatings), as FIDE does for a first rating.
// Each rating also carries how sure it is (EloSeason.sigma): what the Trofeo Pillsbury weighs a gap
// from the objective by (see seasonForecast).
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
import { beforeSubstitute, startKnown } from './departures';

export const ELO_START = 1500;
export const ELO_K = 32;
// Virtual draws a first-season performance leans on, against what was known of the player before
// it (see performanceRatings). One let a season of 14 games spread the ratings far wider than the
// levels are (13½ of 14 is the best player, not by how much): three are what a prior as wide as
// the spread of levels in a group like ours is worth, and on simulated seasons they gave both the
// closest ratings and objectives that favour neither the strongest nor the weakest.
export const PERF_VIRTUAL_DRAWS = 3;
// How sure a seed is, when the seed does not say it (see EloSeed.sigma): what the Stagione 2 gave
export const SEED_SIGMA = 175;
// Points of Elo per point of expected score, at an even game: the slope of expectedScore is LN·e(1-e)
const LN = Math.LN10 / 400;

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
  // Starting ratings of players in their first season, by handle (see lib/seeds.ts), and how sure
  // each is (standard deviation, in Elo points; SEED_SIGMA when not given)
  seeds?: Record<string, number>;
  seedSigmas?: Record<string, number>;
}

export interface EloSeason {
  key: string;
  start: Map<string, number>; // ratings at the start of the season, of the players of the season
  end: Map<string, number>; // ratings at the end (or now, for the current season)
  newcomers: Set<string>; // esordienti of the season: in their first season, without a seed
  firstSeason: Set<string>; // everyone in their first season, seeded or not
  // How sure each rating at the start is, as a standard deviation in Elo points: of everyone whose
  // level is known (not the esordienti). See computeElo
  sigma: Map<string, number>;
}

export interface EloReport {
  seasons: EloSeason[]; // oldest first, the current one last
  ratings: Map<string, number>; // everyone's latest rating
  // Ratings of the two players when the game started (before its result), by gameKey, and
  // whether either was an esordiente (then the game is no colpaccio)
  before: Map<string, { white: number; black: number; newcomer: boolean }>;
  // Every game, in the order the ratings moved, with the key of its season
  played: { season: string; game: EloGame }[];
  // Highest rating of each player, and the key of the season it was reached in. Only once their
  // level is known: from the rating fixed at the end of their first season, then after every game
  peaks: Map<string, { rating: number; season: string }>;
}

export const CURRENT = 'current';

// Games decided at the table: points in the standings, but they say nothing of anyone's level, so
// they are out of the Elo del torneo and of the Trofeo Pillsbury: forfeits after a withdrawal, and
// games Lichess closed for cheating ("cheat detected")
export const decidedAtTable = (status: string | undefined) => status === 'forfeit' || status === 'cheat';

// The seeds with a rating, by handle, as computeElo takes them (a seed without one leaves an esordiente)
export const seedRatings = (seeds: EloSeed[] | undefined): Record<string, number> =>
  Object.fromEntries((seeds ?? []).filter((s) => typeof s.rating === 'number').map((s) => [s.handle.toLowerCase(), s.rating as number]));
// How sure those seeds are, by handle (SEED_SIGMA for a seed from before it was kept)
export const seedSigmas = (seeds: EloSeed[] | undefined): Record<string, number> =>
  Object.fromEntries((seeds ?? []).filter((s) => typeof s.rating === 'number').map((s) => [s.handle.toLowerCase(), s.sigma ?? SEED_SIGMA]));

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
// in each game; esordienti are solved together. PERF_VIRTUAL_DRAWS virtual draws each, against what
// was known of them before the season, keep a perfect or empty score finite and a short season from
// stretching the ratings: their seed for who has one, the mean of the regulars otherwise (knowing
// nothing else, a newcomer is an average player); a substitute with few games stays near it. When
// everyone is an esordiente (the first season) the draws are against 1500 and the scale is centred on it.
export function performanceRatings(
  games: EloGame[],
  newcomers: Set<string>,
  ratingsAt: (g: EloGame) => { white: number; black: number },
  priors?: Map<string, number> // what the virtual draws are against, by handle in lower case (1500 if missing)
): Map<string, number> {
  const played = games.filter((g) => newcomers.has(lower(g.white)) || newcomers.has(lower(g.black)));
  const who = [...new Set(played.flatMap((g) => [lower(g.white), lower(g.black)]).filter((h) => newcomers.has(h)))];
  const prior = (h: string) => priors?.get(h) ?? ELO_START;
  const fit = new Map(who.map((h) => [h, prior(h)]));
  if (who.length === 0) return fit;
  const D = PERF_VIRTUAL_DRAWS;
  // Newton's method, one player at a time on the diagonal: a few dozen steps, not thousands
  for (let step = 0; step < 200; step++) {
    const grad = new Map(who.map((h) => [h, D * (0.5 - expectedScore(fit.get(h)!, prior(h)))]));
    const curv = new Map(who.map((h) => {
      const e = expectedScore(fit.get(h)!, prior(h));
      return [h, D * e * (1 - e)];
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
  if (allNewcomers(played, newcomers)) {
    const shift = ELO_START - who.reduce((sum, h) => sum + fit.get(h)!, 0) / who.length;
    who.forEach((h) => fit.set(h, fit.get(h)! + shift));
  }
  return fit;
}

const allNewcomers = (games: EloGame[], newcomers: Set<string>) => games.every((g) => newcomers.has(lower(g.white)) && newcomers.has(lower(g.black)));

// How sure the performances of performanceRatings are, as standard deviations in Elo points: how
// much the games could have gone otherwise, given the virtual draws (the inverse of the information
// of the fit, all esordienti together), plus how sure the ratings of their other opponents were. When
// everyone is an esordiente, the scale is centred: how sure each is compared with the mean.
export function performanceSigmas(
  games: EloGame[],
  newcomers: Set<string>,
  ratingsAt: (g: EloGame) => { white: number; black: number },
  fit: Map<string, number>, // the performances, by handle in lower case
  priors: Map<string, number> | undefined, // as for performanceRatings
  sigmaOf: (handle: string) => number | undefined // of the other opponents, in the game
): Map<string, number> {
  const played = games.filter((g) => newcomers.has(lower(g.white)) || newcomers.has(lower(g.black)));
  const who = [...fit.keys()].filter((h) => played.some((g) => lower(g.white) === h || lower(g.black) === h));
  const at = new Map(who.map((h, i) => [h, i]));
  const n = who.length;
  // Information of the fit, in Elo points (LN times the slope of the expected points), and the
  // dependence on each other opponent's rating
  const info = who.map((h) => who.map(() => 0));
  // For each esordiente, by other opponent: the information of their games times that opponent's sigma
  const others = who.map(() => new Map<string, number>());
  const lean = (i: number, opp: string, v: number) => others[i].set(opp, (others[i].get(opp) ?? 0) + v * (sigmaOf(opp) ?? 0));
  who.forEach((h, i) => {
    const e = expectedScore(fit.get(h)!, priors?.get(h) ?? ELO_START);
    info[i][i] += LN * LN * PERF_VIRTUAL_DRAWS * e * (1 - e);
  });
  played.forEach((g) => {
    const w = lower(g.white);
    const b = lower(g.black);
    const r = ratingsAt(g);
    const rw = fit.get(w) ?? r.white;
    const rb = fit.get(b) ?? r.black;
    const e = expectedScore(rw, rb);
    const v = LN * LN * e * (1 - e);
    const iw = at.get(w);
    const ib = at.get(b);
    if (iw !== undefined) info[iw][iw] += v;
    if (ib !== undefined) info[ib][ib] += v;
    if (iw !== undefined && ib !== undefined) {
      info[iw][ib] -= v;
      info[ib][iw] -= v;
    } else if (iw !== undefined) lean(iw, b, v);
    else if (ib !== undefined) lean(ib, w, v);
  });
  const cov = invert(info);
  // A performance moves with each other opponent's rating by cov·information: their uncertainty
  // adds, once per opponent (two games against the same one do not cancel out)
  const opponents = [...new Set(others.flatMap((m) => [...m.keys()]))];
  const sigmas = new Map<string, number>();
  const centred = allNewcomers(played, newcomers);
  who.forEach((h, i) => {
    let variance = cov[i][i];
    if (centred) {
      // Var(r_i - mean): the scale is centred on the mean of all of them
      const mean = (row: number[]) => row.reduce((a, b) => a + b, 0) / n;
      const rowMean = cov.map(mean);
      variance = cov[i][i] - 2 * rowMean[i] + mean(rowMean);
    }
    opponents.forEach((opp) => {
      const moved = who.reduce((sum, _, k) => sum + cov[i][k] * (others[k].get(opp) ?? 0), 0);
      variance += moved ** 2;
    });
    sigmas.set(h, Math.sqrt(Math.max(0, variance)));
  });
  return sigmas;
}

// Inverse of a small symmetric positive definite matrix (Gauss-Jordan)
function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row) => row.slice(n));
}

export function computeElo(inputs: EloSeasonInput[]): EloReport {
  const ratings = new Map<string, number>();
  const before = new Map<string, { white: number; black: number; newcomer: boolean }>();
  const seasons: EloSeason[] = [];
  const played: EloReport['played'] = [];
  const peaks: EloReport['peaks'] = new Map();
  const reach = (h: string, season: string) => {
    const r = ratings.get(h)!;
    const p = peaks.get(h);
    if (!p || r > p.rating) peaks.set(h, { rating: r, season });
  };
  // Who played a season before (a doubtful rating does not count, see EloSeasonInput)
  const known = new Set<string>();
  // How sure each rating is, as a variance (Elo points squared): from the performance at the end of
  // the first season, or the seed; then after every game, as Elo moves it (see below). The
  // esordienti have none until their level is known.
  const variance = new Map<string, number>();

  inputs.forEach((input, i) => {
    const present = new Set([...input.players, ...input.games.flatMap((g) => [g.white, g.black])].map(lower));
    // The very first season has no one to compare with: everyone is an esordiente, so all
    // ratings move as in plain Elo
    const firstSeason = new Set([...present].filter((h) => i === 0 || !known.has(h)));
    const seeds = new Map(Object.entries(input.seeds ?? {}).map(([h, r]) => [lower(h), r]));
    const newcomers = new Set([...firstSeason].filter((h) => i === 0 || !seeds.has(h)));
    const seedSigma = new Map(Object.entries(input.seedSigmas ?? {}).map(([h, s]) => [lower(h), s]));
    firstSeason.forEach((h) => {
      if (newcomers.has(h)) variance.delete(h);
      else {
        ratings.set(h, seeds.get(h)!);
        variance.set(h, (seedSigma.get(h) ?? SEED_SIGMA) ** 2);
      }
    });
    present.forEach((h) => ratings.has(h) || ratings.set(h, ELO_START));
    const start = new Map([...present].map((h) => [h, ratings.get(h)!]));
    const sigma = new Map([...present].filter((h) => variance.has(h)).map((h) => [h, Math.sqrt(variance.get(h)!)]));
    // What the first-season performances lean on: the seed, or the mean of the regulars at the start
    const regulars = [...present].filter((h) => !firstSeason.has(h)).map((h) => start.get(h)!);
    const regularsMean = regulars.length > 0 ? regulars.reduce((a, b) => a + b, 0) / regulars.length : ELO_START;
    const priors = new Map([...firstSeason].map((h) => [h, seeds.get(h) ?? (i === 0 ? ELO_START : regularsMean)]));

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
      const e = expectedScore(rw, rb);
      const delta = ELO_K * (scoreOf(g.result) - e);
      // Against an esordiente only the esordiente moves; two esordienti (or two regulars) both move
      if (!bNew || wNew) ratings.set(w, rw + delta);
      if (!wNew || bNew) ratings.set(b, rb - delta);
      // How sure the ratings that moved are now: a game corrects a share a = K·LN·e(1-e) of the
      // error, takes on that share of the opponent's, and adds its own chance (K²·e(1-e))
      const vw = variance.get(w);
      const vb = variance.get(b);
      const a = ELO_K * LN * e * (1 - e);
      const after = (mine: number, theirs: number | undefined) => (1 - a) ** 2 * mine + a ** 2 * (theirs ?? 0) + ELO_K ** 2 * e * (1 - e);
      if (vw !== undefined && (!bNew || wNew)) variance.set(w, after(vw, vb));
      if (vb !== undefined && (!wNew || bNew)) variance.set(b, after(vb, vw));
      played.push({ season: input.key, game: g });
      // In a first season the rating is not yet their level (at the end it becomes the performance)
      if (!firstSeason.has(w)) reach(w, input.key);
      if (!firstSeason.has(b)) reach(b, input.key);
    });

    // At the end of a first (archived) season, the rating becomes the performance: 14 games one
    // at a time are too few to reach a level from 1500, or from a Lichess rating that was wrong
    if (input.key !== CURRENT) {
      const at = (g: EloGame) => before.get(gameKey(g, input.key))!;
      const fitted = performanceRatings(ordered, firstSeason, at, priors);
      // The other opponents' sigma in each game: as at the start of the season, near enough
      const sure = performanceSigmas(ordered, firstSeason, at, fitted, priors, (h) => sigma.get(h));
      fitted.forEach((r, h) => ratings.set(h, r));
      sure.forEach((s, h) => variance.set(h, s ** 2));
    }
    // A doubtful rating (see EloSeasonInput) does not count as a season played
    const doubtful = new Set((input.doubtful ?? []).map(lower));
    if (input.key !== CURRENT) firstSeason.forEach((h) => doubtful.has(h) || reach(h, input.key));

    seasons.push({ key: input.key, start, end: new Map([...present].map((h) => [h, ratings.get(h)!])), newcomers, firstSeason, sigma });
    present.forEach((h) => doubtful.has(h) || known.add(h));
  });

  return { seasons, ratings, before, played, peaks };
}

// An archived season, the games decided at the table left out (see decidedAtTable)
// After a replacement the archive gives the substitute the games already played by who left (as
// the standings do). With the round the substitute started from, those games go back to who
// played them; without it, the substitute's rating of that season is doubtful.
export function eloSeasonFromArchive(archive: SeasonArchive): EloSeasonInput {
  const replaced = (archive.departures ?? []).filter((d) => d.mode === 'replaced' && d.replacedBy);
  const before = beforeSubstitute;
  const known = startKnown;
  const playedBy = (handle: string, round: string, end?: number) => {
    const d = replaced.find((x) => known(x) && lower(x.replacedBy!.handle) === lower(handle) && before(x, round, end));
    return d ? d.handle : handle;
  };
  return {
    key: archive.id,
    players: [...archive.standings.map((s) => s.handle), ...replaced.filter(known).map((d) => d.handle)],
    games: (archive.games ?? [])
      .filter((g) => !decidedAtTable(g.status))
      .map((g) => ({ white: playedBy(g.white, g.round, g.end), black: playedBy(g.black, g.round, g.end), result: g.result, end: g.end, round: g.round, id: g.id })),
    doubtful: replaced.filter((d) => !known(d)).map((d) => d.replacedBy!.handle),
    seeds: seedRatings(archive.seeds),
    seedSigmas: seedSigmas(archive.seeds),
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

// The season being played: its finished games, aborted ones and those decided at the table left out
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
    if (!s || !result || isVoid(s) || decidedAtTable(s.status)) return;
    games.push({ ...playersOnBoard(g, s, players), result, end: s.lastMoveAt, round: g.round, id: extractGameId(g.url) || undefined });
  });
  return { key: CURRENT, players, games, seeds: seedRatings(seeds), seedSigmas: seedSigmas(seeds) };
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

// Highest rating a player reached, rounded, and the key of its season (see EloReport.peaks)
export function peakOf(report: EloReport, handle: string): { rating: number; season: string } | undefined {
  const p = report.peaks.get(lower(handle));
  return p && { rating: Math.round(p.rating), season: p.season };
}

export const isNewcomer = (season: EloSeason, handle: string) => season.newcomers.has(lower(handle));

// Pronostico: the points a player was expected to make in the season, from the Elo del torneo at
// its start, against every opponent of the calendar (games still to play included); and so far,
// on the games already finished. Games against an esordiente are left out, and an esordiente has
// none: their 1500 says nothing of their level. Shown to the half point (pronosticoPoints).
// The Trofeo Pillsbury goes to who beats it by most (points - expectedSoFar), measured against
// spread: how much the gap could be by chance alone.
export interface Forecast {
  expected: number; // whole season
  games: number; // games of the season in the calendar
  expectedSoFar: number; // on the finished games
  points: number; // made on the finished games
  played: number;
  // The standard deviation of points - expectedSoFar with no change of level: the luck of the
  // games (e(1-e) each) and how sure the ratings it comes from are (EloSeason.sigma), the player's
  // and each opponent's. Wider for who is in their first season, whose seed is less sure
  spread: number;
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
  let luck = 0;
  let slope = 0; // points of the objective per point of the player's rating
  const slopeVs = new Map<string, number>(); // and per point of each opponent's
  finished.forEach((g) => {
    const opp = opponentOf(g);
    if (opp === null) return;
    const e = expectedVs(opp);
    expectedSoFar += e;
    luck += e * (1 - e);
    slope += LN * e * (1 - e);
    slopeVs.set(opp, (slopeVs.get(opp) ?? 0) + LN * e * (1 - e));
    const s = scoreOf(g.result);
    points += lower(g.white) === me ? s : 1 - s;
    played++;
  });
  const sigma = (h: string) => season.sigma.get(h) ?? 0;
  let variance = luck + (slope * sigma(me)) ** 2;
  slopeVs.forEach((x, opp) => {
    variance += (x * sigma(opp)) ** 2;
  });
  return { expected, games, expectedSoFar, points, played, spread: Math.sqrt(variance) };
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
