import { HistoryGame, LichessExportGame } from '../types';
import { PresenceInfo } from './presence';
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
    if (id && isLiveGame(g, gameStates[id], presence, now)) ids.add(id);
  });
  return ids;
}
