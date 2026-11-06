import { HistoryGame, LichessExportGame } from '../types';
import { gameProgress } from './progress';
import { isVoid, stateOf } from './games';

// When a season was played, to the month: "2026-11" (month keys, in Italian time)
export interface SeasonPeriod {
  start?: string;
  end?: string;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && MONTH_KEY.test(v);

// "2026-11" for a moment, in Italian time (a game started on 31 October at 23:30 UTC is November)
export function monthKey(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

// The period of a season from its games: from the first challenge created to the last move of the
// last finished game. No end while games are still to play.
export function periodOfGames(history: HistoryGame[], gameStates: Record<string, LichessExportGame> = {}): SeasonPeriod {
  const states = history.map((g) => ({ g, s: stateOf(g, gameStates) }));
  const created = states
    .map(({ g, s }) => g.createdAt ?? s?.createdAt)
    .filter((t): t is number => typeof t === 'number' && t > 0);
  const played = states.filter(({ s }) => !isVoid(s));
  const finished = played.length > 0 && played.every(({ s }) => gameProgress(s) === 'finished');
  const lastMoves = played.map(({ s }) => s?.lastMoveAt).filter((t): t is number => typeof t === 'number' && t > 0);
  return {
    start: created.length > 0 ? monthKey(Math.min(...created)) : undefined,
    end: finished && lastMoves.length > 0 ? monthKey(Math.max(...lastMoves)) : undefined,
  };
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// "nov 2026" (short) or "novembre 2026"
export function monthLabel(key: string, long = false): string {
  const [y, m] = key.split('-');
  const name = MONTHS[Number(m) - 1];
  return `${long ? name : name.slice(0, 3)} ${y}`;
}

// "nov 2026 – mar 2027", "nov 2026" when it fits one month, "da nov 2026" while it is going on,
// "fino a mar 2027" when only the end is known; empty without dates
export function periodLabel({ start, end }: SeasonPeriod, long = false): string {
  const s = isMonthKey(start) ? start : undefined;
  const e = isMonthKey(end) ? end : undefined;
  if (s && e) return s === e ? monthLabel(s, long) : `${monthLabel(s, long)} – ${monthLabel(e, long)}`;
  if (s) return `da ${monthLabel(s, long)}`;
  if (e) return `fino a ${monthLabel(e, long)}`;
  return '';
}

// The period of a past season: the one in the hall of fame (the organizer can correct it), else the
// one saved with the archive, else the archive date as its end. Older hall of fame entries only had
// the year.
export function pastSeasonPeriod(
  winner: { start?: string; end?: string; year?: string } | undefined,
  archive?: { start?: string; end?: string; archivedAt?: string }
): string {
  const fromWinner = winner ? periodLabel(winner) : '';
  if (fromWinner) return fromWinner;
  const end = archive?.end ?? (archive?.archivedAt ? monthKey(Date.parse(archive.archivedAt)) : undefined);
  const fromArchive = archive ? periodLabel({ start: archive.start, end }) : '';
  return fromArchive || winner?.year || '';
}
