import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';
import { byRound, stateOf } from './games';

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
  const seen = new Map<string, number>();
  const cases: CheatCase[] = [];
  [...history].sort((a, b) => byRound(a.round, b.round)).forEach((g) => {
    const id = extractGameId(g.url);
    const s = stateOf(g, gameStates);
    if (!id || s?.status !== 'cheat' || !s.winner) return;
    const handle = s.winner === 'white' ? g.black : g.white;
    const count = (seen.get(handle) ?? 0) + 1;
    seen.set(handle, count);
    cases.push({ id, url: g.url, round: g.round, white: g.white, black: g.black, handle, opponent: handle === g.white ? g.black : g.white, count });
  });
  return cases;
}

// From the season after the one it was decided in, a game closed for cheating also costs the
// Trofeo Pillsbury and the season's awards (the Scudetto stays with the standings). Said in the rules:
// the sentence goes in when that season is closed (lib/seasonClose.ts).
export const AWARDS_BAN_RULE =
  "Per tutta la stagione è anche fuori dal Trofeo Pillsbury e dagli altri premi della stagione (lo Scudetto resta di chi vince la classifica).";
const FIRST_PENALTY = "perde la partita e i punti del turno.";

// The fair play rules with the sentence: after the penalty of a first time, or at the end
export function withAwardsBanRule(text: string): string {
  if (text.includes(AWARDS_BAN_RULE)) return text;
  if (text.includes(FIRST_PENALTY)) return text.replace(FIRST_PENALTY, `${FIRST_PENALTY} ${AWARDS_BAN_RULE}`);
  return text.trim() ? `${text.trimEnd()}\n• ${AWARDS_BAN_RULE}` : text;
}

// Who is out of the Trofeo Pillsbury and the awards, by lower-case handle: nobody until the rule applies
export function outForFairPlay(
  ban: boolean | undefined,
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): Set<string> {
  return new Set(ban ? cheatCases(history, gameStates).map((c) => c.handle.toLowerCase()) : []);
}
