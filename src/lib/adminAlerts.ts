// The organizer's alerts, in one list behind the 🔔 of the organizer area instead of boxes stacked on
// top of the tabs. An alert stays while its problem is open and goes when it is solved, not when read:
// the number on the bell is what is left to do. The only one to acknowledge is a first fair play case
// (FairPlayAlert), as before.
// Not here: the feedback of an action just made (saved, failed), the games created on Lichess and not
// saved in the tournament (their links live on one device: shown in Turni, where they can be saved),
// and the steps between two seasons (a guide, not a problem: SeasonChecklistPanel).
import { HistoryGame, LichessExportGame, ScheduledMatch, TournamentMeta, Withdrawal } from '../types';
import { CheatCase, cheatCases } from './fairPlay';
import { OverdueGame, overdueGames } from './overdue';
import { StaleLink, staleLinks } from './relink';
import { ExpiredRound, expiredRound } from './roundDeadline';
import { roundsOf } from './rounds';
import { SyncHealth } from './syncHealth';
import { TokenCheck, tokenWarning } from './tokenCheck';

export type AdminAlert =
  | { kind: 'token'; check: TokenCheck }
  | { kind: 'sync'; health: Extract<SyncHealth, { kind: 'stale' }> }
  | { kind: 'fairPlay'; cases: CheatCase[] }
  | { kind: 'staleLinks'; links: StaleLink[] }
  | { kind: 'overdue'; games: OverdueGame[] }
  | { kind: 'round'; expired: ExpiredRound };

// Urgent: something does not work (no new round, no results) or the rules ask the organizer to act.
// A token that still works and expires soon is not urgent yet
export const isUrgent = (a: AdminAlert) =>
  (a.kind === 'token' && a.check.kind !== 'expiring') || a.kind === 'sync' || a.kind === 'fairPlay';
// A round waiting for its last games is news, nothing to do: listed, not counted
export const isInfo = (a: AdminAlert) => a.kind === 'round' && !!a.expired.waitReason;

export interface AlertsInput {
  meta?: TournamentMeta;
  schedule: ScheduledMatch[];
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  expiryDays: number; // days a challenge stays open (Settings.expiry)
  tokenCheck: TokenCheck | null;
  syncHealth: SyncHealth | null;
  withdrawals: Withdrawal[];
  fairPlaySeen: string[]; // first cases already acknowledged
  now: number;
}

// The fair play cases to show: a first case until acknowledged, a repeat until the player is out of
// the tournament (withdrawn or excluded)
export function openCheatCases(history: HistoryGame[], gameStates: Record<string, LichessExportGame>, withdrawals: Withdrawal[], seen: string[]): CheatCase[] {
  const left = new Set(withdrawals.map((w) => w.handle.toLowerCase()));
  return cheatCases(history, gameStates).filter((c) => !left.has(c.handle.toLowerCase()) && (c.count >= 2 || !seen.includes(c.id)));
}

// Every open alert, urgent first
export function adminAlerts(input: AlertsInput): AdminAlert[] {
  const { meta, schedule, history, gameStates, now } = input;
  const out: AdminAlert[] = [];
  if (input.tokenCheck && tokenWarning(input.tokenCheck)) out.push({ kind: 'token', check: input.tokenCheck });
  if (input.syncHealth?.kind === 'stale') out.push({ kind: 'sync', health: input.syncHealth });
  const cases = openCheatCases(history, gameStates, input.withdrawals, input.fairPlaySeen);
  if (cases.length > 0) out.push({ kind: 'fairPlay', cases });
  const links = staleLinks(history, gameStates, input.expiryDays, now);
  if (links.length > 0) out.push({ kind: 'staleLinks', links });
  const late = overdueGames(meta, history, gameStates, now);
  if (late.length > 0) out.push({ kind: 'overdue', games: late });
  const expired = expiredRound(meta, roundsOf(schedule, history), history, gameStates, now);
  if (expired) out.push({ kind: 'round', expired });
  // Stable: within the urgent ones and the others, the order above
  return [...out.filter(isUrgent), ...out.filter((a) => !isUrgent(a))];
}

// What the bell shows: the alerts to act on, and whether one of them is urgent
export function alertsBadge(alerts: AdminAlert[]): { count: number; urgent: boolean } {
  const counted = alerts.filter((a) => !isInfo(a));
  return { count: counted.length, urgent: counted.some(isUrgent) };
}
