import { HistoryGame, LichessExportGame, Player, SeasonAward } from '../types';
import { computeGamePace, formatPace } from './playerProfile';
import { gameProgress } from './progress';
import { extractGameId } from './utils';

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

  // Maratoneti: both players of the longest game
  const played = games.filter((g) => g.moves > 0);
  if (played.length > 0) {
    const most = Math.max(...played.map((g) => g.moves));
    const longest = played.filter((g) => g.moves === most);
    const handles = players.map((p) => p.handle).filter((h) => longest.some((g) => g.white === h || g.black === h));
    const only = longest.length === 1 ? longest[0] : undefined;
    awards.push({
      id: "longest",
      emoji: "🏃",
      title: "Maratoneti",
      description: "La partita più lunga della stagione",
      winners: who(handles),
      detail: only ? `${nameOf(only.white)} – ${nameOf(only.black)}, ${plural(most, "mossa", "mosse")}` : plural(most, "mossa", "mosse"),
    });
  }

  // Il bradipo: the calmest pace (both sides of the board, as on the player page)
  const paces = players
    .map((p) => ({
      handle: p.handle,
      pace: computeGamePace(games.filter((g) => g.white === p.handle || g.black === p.handle).map((g) => g.state)),
    }))
    .filter((x): x is { handle: string; pace: NonNullable<typeof x.pace> } => x.pace !== null);
  const slowest = Math.max(0, ...paces.map((x) => x.pace.msPerMove));
  const sloths = paces.filter((x) => x.pace.msPerMove === slowest).map((x) => x.handle);
  // Only when someone actually stands out (one game alone gives both players the same pace)
  if (paces.length >= 2 && sloths.length < paces.length) {
    awards.push({
      id: "slowest",
      emoji: "🦥",
      title: "Il bradipo",
      description: "Per chi si gode ogni mossa con calma: le sue partite hanno il ritmo più lento",
      winners: who(sloths),
      detail: `${formatPace(slowest)} a mossa`,
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
