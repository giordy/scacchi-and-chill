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

// Cumulative points after each round in which the player finished at least one game
export interface RoundPoints {
  round: string;
  points: number; // total after this round
  games: { opponent: string; outcome: "win" | "loss" | "draw" }[];
}

// Season record against one opponent
export interface HeadToHead {
  opponent: string; // handle
  outcomes: GameOutcome[]; // in round order, finished and ongoing games
  scored: number; // points the player took from this opponent
  conceded: number;
  toPlay: number; // scheduled games against this opponent not created yet
}

export interface PlayerProfile {
  player: Player;
  rank: number; // 1-based
  standing: PlayerStanding;
  games: PlayerGame[];
  remaining: RemainingOpponent[];
  pointsByRound: RoundPoints[];
  headToHead: HeadToHead[];
}

const POINTS: Record<string, number> = { win: 1, draw: 0.5, loss: 0 };

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

  const pointsByRound: RoundPoints[] = [];
  let total = 0;
  games.forEach((g) => {
    if (g.outcome !== "win" && g.outcome !== "draw" && g.outcome !== "loss") return;
    total += POINTS[g.outcome];
    const last = pointsByRound[pointsByRound.length - 1];
    if (last && last.round === g.round) {
      last.points = total;
      last.games.push({ opponent: g.opponent, outcome: g.outcome });
    } else {
      pointsByRound.push({ round: g.round, points: total, games: [{ opponent: g.opponent, outcome: g.outcome }] });
    }
  });

  // One row per opponent, in the order of the players list
  const headToHead: HeadToHead[] = players
    .filter((p) => p.handle !== me)
    .map((p) => {
      const vs = games.filter((g) => g.opponent === p.handle && g.outcome !== "pending");
      const finished = vs.filter((g) => g.outcome in POINTS);
      const created = history.filter(
        (g) => (g.white === me && g.black === p.handle) || (g.black === me && g.white === p.handle)
      );
      const toPlay = schedule.filter(
        (m) =>
          ((m.white === me && m.black === p.handle) || (m.black === me && m.white === p.handle)) &&
          !created.some((g) => g.round === m.round && g.white === m.white && g.black === m.black)
      ).length;
      const pending = games.filter((g) => g.opponent === p.handle && g.outcome === "pending").length;
      return {
        opponent: p.handle,
        outcomes: vs.map((g) => g.outcome),
        scored: finished.reduce((sum, g) => sum + POINTS[g.outcome], 0),
        conceded: finished.reduce((sum, g) => sum + (1 - POINTS[g.outcome]), 0),
        toPlay: toPlay + pending,
      };
    });

  return { player, rank: idx + 1, standing: standings[idx], games, remaining, pointsByRound, headToHead };
}
