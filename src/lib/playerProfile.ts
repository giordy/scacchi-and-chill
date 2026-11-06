import { collectFinishedGames, playerMoveTimes } from './moveTimes';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../types';
import { computeStandings, isTied, PlayerStanding, seasonStarted, sharedRanks } from './standings';
import { byRound, isVoid, stateOf } from './games';

export type GameOutcome = "win" | "loss" | "draw" | "ongoing" | "pending";

export interface PlayerGame {
  round: string;
  opponent: string; // handle
  color: "white" | "black";
  url: string;
  outcome: GameOutcome;
  opening?: string; // Lichess opening name, when detected
  status?: string; // Lichess status ("forfeit" for a win by forfeit after a withdrawal)
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
  upcoming: UpcomingGame[]; // games still to play, in round order
}

// A game still to play: round and color when the official schedule (or a created link) says so
export interface UpcomingGame {
  round?: string;
  color?: "white" | "black";
}

export interface PlayerProfile {
  player: Player;
  rank: number | null; // 1-based and shared on a full tie (see sharedRanks); null before the first game
  tied: boolean; // the place is shared with someone else
  standing: PlayerStanding;
  games: PlayerGame[];
  remaining: RemainingOpponent[];
  pointsByRound: RoundPoints[];
  headToHead: HeadToHead[];
  pace: GamePace | null; // null until the season's games pin down the estimate
  byColor: Record<"white" | "black", ColorRecord>;
  endings: Endings;
}

// Finished games with one color and the points scored with it
export interface ColorRecord {
  played: number;
  points: number;
}

// How decisive games ended: "timeout" covers both a flag fall and a player gone missing
export type EndReason = "mate" | "resign" | "timeout" | "other";
export interface Endings {
  wins: Record<EndReason, number>;
  losses: Record<EndReason, number>;
  draws: number;
}

const END_REASON: Record<string, EndReason> = {
  mate: "mate",
  resign: "resign",
  outoftime: "timeout",
  timeout: "timeout",
};
const noEndings = (): Record<EndReason, number> => ({ mate: 0, resign: 0, timeout: 0, other: 0 });

// The player's own time per move, told apart from the opponents' (as for "Il bradipo")
export interface GamePace {
  msPerMove: number;
  games: number; // finished games of the player behind the estimate
}

const POINTS: Record<string, number> = { win: 1, draw: 0.5, loss: 0 };

const byRoundOf = (a: { round: string }, b: { round: string }) => byRound(a.round, b.round);

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
  const ranks = sharedRanks(standings);
  const started = seasonStarted(standings);

  const games: PlayerGame[] = [];
  const met = new Set<string>(); // opponents with a valid (not aborted) game
  history.forEach((g) => {
    if (g.white !== me && g.black !== me) return;
    const color = g.white === me ? "white" : "black";
    const opponent = color === "white" ? g.black : g.white;
    const s = stateOf(g, gameStates);
    if (isVoid(s)) return; // to be replayed: shown among the remaining ones

    let outcome: GameOutcome = "pending";
    if (s) {
      if (s.winner) outcome = s.winner === color ? "win" : "loss";
      else if (s.status === "draw" || s.status === "stalemate") outcome = "draw";
      else if (s.status === "started") outcome = "ongoing";
    }
    met.add(opponent);
    games.push({ round: g.round, opponent, color, url: g.url, outcome, opening: s?.opening?.name || undefined, status: s?.status });
  });
  games.sort(byRoundOf);

  const remaining: RemainingOpponent[] = [];
  const listed = new Set<string>();
  schedule
    .filter((m) => m.white === me || m.black === me)
    .sort(byRoundOf)
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
      const vsHistory = history.filter(
        (g) => (g.white === me && g.black === p.handle) || (g.black === me && g.white === p.handle)
      );
      const colorOf = (m: { white: string }) => (m.white === me ? "white" : "black") as "white" | "black";
      const upcoming: UpcomingGame[] = [
        // Scheduled, link not created yet
        ...schedule
          .filter(
            (m) =>
              ((m.white === me && m.black === p.handle) || (m.black === me && m.white === p.handle)) &&
              !vsHistory.some((g) => g.round === m.round && g.white === m.white && g.black === m.black)
          )
          .map((m): UpcomingGame => ({ round: m.round, color: colorOf(m) })),
        // Link created, challenge not accepted yet
        ...games
          .filter((g) => g.opponent === p.handle && g.outcome === "pending")
          .map((g): UpcomingGame => ({ round: g.round, color: g.color })),
        // Aborted games are replayed: no round yet
        ...vsHistory
          .filter((g) => isVoid(stateOf(g, gameStates)))
          .map((): UpcomingGame => ({})),
      ].sort((a, b) => byRound(a.round ?? "~", b.round ?? "~"));
      return {
        opponent: p.handle,
        outcomes: vs.map((g) => g.outcome),
        scored: finished.reduce((sum, g) => sum + POINTS[g.outcome], 0),
        conceded: finished.reduce((sum, g) => sum + (1 - POINTS[g.outcome]), 0),
        upcoming,
      };
    });

  // Own time per move: only once the finished games of the season tell the players apart
  const finished = collectFinishedGames(players, history, gameStates);
  const own = playerMoveTimes(finished);
  const ownMs = own.size >= 2 ? own.get(player.handle) : undefined;
  const pace =
    ownMs !== undefined && ownMs > 0
      ? { msPerMove: ownMs, games: finished.filter((g) => g.white === player.handle || g.black === player.handle).length }
      : null;

  const byColor: Record<"white" | "black", ColorRecord> = {
    white: { played: 0, points: 0 },
    black: { played: 0, points: 0 },
  };
  const endings: Endings = { wins: noEndings(), losses: noEndings(), draws: 0 };
  games.forEach((g) => {
    if (!(g.outcome in POINTS)) return;
    byColor[g.color].played++;
    byColor[g.color].points += POINTS[g.outcome];
    if (g.outcome === "draw") {
      endings.draws++;
      return;
    }
    const status = g.status ?? "";
    endings[g.outcome === "win" ? "wins" : "losses"][END_REASON[status] ?? "other"]++;
  });

  return {
    player,
    rank: started ? ranks[idx] : null,
    tied: started && isTied(ranks, idx),
    standing: standings[idx],
    games,
    remaining,
    pointsByRound,
    headToHead,
    pace,
    byColor,
    endings,
  };
}

// "25 min", "9 h", "1,5 giorni"
export function formatPace(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${String(days).replace(".", ",")} giorni`;
}
