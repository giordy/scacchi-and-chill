// Seeds: where a player starts in the Elo del torneo in their first season, from Lichess.
//
// An esordiente starts from their Lichess rating, so that they are in the race for the Trofeo
// Pillsbury from their first game (see lib/tournamentElo.ts). The rating is taken:
// - 30 days before their first game of the season, from their Lichess rating history: losing on
//   purpose online just before the season would have to be planned a month ahead;
// - of the first kind that is reliable, in this order: correspondence, classical, rapid, blitz
//   (bullet is left out: too far from our game; for friends who play online, blitz is often the only
//   rating still alive, and the scale below is set on the same kind). Lichess says whether a rating
//   is provisional only for today, so
//   for a past day a rating is reliable with at least 10 days of rated games of that kind up to it,
//   the last one within a year;
// - moved onto the tournament's scale: the regulars of the season have both ratings, and the mean
//   difference between their Elo del torneo and their Lichess rating of the same kind, on the same
//   day, is added (at least 3 regulars with a reliable rating of that kind, or that kind is skipped).
// Without any, the player is an esordiente as before (a seed with rating null). A seed with a rating
// is fixed once; one without is tried again, with the same day, whenever the organizer area opens
// (a rule changed since, or a regular joined): the histories up to a past day do not change, so
// playing online now cannot move it.
import { EloSeed, HistoryGame, LichessExportGame } from '../types';
import { stateOf } from './games';
import { playersOnBoard } from './tournamentElo';

export type SeedPerf = NonNullable<EloSeed['perf']>;
export const SEED_PERFS: SeedPerf[] = ['correspondence', 'classical', 'rapid', 'blitz'];
export const SEED_PERF_LABEL: Record<SeedPerf, string> = { correspondence: 'per corrispondenza', classical: 'classical', rapid: 'rapid', blitz: 'blitz' };
// The entry of a kind in a Lichess rating history. Lichess names them "blitz", "rapid"... (it used
// "Blitz", "Rapid"...): compared without case
const entryOf = (history: unknown[], perf: SeedPerf) =>
  history.find((h) => {
    const name = h && typeof h === 'object' ? (h as { name?: unknown }).name : undefined;
    return typeof name === 'string' && name.toLowerCase() === perf;
  }) as { points?: unknown } | undefined;

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
// (GET /api/user/<name>/rating-history: [{ name: "rapid", points: [[2026, 8, 30, 1720], ...] }],
// months from 0, one point per day with rated games)
export function reliableRatingsAt(history: unknown, date: string): Partial<Record<SeedPerf, number>> {
  const out: Partial<Record<SeedPerf, number>> = {};
  if (!Array.isArray(history)) return out;
  const oldest = isoDay(Date.parse(date) - RELIABLE_WITHIN_DAYS * DAY);
  SEED_PERFS.forEach((perf) => {
    const entry = entryOf(history, perf);
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

// What a rating history holds up to a day, in words for the organizer: for each kind, the days with
// rated games and the last one; or what was read instead, when it is not a history
export function historySummary(history: unknown, date: string): string {
  if (!Array.isArray(history)) return `storico Lichess non leggibile (${history === null ? 'null' : typeof history})`;
  if (history.length === 0) return 'storico Lichess vuoto';
  const names = history.map((h) => (h && typeof h === 'object' ? String((h as { name?: unknown }).name) : typeof h));
  const kinds = SEED_PERFS.map((perf) => {
    const entry = entryOf(history, perf);
    if (!entry) return null;
    const days = (Array.isArray(entry.points) ? entry.points : [])
      .filter((p): p is number[] => Array.isArray(p) && p.length >= 4 && p.every((n) => typeof n === 'number'))
      .map(([y, m, d]) => isoDay(Date.UTC(y, m, d)))
      .filter((day) => day <= date)
      .sort();
    return `${SEED_PERF_LABEL[perf]} ${days.length} giorni${days.length > 0 ? `, ultimo ${days[days.length - 1]}` : ''}`;
  }).filter(Boolean);
  return kinds.length > 0 ? `nello storico: ${kinds.join('; ')}` : `nello storico solo: ${names.join(', ')}`;
}

// The seed of a player in their first season. regulars: the Elo del torneo of the regulars of the
// season at its start, by handle in lower case; histories: the Lichess rating histories, by handle in
// lower case (the player's and the regulars')
export function computeSeed(handle: string, date: string, regulars: Map<string, number>, histories: Map<string, unknown>): EloSeed {
  const mine = reliableRatingsAt(histories.get(lower(handle)), date);
  // Why each kind of the player's was skipped: too few regulars to set its scale
  const skipped: string[] = [];
  for (const perf of SEED_PERFS) {
    const lichess = mine[perf];
    if (lichess === undefined) continue;
    const pairs = [...regulars]
      .map(([h, elo]) => ({ elo, lichess: reliableRatingsAt(histories.get(h), date)[perf] }))
      .filter((p): p is { elo: number; lichess: number } => p.lichess !== undefined);
    if (pairs.length < SEED_MIN_REGULARS) {
      const n = pairs.length;
      skipped.push(
        `Elo ${SEED_PERF_LABEL[perf]} ${lichess} affidabile, ma ${n === 0 ? 'nessun veterano' : `solo ${n} ${n === 1 ? 'veterano' : 'veterani'}`} con l'Elo ${SEED_PERF_LABEL[perf]} affidabile a quella data (ne servono ${SEED_MIN_REGULARS})`
      );
      continue;
    }
    const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
    const offset = Math.round(mean(pairs.map((p) => p.elo)) - mean(pairs.map((p) => p.lichess)));
    return { handle, rating: lichess + offset, date, perf, lichess, offset };
  }
  const reason =
    skipped.length > 0
      ? skipped.join('; ')
      : `nessun Elo Lichess affidabile (servono almeno ${RELIABLE_DAYS} giorni con partite valutate dello stesso tipo, l'ultima entro un anno; il bullet non conta); ${historySummary(histories.get(lower(handle)), date)}`;
  return { handle, rating: null, date, reason };
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

// Players in their first season who need a seed now: no seed yet and a first game to date it from,
// or a seed without a rating, tried again on its own day (retry: true)
export function seedsToFix(
  firstSeason: Set<string>,
  seeds: EloSeed[] | undefined,
  first: Map<string, number>
): { handle: string; date: string; retry: boolean }[] {
  const seedOf = new Map((seeds ?? []).map((s) => [lower(s.handle), s]));
  return [...firstSeason]
    .sort()
    .flatMap((handle): { handle: string; date: string; retry: boolean }[] => {
      const seed = seedOf.get(handle);
      if (seed) return seed.rating === null ? [{ handle, date: seed.date, retry: true }] : [];
      return first.has(handle) ? [{ handle, date: seedDate(first.get(handle)!), retry: false }] : [];
    });
}
