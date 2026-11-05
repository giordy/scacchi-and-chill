import { HistoryGame, LichessExportGame, Player, SeasonAward } from '../types';
import { formatPace } from './playerProfile';
import { gameProgress } from './progress';
import { extractGameId } from './utils';
import { upsetOf, UPSET_GAP } from './upset';

const VOID_STATUSES = new Set(["aborted", "noStart"]);

interface FinishedGame {
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Handles with the highest positive count, in the order of the players list
function leaders(counts: Map<string, number>, players: Player[]): { handles: string[]; best: number } {
  const best = Math.max(0, ...counts.values());
  if (best === 0) return { handles: [], best };
  return { handles: players.map((p) => p.handle).filter((h) => counts.get(h) === best), best };
}

// Pure function: the light-hearted awards of a season, computed on finished games only.
// An award with no possible winner (e.g. no game ended in mate) is left out.
export function computeSeasonAwards(
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): SeasonAward[] {
  const known = new Set(players.map((p) => p.handle));
  const nameOf = (h: string) => players.find((p) => p.handle === h)?.name ?? h;
  const who = (handles: string[]) => handles.map((handle) => ({ handle, name: nameOf(handle) }));

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

  const awards: SeasonAward[] = [];

  // Re del matto: most wins by checkmate
  const mates = new Map<string, number>();
  games.forEach((g) => g.winner && g.status === "mate" && mates.set(g.winner, (mates.get(g.winner) ?? 0) + 1));
  const mate = leaders(mates, players);
  if (mate.handles.length > 0) {
    awards.push({
      id: "mate",
      emoji: "👑",
      title: "Re del matto",
      description: "Più vittorie chiuse con lo scacco matto",
      winners: who(mate.handles),
      detail: plural(mate.best, "vittoria col matto", "vittorie col matto"),
    });
  }

  // Fulmine: the decisive game won in the fewest moves
  const decisive = games.filter((g) => g.winner && g.moves > 0);
  if (decisive.length > 0) {
    const fewest = Math.min(...decisive.map((g) => g.moves));
    const fastest = decisive.filter((g) => g.moves === fewest);
    const winners = [...new Set(fastest.map((g) => g.winner as string))];
    const only = fastest.length === 1 ? fastest[0] : undefined;
    const loser = only && (only.winner === only.white ? only.black : only.white);
    awards.push({
      id: "fastest",
      emoji: "⚡",
      title: "Fulmine",
      description: "La vittoria più rapida della stagione",
      winners: who(winners),
      detail: `in ${plural(fewest, "mossa", "mosse")}${loser ? ` contro ${nameOf(loser)}` : ""}`,
    });
  }

  // Il maratoneta: the decisive game won in the most moves (the winner was willing to go on)
  if (decisive.length > 0) {
    const most = Math.max(...decisive.map((g) => g.moves));
    const longest = decisive.filter((g) => g.moves === most);
    const winners = [...new Set(longest.map((g) => g.winner as string))];
    const only = longest.length === 1 ? longest[0] : undefined;
    const loser = only && (only.winner === only.white ? only.black : only.white);
    awards.push({
      id: "longest",
      emoji: "🏃",
      title: "Il maratoneta",
      description: "La vittoria più lunga della stagione",
      winners: who(winners),
      detail: `in ${plural(most, "mossa", "mosse")}${loser ? ` contro ${nameOf(loser)}` : ""}`,
    });
  }

  // Il bradipo: the player who takes the longest over their own moves
  const timed = games.map(timedGame).filter((t): t is TimedGame => t !== null);
  const times = estimateMoveTimes(timed);
  if (times) {
    // Own moves in the timed games, then the turns let run out on top: average again
    times.forEach((t, h) => {
      const moves = timed.filter((g) => g.white === h || g.black === h).reduce((n, g) => n + g.plies / 2, 0);
      const lost = games.map(timeoutTurn).filter((x) => x?.loser === h) as { ms: number }[];
      if (lost.length === 0) return;
      times.set(h, (t * moves + lost.reduce((sum, x) => sum + x.ms, 0)) / (moves + lost.length));
    });
    // Only players with at least two games: one game alone says little about who was slow
    const eligible = [...times].filter(([h]) => games.filter((g) => g.white === h || g.black === h).length >= 2);
    const slowest = Math.max(...eligible.map(([, t]) => t));
    const sloths = players.map((p) => p.handle).filter((h) => eligible.some(([e, t]) => e === h && t === slowest));
    if (eligible.length >= 2 && sloths.length < eligible.length) {
      awards.push({
        id: "slowest",
        emoji: "🦥",
        title: "Il bradipo",
        description: "Per chi si gode ogni mossa con calma: il più lento a rispondere, stimato dalla durata delle sue partite",
        winners: who(sloths),
        detail: `circa ${formatPace(slowest)} per ogni sua mossa`,
      });
    }
  }

  // L'ammazzagiganti: most colpacci (wins against a much higher rated opponent)
  const upsets = new Map<string, number>();
  games.forEach((g) => {
    if (!g.winner || !upsetOf(g.state)) return;
    upsets.set(g.winner, (upsets.get(g.winner) ?? 0) + 1);
  });
  const giant = leaders(upsets, players);
  if (giant.handles.length > 0) {
    awards.push({
      id: "upsets",
      emoji: "💥",
      title: "L'ammazzagiganti",
      description: `Più colpacci: vittorie contro chi aveva almeno ${UPSET_GAP} punti Elo in più`,
      winners: who(giant.handles),
      detail: plural(giant.best, "colpaccio", "colpacci"),
    });
  }

  // Il muro: most draws
  const draws = new Map<string, number>();
  games.forEach((g) => {
    if (!g.draw) return;
    draws.set(g.white, (draws.get(g.white) ?? 0) + 1);
    draws.set(g.black, (draws.get(g.black) ?? 0) + 1);
  });
  const wall = leaders(draws, players);
  if (wall.handles.length > 0) {
    awards.push({
      id: "draws",
      emoji: "🧱",
      title: "Il muro",
      description: "Più partite chiuse in parità",
      winners: who(wall.handles),
      detail: plural(wall.best, "patta", "patte"),
    });
  }

  return awards;
}

const names = (award: SeasonAward) => {
  const list = award.winners.map((w) => w.name);
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}` : list[0] ?? "";
};

// One line per award, e.g. "Anna (3 vittorie col matto)"
export const awardWinnersLine = (award: SeasonAward) => `${names(award)} (${award.detail})`;

// Message for the WhatsApp group
export function awardsMessage(season: string, awards: SeasonAward[]): string {
  return [
    `🏆 *I premi di ${season}*`,
    "",
    ...awards.map((a) => `${a.emoji} *${a.title}*: ${awardWinnersLine(a)}`),
  ].join("\n");
}
