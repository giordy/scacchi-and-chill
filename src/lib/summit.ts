import { HistoryGame, LichessExportGame, Player } from '../types';
import { computeStandings } from './standings';
import { byRound } from './games';

// Scontro al vertice: both players in the top 3 of the standings at the start of the round
export const SUMMIT_TOP = 3;
// Rounds that must be behind before the standings say who is at the top
export const SUMMIT_MIN_ROUNDS = 3;

export const summitKey = (g: { round: string; white: string; black: string }) => `${g.round}|${g.white}|${g.black}`;

// "1° contro 2°", or "entrambi al 2° posto" when they are level on points
export function positionsText(a: number, b: number): string {
  if (a === b) return `entrambi al ${a}° posto`;
  const [hi, lo] = a < b ? [a, b] : [b, a];
  return `${hi}° contro ${lo}°`;
}

// The places of the two players of a summit game, at the start of its round (1 = first)
export interface SummitRanks {
  white: number;
  black: number;
}

// For every round, the standings from the games of the earlier rounds (as Lichess has them now):
// a game whose two players both rank in the top 3 is a summit. Rank is shared on equal points
// (3, 2, 2 points → 1st, 2nd, 2nd). Only from the 4th round (after one round, "first" just means
// having won once), and only when the top 3 places hold at most 3 players: when ties crowd them,
// the top of the table means little.
// Returns the places of the two players of each summit game, by summitKey.
export function summitRanks(
  players: Player[],
  games: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): Map<string, SummitRanks> {
  const result = new Map<string, SummitRanks>();
  const rounds = [...new Set(games.map((g) => g.round))].sort(byRound);
  rounds.forEach((round, i) => {
    if (i < SUMMIT_MIN_ROUNDS) return;
    const before = games.filter((g) => byRound(g.round, round) < 0);
    const { standings } = computeStandings(players, before, gameStates);
    if (!standings[0] || standings[0].points <= 0) return;
    const rank = new Map(standings.map((s) => [s.handle, 1 + standings.filter((o) => o.points > s.points).length]));
    const top = standings.filter((s) => rank.get(s.handle)! <= SUMMIT_TOP);
    if (top.length > SUMMIT_TOP) return;
    games
      .filter((g) => g.round === round)
      .forEach((g) => {
        const white = rank.get(g.white);
        const black = rank.get(g.black);
        if (white !== undefined && black !== undefined && white <= SUMMIT_TOP && black <= SUMMIT_TOP) {
          result.set(summitKey(g), { white, black });
        }
      });
  });
  return result;
}

// The same summits, each with its positions text ("1° contro 2°")
export function summitGames(
  players: Player[],
  games: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): Map<string, string> {
  const ranks = summitRanks(players, games, gameStates);
  return new Map([...ranks].map(([key, r]) => [key, positionsText(r.white, r.black)]));
}
