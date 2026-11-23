import { HistoryGame, LichessExportGame, RoundEnd, TournamentMeta } from '../types';
import { byRound, stateOf } from './games';
import { gameProgress } from './progress';

// Turni con scadenza (optional, off until the organizer sets a length in Stagioni → Regolamento).
// A round lasts a number of days from the creation of its challenges, to the end of the last day in
// Italy; then the organizer can start the next one, and the games still open go on alongside it: the
// deadline never decides a result. Each round keeps the end it got when its challenges were created
// (TournamentMeta.roundEnds), so a new length applies from the next round and switching the option on
// in the middle of a round leaves that round without one. Switched off, no end is shown anywhere.

export const DEFAULT_ROUND_DAYS = 14;
// Ultime giornate (optional, apart): the last rounds of the calendar start only once every game of the
// rounds before is over, so that no game is played knowing the results of a later round
export const DEFAULT_FINAL_ROUNDS = 3;
export const MAX_FINAL_ROUNDS = 10;
export const MIN_ROUND_DAYS = 3;
export const MAX_ROUND_DAYS = 60;

const DAY_MS = 86_400_000;
const TZ = 'Europe/Rome';

// The calendar day of a moment in Italy
function romeDay(ms: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// How far Italy is ahead of UTC at a moment, in ms (one or two hours)
function romeOffset(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return asUtc - Math.floor(ms / 60_000) * 60_000;
}

// Midnight in Italy at the start of a day (a day past the end of the month moves on, as Date.UTC)
export function romeMidnight(y: number, m: number, d: number): number {
  const utc = Date.UTC(y, m - 1, d);
  let t = utc - romeOffset(utc);
  t = utc - romeOffset(t); // again, for the nights the clocks change
  return t;
}

// The end of a round that starts at `start` and lasts `days` days: midnight in Italy after its last
// day (created on Sunday 23 November with 14 days: until the end of Sunday 7 December)
export function roundEndFrom(start: number, days: number): number {
  const { y, m, d } = romeDay(start);
  return romeMidnight(y, m, d + days + 1);
}

// Whether the rounds have a deadline: the organizer set a length
export const roundDeadlinesOn = (meta: Pick<TournamentMeta, 'roundDays'> | undefined): boolean =>
  typeof meta?.roundDays === 'number' && meta.roundDays > 0;

// How many of the last rounds wait for the ones before: 0 when off (also with the deadlines off)
export function finalRoundsOf(meta: Pick<TournamentMeta, 'roundDays' | 'finalRoundsWait'> | undefined): number {
  if (!roundDeadlinesOn(meta)) return 0;
  const n = meta?.finalRoundsWait;
  return typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
}

// Whether this round is one of the last of the calendar that wait (roundNames: every round of the season)
export function waitsForEarlier(
  meta: Pick<TournamentMeta, 'roundDays' | 'finalRoundsWait'> | undefined,
  roundNames: string[],
  round: string
): boolean {
  const n = finalRoundsOf(meta);
  if (n === 0) return false;
  const sorted = [...new Set(roundNames)].sort(byRound);
  return sorted.slice(-n).includes(round);
}

// The end of a round, only while the option is on
export function roundEndOf(meta: Pick<TournamentMeta, 'roundDays' | 'roundEnds'> | undefined, round: string): number | undefined {
  if (!roundDeadlinesOn(meta)) return undefined;
  return meta?.roundEnds?.find((e) => e.round === round)?.at;
}

// The list of ends with this round's set (or removed, without `at`), in round order
export function withRoundEnd(ends: RoundEnd[] | undefined, round: string, at?: number): RoundEnd[] {
  const others = (ends ?? []).filter((e) => e.round !== round);
  return (at === undefined ? others : [...others, { round, at }]).sort((a, b) => byRound(a.round, b.round));
}

// The ends as read from Firestore: only well formed ones
export function cleanRoundEnds(raw: unknown): RoundEnd[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(
    (e): e is RoundEnd => !!e && typeof e.round === 'string' && e.round !== '' && typeof e.at === 'number' && Number.isFinite(e.at)
  );
}

// "domenica 7 dicembre": the last day of the round
export function formatRoundEnd(end: number): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(end - 1));
}

// Days left after today, in Italy: 0 on the last day, negative once it is over
export function daysLeft(end: number, now: number): number {
  const last = romeDay(end - 1);
  const today = romeDay(now);
  return Math.round((Date.UTC(last.y, last.m - 1, last.d) - Date.UTC(today.y, today.m - 1, today.d)) / DAY_MS);
}

export const roundExpired = (end: number, now: number) => now >= end;

// "mancano 3 giorni", "manca 1 giorno", "ultimo giorno", "tempo scaduto"
export function timeLeftText(end: number, now: number): string {
  if (roundExpired(end, now)) return 'tempo scaduto';
  const n = daysLeft(end, now);
  if (n <= 0) return 'ultimo giorno';
  return n === 1 ? 'manca 1 giorno' : `mancano ${n} giorni`;
}

// For an <input type="date">: the last day, "2026-12-07"
export function roundEndInputValue(end: number): string {
  const { y, m, d } = romeDay(end - 1);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// From an <input type="date">: the end of that day in Italy; undefined for an empty or wrong value
export function roundEndFromInput(value: string): number | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return romeMidnight(y, m, d + 1);
}

// When the round started: its first challenge created
export function roundStart(games: Pick<HistoryGame, 'createdAt' | 'url'>[]): number | undefined {
  const times = games.filter((g) => g.url).map((g) => g.createdAt).filter((t): t is number => typeof t === 'number' && t > 0);
  return times.length > 0 ? Math.min(...times) : undefined;
}

const isOpen = (g: HistoryGame, states: Record<string, LichessExportGame>) => !!g.url && gameProgress(stateOf(g, states)) !== 'finished';

// The games of the rounds before this one that are not over yet: they go on alongside it
export function carriedOver(round: string, history: HistoryGame[], states: Record<string, LichessExportGame>): HistoryGame[] {
  return history.filter((g) => byRound(g.round, round) < 0 && isOpen(g, states)).sort((a, b) => byRound(a.round, b.round));
}

// Ultime giornate, without naming anybody: "l'ultima partita ancora in corso", "le 2 partite ancora in corso"
export const stillPlayingText = (n: number) => (n === 1 ? "l'ultima partita ancora in corso" : `le ${n} partite ancora in corso`);

export interface ExpiredRound {
  round: string;
  end: number;
  next: string; // the round to start now
  open: HistoryGame[]; // its games still being played, which go on
  // Ultime giornate: the next round is one of the last, and these games of the rounds before it are
  // still being played: it starts when they are over (empty: it can start)
  waitFor: HistoryGame[];
}

// For the organizer: the round in progress is past its end and the next one is still to start.
// Undefined while the option is off, before the end, or when no round follows (the last one).
export function expiredRound(
  meta: Pick<TournamentMeta, 'roundDays' | 'roundEnds' | 'finalRoundsWait'> | undefined,
  rounds: { round: string; created: number }[],
  history: HistoryGame[],
  states: Record<string, LichessExportGame>,
  now: number
): ExpiredRound | undefined {
  const started = rounds.filter((r) => r.created > 0);
  const current = started[started.length - 1];
  if (!current) return undefined;
  const end = roundEndOf(meta, current.round);
  if (end === undefined || !roundExpired(end, now)) return undefined;
  const next = rounds.find((r) => byRound(r.round, current.round) > 0 && r.created === 0);
  if (!next) return undefined;
  const waits = waitsForEarlier(meta, rounds.map((r) => r.round), next.round);
  return {
    round: current.round,
    end,
    next: next.round,
    open: history.filter((g) => g.round === current.round && isOpen(g, states)),
    waitFor: waits ? carriedOver(next.round, history, states) : [],
  };
}
