import { ArchivedGame, HistoryGame, LichessExportGame, Player, SeasonAward } from '../types';
export { estimateMoveTimes } from './moveTimes';
export type { TimedGame } from './moveTimes';
import { formatPace } from './playerProfile';
import { collectFinishedGames, playerMoveTimes } from './moveTimes';
import { plural } from './games';
import { upsetOf, UPSET_GAP } from './upset';


// Handles with the highest positive count, in the order of the players list
function leaders(counts: Map<string, number>, players: Player[]): { handles: string[]; best: number } {
  const best = Math.max(0, ...counts.values());
  if (best === 0) return { handles: [], best };
  return { handles: players.map((p) => p.handle).filter((h) => counts.get(h) === best), best };
}

// At most this many games are linked from an award: beyond, a list of links says little
const MAX_LINKED = 3;
const linked = (ids: Array<string | undefined>) => {
  const list = [...new Set(ids.filter((id): id is string => !!id))];
  return list.length > 0 && list.length <= MAX_LINKED ? { games: list } : {};
};

// Pure function: the light-hearted awards of a season, computed on finished games only.
// An award with no possible winner (e.g. no game ended in mate) is left out.
export function computeSeasonAwards(
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): SeasonAward[] {
  const nameOf = (h: string) => players.find((p) => p.handle === h)?.name ?? h;
  const who = (handles: string[]) => handles.map((handle) => ({ handle, name: nameOf(handle) }));
  const games = collectFinishedGames(players, history, gameStates);

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
      ...linked(games.filter((g) => g.status === "mate" && g.winner && mate.handles.includes(g.winner)).map((g) => g.state.id)),
    });
  }

  // Fulmine: the decisive game won in the fewest moves. The loser is not named: it would put
  // the quickest defeat of the season on display
  const decisive = games.filter((g) => g.winner && g.moves > 0);
  if (decisive.length > 0) {
    const fewest = Math.min(...decisive.map((g) => g.moves));
    const winners = [...new Set(decisive.filter((g) => g.moves === fewest).map((g) => g.winner as string))];
    awards.push({
      id: "fastest",
      emoji: "⚡",
      title: "Fulmine",
      description: "La vittoria più rapida della stagione",
      winners: who(winners),
      detail: `in ${plural(fewest, "mossa", "mosse")}`,
      ...linked(decisive.filter((g) => g.moves === fewest).map((g) => g.state.id)),
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
      ...linked(longest.map((g) => g.state.id)),
    });
  }

  // Il bradipo: the player who takes the longest over their own moves
  const eligible = [...playerMoveTimes(games)];
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
      ...linked(games.filter((g) => g.winner && giant.handles.includes(g.winner) && upsetOf(g.state)).map((g) => g.state.id)),
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

// The games of the awards of a season archived before awards carried them: found again in the
// archived games with the same rules (winners as awarded, moves as full moves)
export function withAwardGames(awards: SeasonAward[], games: ArchivedGame[] | undefined): SeasonAward[] {
  if (!games || games.length === 0) return awards;
  const winnerOf = (g: ArchivedGame) => (g.result === '1-0' ? g.white : g.result === '0-1' ? g.black : undefined);
  const decisive = games.filter((g) => winnerOf(g) && g.status !== 'forfeit' && (g.plies ?? 0) > 0);
  const moves = (g: ArchivedGame) => Math.ceil((g.plies ?? 0) / 2);
  return awards.map((a) => {
    if (a.games) return a;
    const won = (g: ArchivedGame) => a.winners.some((w) => w.handle.toLowerCase() === winnerOf(g)?.toLowerCase());
    let found: ArchivedGame[] = [];
    if (a.id === 'fastest' && decisive.length) found = decisive.filter((g) => moves(g) === Math.min(...decisive.map(moves)));
    else if (a.id === 'longest' && decisive.length) found = decisive.filter((g) => moves(g) === Math.max(...decisive.map(moves)));
    else if (a.id === 'mate') found = decisive.filter((g) => g.status === 'mate' && won(g));
    else if (a.id === 'upsets') {
      found = decisive.filter((g) => {
        if (!won(g) || g.provisional || g.whiteRating === undefined || g.blackRating === undefined) return false;
        const gap = g.result === '1-0' ? g.blackRating - g.whiteRating : g.whiteRating - g.blackRating;
        return gap >= UPSET_GAP;
      });
    }
    return { ...a, ...linked(found.map((g) => g.id)) };
  });
}
