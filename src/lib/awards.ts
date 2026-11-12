import { ArchivedGame, EloSeed, HistoryGame, LichessExportGame, Player, SeasonArchive, SeasonAward, Withdrawal } from '../types';
import { roundHalf, tournamentElo } from './tournamentElo';
import { PILLSBURY_EMOJI, PILLSBURY_ID, PILLSBURY_TITLE, pillsburyRace, pillsburyWinners } from './pillsbury';

// 5.5 -> "5½", 0.5 -> "½"
const halves = (n: number) => String(Math.round(n * 2) / 2).replace(".5", "½").replace(/^0½/, "½");
export { estimateMoveTimes } from './moveTimes';
export type { TimedGame } from './moveTimes';
import { formatPace } from './playerProfile';
import { collectFinishedGames, playerMoveTimes } from './moveTimes';
import { plural } from './games';
import { pointsText } from './standings';
import { MASTER_OPENING_ID, MASTER_OPENING_TITLE, masterSurname, openingFamily, playsFamily } from './masterOpening';
// L'ammazzagiganti (most colpacci) was given until the Trofeo Pillsbury took its place: past
// seasons keep it, with the Lichess ratings and the gap it used then.
const LEGACY_UPSET_GAP = 150;


// Handles with the highest positive count, in the order of the players list
function leaders(counts: Map<string, number>, players: Player[]): { handles: string[]; best: number } {
  const best = Math.max(0, ...counts.values());
  if (best === 0) return { handles: [], best };
  return { handles: players.map((p) => p.handle).filter((h) => counts.get(h) === best), best };
}

// Il muro needs a real feat: one draw in a season says little, and with few players every award
// given away makes the others worth less
const MIN_COUNT = 2;

// The Trofeo Pillsbury, archived with 🌱 before it became a medal, shows the medal
export const awardEmoji = (a: SeasonAward) => (a.id === PILLSBURY_ID ? PILLSBURY_EMOJI : a.emoji);

// Awards no longer given, hidden in the archived seasons too: Re del matto (most wins by mate),
// added to the Stagione 1 after it ended; with most games won by mate here it went to who won most,
// the champion again
const RETIRED_AWARDS = new Set(["mate"]);
export const shownAwards = (awards: SeasonAward[]) => awards.filter((a) => !RETIRED_AWARDS.has(a.id));
// The names from the code, as for the emoji: an archive saved as "Premio Pillsbury" or
// "Premio Capablanca" shows the new name
export const awardTitle = (a: SeasonAward) =>
  a.id === PILLSBURY_ID ? PILLSBURY_TITLE : a.id === MASTER_OPENING_ID ? MASTER_OPENING_TITLE : a.title;

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
  seeds?: EloSeed[], // where this season's esordienti started (TournamentMeta.seeds)
  withdrawals?: Withdrawal[], // who left: out of the race for the Trofeo Pillsbury
  master?: { name?: string; opening?: string } // the season's master and their opening family
): SeasonAward[] {
  const nameOf = (h: string) => players.find((p) => p.handle === h)?.name ?? h;
  const who = (handles: string[]) => handles.map((handle) => ({ handle, name: nameOf(handle) }));
  const games = collectFinishedGames(players, history, gameStates);

  const awards: SeasonAward[] = [];

  // Trofeo Pillsbury: who beat their pronostico by most (see lib/pillsbury). First, apart from
  // the light-hearted awards. One winner, unless two beat it by the same (to a millionth of a point),
  // and only above the objective as the race table shows it (▲): not the first of those in line.
  const race = pillsburyRace(players, tournamentElo(seasons, players.map((p) => p.handle), history, gameStates, seeds), history, history, gameStates, withdrawals);
  const top = pillsburyWinners(race);
  if (top.length > 0) {
    const best = top[0];
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

  // L'allievo: who played the master's opening most, from the side that chooses it (White
  // for an opening or a gambit, Black for a defense). No game in it, no award.
  const family = openingFamily(master?.opening);
  if (family) {
    const counts = new Map<string, number>();
    const played = games.filter((g) => playsFamily(g.state.opening?.name, family));
    played.forEach((g) => {
      const h = family.side === 'white' ? g.white : g.black;
      counts.set(h, (counts.get(h) ?? 0) + 1);
    });
    const top = leaders(counts, players);
    if (top.handles.length > 0) {
      const surname = masterSurname(master?.name);
      awards.push({
        id: MASTER_OPENING_ID,
        emoji: "♞",
        title: MASTER_OPENING_TITLE,
        description: `A chi ha giocato più volte l'apertura ${surname ? `di ${surname}` : "del maestro"}, ${family.label}, ${family.side === "white" ? "con il bianco" : "con il nero"}`,
        winners: who(top.handles),
        detail: `${family.label}: ${plural(top.best, "partita", "partite")}`,
        ...linked(played.filter((g) => top.handles.includes(family.side === "white" ? g.white : g.black)).map((g) => g.state.id)),
      });
    }
  }

  return awards;
}

const names = (award: SeasonAward) => {
  const list = award.winners.map((w) => w.name);
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}` : list[0] ?? "";
};

// One line per award, e.g. "Anna (in 12 mosse)"
export const awardWinnersLine = (award: SeasonAward) => `${names(award)} (${award.detail})`;

// The main trophy at the top of the message: its name and who leads the table
export interface ScudettoLine {
  title: string; // "Scudetto Capablanca"
  names: string[]; // the first place, shared on a full tie
  points: number;
}

// Message for the WhatsApp group: the Scudetto first, then the Trofeo Pillsbury, then the rest
export function awardsMessage(season: string, awards: SeasonAward[], scudetto?: ScudettoLine): string {
  const main = awards.find((a) => a.id === PILLSBURY_ID);
  const others = awards.filter((a) => a !== main);
  const line = (a: SeasonAward) => `${awardEmoji(a)} *${awardTitle(a)}*: ${awardWinnersLine(a)}`;
  const joined = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}` : list[0] ?? "");
  return [
    `🏆 *I premi di ${season}*`,
    "",
    ...(scudetto && scudetto.names.length > 0
      ? [`🏆 *${scudetto.title}*: ${joined(scudetto.names)} (${pointsText(scudetto.points)}${scudetto.names.length > 1 ? ", a pari merito" : ""})`, ""]
      : []),
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
