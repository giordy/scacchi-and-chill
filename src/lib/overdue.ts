// Partite troppo lunghe (optional, off until the organizer sets a number of days in Impostazioni →
// Avvisi): a game not over that many days after the start of its round (its first challenge) is shown
// in Turni and notified to the organizer's devices by the GitHub Action (scripts/push.mjs). A notice, not
// a rule: the organizer talks with the players and, without an agreement, can decide the result
// (lib/decisions.ts). Works with the Turni con scadenza on or off.
import { HistoryGame, LichessExportGame, TournamentMeta } from '../types';
import { byRound } from './games';
import { isOpen, roundEndFrom, roundStart } from './roundDeadline';

export const DEFAULT_OVERDUE_DAYS = 21;
export const MIN_OVERDUE_DAYS = 3;
export const MAX_OVERDUE_DAYS = 90;

export const overdueDaysOf = (meta: Pick<TournamentMeta, 'overdueDays'> | undefined): number =>
  typeof meta?.overdueDays === 'number' && meta.overdueDays > 0 ? Math.floor(meta.overdueDays) : 0;

export interface OverdueGame {
  game: HistoryGame;
  limit: number; // when it went past the days allowed: the end of the last day in Italy, ms
}

// The games past the days allowed, oldest round first. Empty while the option is off
export function overdueGames(
  meta: Pick<TournamentMeta, 'overdueDays'> | undefined,
  history: HistoryGame[],
  states: Record<string, LichessExportGame>,
  now: number
): OverdueGame[] {
  const days = overdueDaysOf(meta);
  if (days === 0) return [];
  const starts = new Map<string, number | undefined>();
  const startOf = (round: string) => {
    if (!starts.has(round)) starts.set(round, roundStart(history.filter((g) => g.round === round)));
    return starts.get(round);
  };
  return history
    .filter((g) => isOpen(g, states))
    .flatMap((game) => {
      const start = startOf(game.round);
      if (start === undefined) return [];
      const limit = roundEndFrom(start, days);
      return now >= limit ? [{ game, limit }] : [];
    })
    .sort((a, b) => byRound(a.game.round, b.game.round) || a.limit - b.limit);
}
