import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../types';
import { computeStandings, PlayerStanding } from './standings';
import { extractGameId } from './utils';

export type GameOutcome = "win" | "loss" | "draw" | "ongoing" | "pending";

export interface PlayerGame {
  round: string;
  opponent: string; // handle
  color: "white" | "black";
  url: string;
  outcome: GameOutcome;
}

export interface RemainingOpponent {
  opponent: string; // handle
  round?: string; // set when the opponent is in the official schedule
  color?: "white" | "black";
}

export interface PlayerProfile {
  player: Player;
  rank: number; // 1-based
  standing: PlayerStanding;
  games: PlayerGame[];
  remaining: RemainingOpponent[];
}

const VOID_STATUSES = new Set(["aborted", "noStart"]);
const byRound = (a: { round: string }, b: { round: string }) =>
  a.round.localeCompare(b.round, undefined, { numeric: true });

// Pure function: everything shown on a player's page. Returns null for an unknown handle.
export function computePlayerProfile(
  handle: string,
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  schedule: ScheduledMatch[] = []
): PlayerProfile | null {
  const player = players.find((p) => p.handle.toLowerCase() === handle.toLowerCase());
  if (!player) return null;
  const me = player.handle;

  const { standings } = computeStandings(players, history, gameStates);
  const idx = standings.findIndex((s) => s.handle === me);

  const games: PlayerGame[] = [];
  const met = new Set<string>(); // opponents with a valid (not aborted) game
  history.forEach((g) => {
    if (g.white !== me && g.black !== me) return;
    const color = g.white === me ? "white" : "black";
    const opponent = color === "white" ? g.black : g.white;
    const id = extractGameId(g.url);
    const s = id ? gameStates[id] : undefined;
    if (s && VOID_STATUSES.has(s.status)) return; // to be replayed: shown among the remaining ones

    let outcome: GameOutcome = "pending";
    if (s) {
      if (s.winner) outcome = s.winner === color ? "win" : "loss";
      else if (s.status === "draw" || s.status === "stalemate") outcome = "draw";
      else if (s.status === "started") outcome = "ongoing";
    }
    met.add(opponent);
    games.push({ round: g.round, opponent, color, url: g.url, outcome });
  });
  games.sort(byRound);

  const remaining: RemainingOpponent[] = [];
  const listed = new Set<string>();
  schedule
    .filter((m) => m.white === me || m.black === me)
    .sort(byRound)
    .forEach((m) => {
      const color = m.white === me ? "white" : "black";
      const opponent = color === "white" ? m.black : m.white;
      if (met.has(opponent) || listed.has(opponent)) return;
      listed.add(opponent);
      remaining.push({ opponent, round: m.round, color });
    });
  players.forEach((p) => {
    if (p.handle === me || met.has(p.handle) || listed.has(p.handle)) return;
    remaining.push({ opponent: p.handle });
  });

  return { player, rank: idx + 1, standing: standings[idx], games, remaining };
}
