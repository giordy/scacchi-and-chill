// Results decided by the organizer (Turni → the game → "Risultato deciso dall'organizzatore"), in place
// of Lichess': for a game past the time allowed (lib/overdue.ts) and without an agreement, or one never
// started. Saved on the game document (field `decision`), beside the state read from Lichess, which
// stays as it is: the game may still be open there. Removing the decision gives Lichess' result back.
// Applied with the withdrawals (lib/withdrawals.ts applyWithdrawals), so the standings, the crosstable,
// the cronaca, the bulletin and the archive read it as any other result; like the games decided at the
// table it is out of the Elo del torneo, the Trofeo Pillsbury, the awards and the records (decidedAtTable).
import { GameDecision, GameResult, HistoryGame, LichessExportGame } from '../types';
import { DECIDED, DOUBLE_LOSS } from './games';
import { extractGameId } from './utils';

export const DECISION_RESULTS: GameResult[] = ['1-0', '0-1', '½-½', '0-0'];

const isResult = (v: unknown): v is GameResult => typeof v === 'string' && (DECISION_RESULTS as string[]).includes(v);

// A decision as read from Firestore: undefined unless well formed
export function cleanDecision(raw: unknown): GameDecision | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  if (!isResult(d.result) || typeof d.at !== 'number' || !Number.isFinite(d.at)) return undefined;
  const note = typeof d.note === 'string' && d.note.trim() ? d.note.trim() : undefined;
  return { result: d.result, at: d.at, ...(note ? { note } : {}) };
}

// The state of a decided game, as the rest of the site reads a result: 'decided' (a winner, or a draw
// without one) or 'doubleLoss' (0-0), ended when it was decided. The result only: no moves, opening
// nor final position, which are those of a game not finished on the board (they would count among
// the games of the master's opening, or as "2 mosse" on its card). The players stay, for the names
export function decidedState(g: HistoryGame, d: GameDecision): LichessExportGame {
  const base = g.lichess;
  return {
    id: base?.id ?? extractGameId(g.url) ?? '',
    status: d.result === '0-0' ? DOUBLE_LOSS : DECIDED,
    ...(d.result === '1-0' ? { winner: 'white' as const } : d.result === '0-1' ? { winner: 'black' as const } : {}),
    lastMoveAt: d.at,
    ...(base?.createdAt ? { createdAt: base.createdAt } : {}),
    ...(base?.players ? { players: base.players } : {}),
  };
}

// The season with the decisions in place of Lichess' results
export function applyDecisions(history: HistoryGame[]): HistoryGame[] {
  return history.some((g) => g.decision) ? history.map((g) => (g.decision ? { ...g, lichess: decidedState(g, g.decision) } : g)) : history;
}

// "1-0 per Anna", "Patta", "0-0: persa per entrambi"
export function decisionLabel(result: GameResult, white: string, black: string): string {
  if (result === '1-0') return `1-0: vince ${white}`;
  if (result === '0-1') return `0-1: vince ${black}`;
  if (result === '½-½') return '½-½: patta';
  return '0-0: persa per entrambi';
}
