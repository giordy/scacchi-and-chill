import { HistoryGame, LichessExportGame } from '../types';
import { agoLabel, PresenceInfo } from './presence';
import { extractGameId } from './utils';

// A live game: the two players are on Lichess at the same time and answering each other, as in an
// over-the-board game, although the tournament allows days per move. The site cannot see that
// directly; it reads it from what Lichess gives: a move in the last 15 minutes, and both players
// seen on Lichess in the last 15 minutes. Lichess hides the latest moves of an ongoing game, so who
// is to move is not known: the player who just moved was seen anyway, and the condition on both
// says the other one is there too. An estimate: the other one may be on Lichess for another game.
export const LIVE_WINDOW_MS = 15 * 60 * 1000;

const recent = (at: number | undefined, now: number) => typeof at === 'number' && at > 0 && now - at <= LIVE_WINDOW_MS;

export function isLiveGame(game: Pick<HistoryGame, 'white' | 'black'>, s: LichessExportGame | undefined, presence: PresenceInfo | undefined, now: number): boolean {
  if (!s || s.status !== 'started' || !recent(s.lastMoveAt, now)) return false;
  const seenAt = presence?.seenAt ?? {};
  return recent(seenAt[game.white.toLowerCase()], now) && recent(seenAt[game.black.toLowerCase()], now);
}

// The Lichess ids of the live games of the season
export function liveGameIds(
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  presence: PresenceInfo | undefined,
  now: number
): Set<string> {
  const ids = new Set<string>();
  history.forEach((g) => {
    const id = extractGameId(g.url);
    // decided by the organizer (lib/decisions.ts): over, whatever is played on Lichess
    if (id && !g.decision && isLiveGame(g, gameStates[id], presence, now)) ids.add(id);
  });
  return ids;
}

// How fresh the last move of an ongoing game is, under its state: "♟ 9 min fa", within the day only.
// Only good news: a fresh move says the game is alive, while an old one would point at whoever is
// to move, although they are within the days the rules give them. The game, not a player: Lichess
// hides the latest moves, so the site does not know who moved. short is what the card shows next
// to the piece; full is what a screen reader says.
export const RECENT_MOVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RecentMove {
  short: string; // "poco fa", "9 min fa", "5 ore fa"
  full: string; // "ultima mossa 9 minuti fa"
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export function recentMove(s: LichessExportGame | undefined, now: number): RecentMove | null {
  if (!s || s.status !== 'started' || typeof s.lastMoveAt !== 'number' || s.lastMoveAt <= 0) return null;
  const ago = Math.max(0, now - s.lastMoveAt);
  if (ago >= RECENT_MOVE_WINDOW_MS) return null;
  const short = ago < 5 * MIN ? 'poco fa' : ago < HOUR ? `${Math.floor(ago / MIN)} min fa` : ago < 2 * HOUR ? "un'ora fa" : `${Math.floor(ago / HOUR)} ore fa`;
  return { short, full: `ultima mossa ${agoLabel(s.lastMoveAt, now)}` };
}
