// Small helpers on games shared across the app: one place for how a game is read
import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';

// Rounds are strings ("1", "2", … "10"): numeric order, not alphabetical
export const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// Statuses of a game that never took place on the board: replayed, dropped or awarded
export const VOID_STATUSES = new Set(['aborted', 'noStart']);
export const isVoid = (s?: LichessExportGame) => !!s && VOID_STATUSES.has(s.status);

// The Lichess state of a game: the fresh one read from Lichess when there is one, otherwise the
// one stored with the game (also the only one of a game won by forfeit, which has no link)
export function stateOf(g: HistoryGame, gameStates: Record<string, LichessExportGame>): LichessExportGame | undefined {
  const id = extractGameId(g.url);
  return (id && gameStates[id]) || g.lichess;
}

// Half-moves Lichess sent (for ongoing games the last ones are hidden, anti-cheat)
export function pliesOf(s?: LichessExportGame): number {
  const moves = s?.moves?.trim();
  return moves ? moves.split(/\s+/).length : 0;
}

// Full moves, as players count them
export const fullMovesOf = (s?: LichessExportGame) => Math.ceil(pliesOf(s) / 2);

// "1 mossa", "34 mosse"
export const movesText = (n: number) => `${n} ${n === 1 ? 'mossa' : 'mosse'}`;

// Display name of a handle from the players list (the handle itself when unknown)
export const nameFrom = (players: { handle: string; name: string }[]) => (handle: string) =>
  players.find((p) => p.handle === handle)?.name ?? handle;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Games keyed by their Lichess id, with the state stored on Firestore (field `lichess`)
export function storedStates(history: HistoryGame[]): Record<string, LichessExportGame> {
  const map: Record<string, LichessExportGame> = {};
  history.forEach((g) => {
    const id = extractGameId(g.url);
    if (id && g.lichess) map[id] = g.lichess;
  });
  return map;
}
