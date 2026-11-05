import { HistoryGame, LichessExportGame, Player } from '../types';
import { computeStandings } from './standings';

// Scontro al vertice: both players in the top 3 of the standings at the start of the round
export const SUMMIT_TOP = 3;

const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
export const summitKey = (g: { round: string; white: string; black: string }) => `${g.round}|${g.white}|${g.black}`;

// "1° contro 2°", or "entrambi al 2° posto" when they are level on points
export function positionsText(a: number, b: number): string {
  if (a === b) return `entrambi al ${a}° posto`;
  const [hi, lo] = a < b ? [a, b] : [b, a];
  return `${hi}° contro ${lo}°`;
}

// For every round, the standings from the games of the earlier rounds (as Lichess has them now):
// a game whose two players both rank in the top 3 is a summit. Rank is shared on equal points
// (3, 2, 2 points → 1st, 2nd, 2nd). Not before anyone has scored, nor when ties put more than
// four players in the top 3, since then the top of the table means little.
// Returns the positions text of each summit game, by summitKey.
export function summitGames(
  players: Player[],
  games: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): Map<string, string> {
  const result = new Map<string, string>();
  const rounds = [...new Set(games.map((g) => g.round))].sort(byRound);
  rounds.forEach((round) => {
    const before = games.filter((g) => byRound(g.round, round) < 0);
    const { standings } = computeStandings(players, before, gameStates);
    if (!standings[0] || standings[0].points <= 0) return;
    const rank = new Map(standings.map((s) => [s.handle, 1 + standings.filter((o) => o.points > s.points).length]));
    const top = standings.filter((s) => rank.get(s.handle)! <= SUMMIT_TOP);
    if (top.length > SUMMIT_TOP + 1) return;
    games
      .filter((g) => g.round === round)
      .forEach((g) => {
        const a = rank.get(g.white);
        const b = rank.get(g.black);
        if (a !== undefined && b !== undefined && a <= SUMMIT_TOP && b <= SUMMIT_TOP) {
          result.set(summitKey(g), positionsText(a, b));
        }
      });
  });
  return result;
}
