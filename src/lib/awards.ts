import { ArchivedGame, EloSeed, HistoryGame, LichessExportGame, Player, SeasonArchive, SeasonAward } from '../types';
import { roundHalf, tournamentElo } from './tournamentElo';
import { PILLSBURY_EMOJI, PILLSBURY_ID, PILLSBURY_TITLE, pillsburyRace } from './pillsbury';

// 5.5 -> "5½", 0.5 -> "½"
const halves = (n: number) => String(Math.round(n * 2) / 2).replace(".5", "½").replace(/^0½/, "½");
export { estimateMoveTimes } from './moveTimes';
export type { TimedGame } from './moveTimes';
import { formatPace } from './playerProfile';
import { collectFinishedGames, playerMoveTimes } from './moveTimes';
import { plural } from './games';
// L'ammazzagiganti (most colpacci) was given until the Trofeo Pillsbury took its place: past
// seasons keep it, with the Lichess ratings and the gap it used then
const LEGACY_UPSET_GAP = 150;


// Handles with the highest positive count, in the order of the players list
function leaders(counts: Map<string, number>, players: Player[]): { handles: string[]; best: number } {
  const best = Math.max(0, ...counts.values());
  if (best === 0) return { handles: [], best };
  return { handles: players.map((p) => p.handle).filter((h) => counts.get(h) === best), best };
}

// Re del matto and Il muro need a real feat: one mate or one draw in a season says little, and
// with few players every award given away makes the others worth less
const MIN_COUNT = 2;

// Re del matto: ⚔️, not the crown, which next to a name means the reigning champion. Seasons
// archived before keep 👑 in their data: awardEmoji shows them with the new one. The same for the
// Trofeo Pillsbury, archived with 🌱 before it became a medal.
const MATE_EMOJI = "⚔️";
export const awardEmoji = (a: SeasonAward) => (a.id === "mate" ? MATE_EMOJI : a.id === PILLSBURY_ID ? PILLSBURY_EMOJI : a.emoji);
// The name of the Pillsbury from the code, as for the emoji: an archive saved as "Premio Pillsbury" shows the new name
export const awardTitle = (a: SeasonAward) => (a.id === PILLSBURY_ID ? PILLSBURY_TITLE : a.title);

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
  gameStates: Record<string, LichessExportGame>,
  seasons: SeasonArchive[] = [], // archived seasons, for the Elo del torneo of the Trofeo Pillsbury
  seeds?: EloSeed[] // where this season's esordienti started (TournamentMeta.seeds)
): SeasonAward[] {
  const nameOf = (h: string) => players.find((p) => p.handle === h)?.name ?? h;
  const who = (handles: string[]) => handles.map((handle) => ({ handle, name: nameOf(handle) }));
  const games = collectFinishedGames(players, history, gameStates);

  const awards: SeasonAward[] = [];

  // Trofeo Pillsbury: who beat their pronostico by most (see lib/pillsbury). First, apart from
  // the light-hearted awards. One winner, unless two beat it by exactly the same.
  const race = pillsburyRace(players, tournamentElo(seasons, players.map((p) => p.handle), history, gameStates, seeds), history, history, gameStates);
  const best = race.rows[0];
  if (!race.suspended && best && best.over > 0) {
    const top = race.rows.filter((r) => r.over === best.over);
    const f = best.forecast;
    awards.push({
      id: PILLSBURY_ID,
      emoji: PILLSBURY_EMOJI,
      title: PILLSBURY_TITLE,
      description: "A chi ha superato di più il proprio obiettivo, come Pillsbury a Hastings nel 1895 (esordienti esclusi)",
      winners: who(top.map((r) => r.handle)),
      detail: top.length === 1
        ? `${halves(f.points)} ${f.points === 1 ? "punto" : "punti"} su ${plural(f.played, "partita", "partite")}, obiettivo ${halves(roundHalf(f.expectedSoFar))}`
        : `${halves(best.over)} punti più dell'obiettivo`,
    });
  }

  // Re del matto: most wins by checkmate
  const mates = new Map<string, number>();
  games.forEach((g) => g.winner && g.status === "mate" && mates.set(g.winner, (mates.get(g.winner) ?? 0) + 1));
  const mate = leaders(mates, players);
  if (mate.handles.length > 0 && mate.best >= MIN_COUNT) {
    awards.push({
      id: "mate",
      emoji: MATE_EMOJI,
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

  // Il muro: most draws
  const draws = new Map<string, number>();
  games.forEach((g) => {
    if (!g.draw) return;
    draws.set(g.white, (draws.get(g.white) ?? 0) + 1);
    draws.set(g.black, (draws.get(g.black) ?? 0) + 1);
  });
  const wall = leaders(draws, players);
  if (wall.handles.length > 0 && wall.best >= MIN_COUNT) {
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
  const main = awards.find((a) => a.id === PILLSBURY_ID);
  const others = awards.filter((a) => a !== main);
  const line = (a: SeasonAward) => `${awardEmoji(a)} *${awardTitle(a)}*: ${awardWinnersLine(a)}`;
  return [
    `🏆 *I premi di ${season}*`,
    "",
    // The Trofeo Pillsbury first and apart, with what it rewards
    ...(main ? [line(main), `_${main.description}_`, ...(others.length > 0 ? ["", "E poi, per sorridere:"] : [])] : []),
    ...others.map(line),
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
        return gap >= LEGACY_UPSET_GAP;
      });
    }
    return { ...a, ...linked(found.map((g) => g.id)) };
  });
}
