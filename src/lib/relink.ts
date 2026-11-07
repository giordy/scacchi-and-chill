// A new Lichess link for a game of a round: when the open challenge expired without being
// accepted, when Lichess aborted the game, or when the two players created the game themselves.
import { HistoryGame, LichessExportGame } from '../types';
import { isVoid } from './games';
import { formatDeadline } from './utils';

const DAY_MS = 86400000;

export type LinkState =
  | { kind: 'waiting'; expiresAt: number } // challenge still open, not accepted yet
  | { kind: 'expired'; expiredAt: number } // challenge expired, not accepted
  | { kind: 'void' } // aborted or never started on Lichess: to play again
  | { kind: 'playing' }; // accepted: the link must not change any more

// Where the link of a game stands. Without a creation time the challenge counts as still open.
export function linkState(game: HistoryGame, state: LichessExportGame | undefined, expiryDays: number, now = Date.now()): LinkState {
  if (isVoid(state)) return { kind: 'void' };
  // Lichess exports a game only once its challenge is accepted: from then on it is being played
  if (state) return { kind: 'playing' };
  const created = game.createdAt ?? now;
  const end = created + expiryDays * DAY_MS;
  return now > end ? { kind: 'expired', expiredAt: end } : { kind: 'waiting', expiresAt: end };
}

// The link can be changed until the game is accepted, or when Lichess voided it
export const canRelink = (s: LinkState) => s.kind !== 'playing';

// A game the players created themselves: it must be between the same two players. When their
// colors are the other way round, the game takes Lichess's colors (the results are read by color).
export function checkOwnGame(
  state: LichessExportGame,
  white: string,
  black: string
): { white: string; black: string; swapped: boolean } | { error: string } {
  const w = state.players?.white?.user?.id ?? state.players?.white?.user?.name ?? '';
  const b = state.players?.black?.user?.id ?? state.players?.black?.user?.name ?? '';
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  if (same(w, white) && same(b, black)) return { white, black, swapped: false };
  if (same(w, black) && same(b, white)) return { white: black, black: white, swapped: true };
  return { error: `Su Lichess la partita è tra @${w || '?'} e @${b || '?'}, non tra i due giocatori di questo turno.` };
}

// The WhatsApp line with the new link
export function relinkMessage(round: string, whiteName: string, blackName: string, url: string, expiresAt?: number): string {
  return (
    `🔁 *Turno ${round}*: nuovo link per *${whiteName}* ⚪ vs *${blackName}* ⚫\n${url}` +
    (expiresAt ? `\nDa accettare entro ${formatDeadline(expiresAt)}.` : '')
  );
}
