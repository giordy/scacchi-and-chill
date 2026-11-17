import { HistoryGame, LichessExportGame, Player } from '../types';
import { gameProgress } from './progress';
import { decidedAtTable, fullMovesOf, isVoid, pliesOf, stateOf } from './games';

// Not played to its end on the board: aborted, never started, won by forfeit after a withdrawal, or
// closed by Lichess for cheating (the win of the other player says nothing of the game: no Fulmine
// or Maratoneta from it)
const notPlayed = (s: LichessExportGame) => isVoid(s) || decidedAtTable(s.status);

export interface FinishedGame {
  white: string;
  black: string;
  winner?: string; // handle
  draw: boolean;
  status: string;
  moves: number; // full moves, 0 when Lichess sent no moves
  state: LichessExportGame;
}

// A game as thinking time and half-moves: Lichess keeps no per-move times for correspondence
// games, only when the game started and its last move
export interface TimedGame {
  white: string;
  black: string;
  ms: number; // thinking time of both sides together
  plies: number; // half-moves, split evenly between the two players
}

const DAY = 24 * 3600 * 1000;

function timedGame(g: FinishedGame): TimedGame | null {
  const s = g.state;
  const plies = pliesOf(s);
  if (!s.createdAt || !s.lastMoveAt || plies === 0 || s.lastMoveAt < s.createdAt) return null;
  return { white: g.white, black: g.black, ms: s.lastMoveAt - s.createdAt, plies };
}

// Lost on time: the loser let a whole turn run out after the last move. That time is known to
// be theirs alone, so it is added to their own estimate rather than to the game.
function timeoutTurn(g: FinishedGame): { loser: string; ms: number } | null {
  const s = g.state;
  if ((s.status !== "outoftime" && s.status !== "timeout") || !g.winner || !s.daysPerTurn) return null;
  return { loser: g.winner === g.white ? g.black : g.white, ms: s.daysPerTurn * DAY };
}

// How much the season average counts in each player's estimate, in half-moves: about one game.
// With few games a player stays close to the average; with many, their own games decide.
export const PRIOR_PLIES = 80;

// Solves M·t = r (r in the last column) by Gauss-Jordan elimination with partial pivoting;
// null when M is singular
function solve(M: number[][]): number[] | null {
  const n = M.length;
  const scale = Math.max(...M.map((row, i) => row[i]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < scale * 1e-6) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Every game's time per half-move is about the average of its two players' own times
// (t_white + t_black = 2 · time / half-moves). A least-squares fit weighted by game length gives
// each player's own time per move, separating it from the opponents'. Alone, with few games, that
// fit reproduces every game exactly and throws the times to the extremes (even below zero), so
// each player is also pulled towards the season average, with the weight of PRIOR_PLIES
// half-moves. Null when the games do not pin it down (too few games, or a schedule where the
// players split into two groups that only met across, so the times cannot be told apart).
export function estimateMoveTimes(games: TimedGame[]): Map<string, number> | null {
  const handles = [...new Set(games.flatMap((g) => [g.white, g.black]))];
  const n = handles.length;
  if (n < 2 || games.length < n) return null;
  const idx = new Map(handles.map((h, i) => [h, i]));
  // Normal equations M·t = r, with r in the last column
  const M = handles.map(() => Array(n + 1).fill(0) as number[]);
  games.forEach((g) => {
    const pair = [idx.get(g.white)!, idx.get(g.black)!];
    pair.forEach((i) => {
      pair.forEach((j) => (M[i][j] += g.plies));
      M[i][n] += 2 * g.ms;
    });
  });
  // Whether the games alone tell the players apart
  if (!solve(M.map((row) => [...row]))) return null;
  // Average time per own move over the whole season, as the prior
  const mean = games.reduce((s, g) => s + g.ms, 0) / games.reduce((s, g) => s + g.plies, 0);
  M.forEach((row, i) => {
    row[i] += PRIOR_PLIES;
    row[n] += PRIOR_PLIES * mean;
  });
  const t = solve(M)!;
  return new Map(handles.map((h, i) => [h, t[i]]));
}


// Finished games between known players, aborted ones left out
export function collectFinishedGames(
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): FinishedGame[] {
  const known = new Set(players.map((p) => p.handle));
  const games: FinishedGame[] = [];
  history.forEach((g) => {
    if (!known.has(g.white) || !known.has(g.black)) return;
    const s = stateOf(g, gameStates);
    if (!s || gameProgress(s) !== "finished" || notPlayed(s)) return;
    games.push({
      white: g.white,
      black: g.black,
      winner: s.winner === "white" ? g.white : s.winner === "black" ? g.black : undefined,
      draw: !s.winner,
      status: s.status,
      moves: fullMovesOf(s),
      state: s,
    });
  });
  return games;
}

// Finished games a player needs before their own time per move is shown: with fewer, the estimate
// says more about the opponents and the season average than about them
export const MIN_PACE_GAMES = 3;

// Each player's own time per move (ms), for the players with at least MIN_PACE_GAMES finished
// games, when the games pin it down; turns let run out (lost on time) are added on top. Empty
// when they do not.
export function playerMoveTimes(games: FinishedGame[]): Map<string, number> {
  const timed = games.map(timedGame).filter((t): t is TimedGame => t !== null);
  const times = estimateMoveTimes(timed);
  const result = new Map<string, number>();
  if (!times) return result;
  times.forEach((t, h) => {
    // Own moves in the timed games, then the turns let run out on top: average again
    const moves = timed.filter((g) => g.white === h || g.black === h).reduce((n, g) => n + g.plies / 2, 0);
    const lost = games.map(timeoutTurn).filter((x) => x?.loser === h) as { ms: number }[];
    const own = lost.length === 0 ? t : (t * moves + lost.reduce((sum, x) => sum + x.ms, 0)) / (moves + lost.length);
    if (games.filter((g) => g.white === h || g.black === h).length >= MIN_PACE_GAMES) result.set(h, own);
  });
  return result;
}
