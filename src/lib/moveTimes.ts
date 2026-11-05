import { HistoryGame, LichessExportGame, Player } from '../types';
import { gameProgress } from './progress';
import { extractGameId } from './utils';

// Not played on the board: aborted, never started, or won by forfeit after a withdrawal
const VOID_STATUSES = new Set(["aborted", "noStart", "forfeit"]);

export interface FinishedGame {
  white: string;
  black: string;
  winner?: string; // handle
  draw: boolean;
  status: string;
  moves: number; // full moves, 0 when Lichess sent no moves
  state: LichessExportGame;
}

const fullMoves = (s: LichessExportGame) => {
  const text = s.moves?.trim();
  return text ? Math.ceil(text.split(/\s+/).length / 2) : 0;
};

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
  const plies = s.moves?.trim() ? s.moves.trim().split(/\s+/).length : 0;
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

// Every game's time per half-move is about the average of its two players' own times
// (t_white + t_black = 2 · time / half-moves). With enough games among the same players, a
// least-squares fit weighted by game length gives each player's own time per move, separating
// it from the opponents'. Null when the games do not pin it down (too few games, or a schedule
// where the players split into two groups that only met across, so the times cannot be told apart).
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
  // Gauss-Jordan elimination with partial pivoting
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
  return new Map(handles.map((h, i) => [h, M[i][n] / M[i][i]]));
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
    const id = extractGameId(g.url);
    const s = (id && gameStates[id]) || g.lichess;
    if (!s || gameProgress(s) !== "finished" || VOID_STATUSES.has(s.status)) return;
    games.push({
      white: g.white,
      black: g.black,
      winner: s.winner === "white" ? g.white : s.winner === "black" ? g.black : undefined,
      draw: !s.winner,
      status: s.status,
      moves: fullMoves(s),
      state: s,
    });
  });
  return games;
}

// Each player's own time per move (ms), for the players with at least two timed games, when the
// games pin it down; turns let run out (lost on time) are added on top. Empty when they do not.
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
    // One game alone says little about who was slow
    if (games.filter((g) => g.white === h || g.black === h).length >= 2) result.set(h, own);
  });
  return result;
}
