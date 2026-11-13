// Small helpers on games shared across the app: one place for how a game is read
import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';

// Rounds are strings ("1", "2", … "10"): numeric order, not alphabetical
export const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// Statuses of a game that never took place on the board: replayed, dropped or awarded
export const VOID_STATUSES = new Set(['aborted', 'noStart']);
export const isVoid = (s?: LichessExportGame) => !!s && VOID_STATUSES.has(s.status);

// Games decided at the table: points in the standings, but they say nothing of anyone's level or
// play, so they are out of the Elo del torneo, the Trofeo Pillsbury, the awards and the records:
// forfeits after a withdrawal, and games Lichess closed for cheating ("cheat detected")
export const decidedAtTable = (status: string | undefined) => status === 'forfeit' || status === 'cheat';

// The Lichess state of a game: the fresh one read from Lichess when there is one, otherwise the
// one stored with the game (also the only one of a game won by forfeit, which has no link)
export function stateOf(g: HistoryGame, gameStates: Record<string, LichessExportGame>): LichessExportGame | undefined {
  const id = extractGameId(g.url);
  return (id && gameStates[id]) || g.lichess;
}

// When a game started: the earlier of the link's creation and the game's creation on Lichess. The
// stored date alone is not enough: a restore from a backup writes the day of the restore on games
// that lost it, and Lichess knows the real one.
export function startedAt(g: HistoryGame, s?: LichessExportGame): number | undefined {
  const times = [g.createdAt, s?.createdAt].filter((t): t is number => typeof t === 'number' && t > 0);
  return times.length > 0 ? Math.min(...times) : undefined;
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

const isFinal = (s?: LichessExportGame) => Boolean(s && s.status && s.status !== 'created' && s.status !== 'started');

// The games the organizer's sync reads from Lichess: those with a link whose stored result is not
// final yet. `linked` counts every game with a link, to tell "nothing to sync" from "no links yet".
export function syncTargets(history: HistoryGame[]): { linked: number; targets: HistoryGame[]; ids: string[] } {
  const withLink = history.filter((g) => extractGameId(g.url));
  const targets = withLink.filter((g) => !isFinal(g.lichess));
  const ids = Array.from(new Set(targets.map((g) => extractGameId(g.url) as string)));
  return { linked: withLink.length, targets, ids };
}
