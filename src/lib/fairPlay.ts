import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';

export interface CheatCase {
  id: string; // Lichess game id
  url: string;
  round: string;
  white: string;
  black: string;
  handle: string; // the player Lichess found at fault (the loser of the game)
  opponent: string;
  count: number; // games closed for cheating of this player so far, this one included
}

// Games closed by Lichess with "cheat detected", in round order. Lichess gives the win to the
// other player, so the player at fault is the loser.
export function cheatCases(history: HistoryGame[], gameStates: Record<string, LichessExportGame>): CheatCase[] {
  const byRound = (a: HistoryGame, b: HistoryGame) => a.round.localeCompare(b.round, undefined, { numeric: true });
  const seen = new Map<string, number>();
  const cases: CheatCase[] = [];
  [...history].sort(byRound).forEach((g) => {
    const id = extractGameId(g.url);
    const s = (id && gameStates[id]) || g.lichess;
    if (!id || s?.status !== 'cheat' || !s.winner) return;
    const handle = s.winner === 'white' ? g.black : g.white;
    const count = (seen.get(handle) ?? 0) + 1;
    seen.set(handle, count);
    cases.push({ id, url: g.url, round: g.round, white: g.white, black: g.black, handle, opponent: handle === g.white ? g.black : g.white, count });
  });
  return cases;
}
