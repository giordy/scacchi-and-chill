// Seeds: where a player starts in the Elo del torneo in their first season, from Lichess.
//
// An esordiente starts from their Lichess rating, so that they are in the race for the Trofeo
// Pillsbury from their first game (see lib/tournamentElo.ts). The rating is taken:
// - 30 days before their first game of the season, from their Lichess rating history: losing on
//   purpose online just before the season would have to be planned a month ahead;
// - of the first kind that is reliable, in this order: correspondence, classical, rapid (blitz and
//   bullet measure another game). Lichess says whether a rating is provisional only for today, so
//   for a past day a rating is reliable with at least 10 days of rated games of that kind up to it,
//   the last one within a year;
// - moved onto the tournament's scale: the regulars of the season have both ratings, and the mean
//   difference between their Elo del torneo and their Lichess rating of the same kind, on the same
//   day, is added (at least 3 regulars with a reliable rating of that kind, or that kind is skipped).
// Without any, the player is an esordiente as before (a seed with rating null). A seed is fixed once.
import { EloSeed, HistoryGame, LichessExportGame } from '../types';
import { stateOf } from './games';
import { playersOnBoard } from './tournamentElo';

export type SeedPerf = NonNullable<EloSeed['perf']>;
export const SEED_PERFS: SeedPerf[] = ['correspondence', 'classical', 'rapid'];
export const SEED_PERF_LABEL: Record<SeedPerf, string> = { correspondence: 'per corrispondenza', classical: 'classical', rapid: 'rapid' };
// Names of the kinds in Lichess's rating history
const HISTORY_NAME: Record<SeedPerf, string> = { correspondence: 'Correspondence', classical: 'Classical', rapid: 'Rapid' };

export const SEED_DAYS_BEFORE = 30;
export const SEED_MIN_REGULARS = 3;
export const RELIABLE_DAYS = 10;
export const RELIABLE_WITHIN_DAYS = 365;

const DAY = 86400000;
const lower = (h: string) => h.toLowerCase();
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// "2026-09-08" -> "8 set 2026", as the site shows the day of a seed
export const seedDayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// The day a player's Lichess rating is taken from: 30 days before their first game of the season
export const seedDate = (firstGameMs: number) => isoDay(firstGameMs - SEED_DAYS_BEFORE * DAY);

// The reliable Lichess ratings of a player on a day, by kind, from their rating history
// (GET /api/user/<name>/rating-history: [{ name: "Rapid", points: [[2026, 8, 30, 1720], ...] }],
// months from 0, one point per day with rated games)
export function reliableRatingsAt(history: unknown, date: string): Partial<Record<SeedPerf, number>> {
  const out: Partial<Record<SeedPerf, number>> = {};
  if (!Array.isArray(history)) return out;
  const oldest = isoDay(Date.parse(date) - RELIABLE_WITHIN_DAYS * DAY);
  SEED_PERFS.forEach((perf) => {
    const entry = history.find((h) => h && typeof h === 'object' && (h as { name?: unknown }).name === HISTORY_NAME[perf]) as
      | { points?: unknown }
      | undefined;
    const points = (Array.isArray(entry?.points) ? entry!.points : [])
      .filter((p): p is number[] => Array.isArray(p) && p.length >= 4 && p.every((n) => typeof n === 'number'))
      .map(([y, m, d, rating]) => ({ day: isoDay(Date.UTC(y, m, d)), rating }))
      .filter((p) => p.day <= date)
      .sort((a, b) => a.day.localeCompare(b.day));
    const last = points[points.length - 1];
    if (points.length >= RELIABLE_DAYS && last.day >= oldest) out[perf] = last.rating;
  });
  return out;
}

// The seed of a player in their first season. regulars: the Elo del torneo of the regulars of the
// season at its start, by handle in lower case; histories: the Lichess rating histories, by handle in
// lower case (the player's and the regulars')
export function computeSeed(handle: string, date: string, regulars: Map<string, number>, histories: Map<string, unknown>): EloSeed {
  const mine = reliableRatingsAt(histories.get(lower(handle)), date);
  for (const perf of SEED_PERFS) {
    const lichess = mine[perf];
    if (lichess === undefined) continue;
    const pairs = [...regulars]
      .map(([h, elo]) => ({ elo, lichess: reliableRatingsAt(histories.get(h), date)[perf] }))
      .filter((p): p is { elo: number; lichess: number } => p.lichess !== undefined);
    if (pairs.length < SEED_MIN_REGULARS) continue;
    const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
    const offset = Math.round(mean(pairs.map((p) => p.elo)) - mean(pairs.map((p) => p.lichess)));
    return { handle, rating: lichess + offset, date, perf, lichess, offset };
  }
  return { handle, rating: null, date };
}

// When each player's first game of the season was created (the Lichess challenge; the link saved
// on the site for a challenge not accepted yet), by handle in lower case, as played on the board
export function firstGames(history: HistoryGame[], gameStates: Record<string, LichessExportGame>, players: string[]): Map<string, number> {
  const first = new Map<string, number>();
  history.forEach((g) => {
    const s = stateOf(g, gameStates);
    const at = s?.createdAt ?? (g.url ? g.createdAt : undefined);
    if (typeof at !== 'number') return;
    const board = playersOnBoard(g, s, players);
    [board.white, board.black].map(lower).forEach((h) => {
      if (!first.has(h) || at < first.get(h)!) first.set(h, at);
    });
  });
  return first;
}

// Players in their first season who need a seed now: no seed yet, and a first game to date it from
export function seedsToFix(firstSeason: Set<string>, seeds: EloSeed[] | undefined, first: Map<string, number>): { handle: string; date: string }[] {
  const fixed = new Set((seeds ?? []).map((s) => lower(s.handle)));
  return [...firstSeason]
    .filter((h) => !fixed.has(h) && first.has(h))
    .sort()
    .map((handle) => ({ handle, date: seedDate(first.get(handle)!) }));
}
