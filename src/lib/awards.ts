import { ArchivedGame, EloSeed, HistoryGame, LichessExportGame, Player, SeasonArchive, SeasonAward, Withdrawal } from '../types';
import { roundHalf } from './tournamentElo';
import { finalPillsburyRace, PILLSBURY_EMOJI, PILLSBURY_ID, PILLSBURY_TITLE, pillsburyWinners } from './pillsbury';

// 5.5 -> "5½", 0.5 -> "½"
const halves = (n: number) => String(Math.round(n * 2) / 2).replace(".5", "½").replace(/^0½/, "½");
export { estimateMoveTimes } from './moveTimes';
export type { TimedGame } from './moveTimes';
import { formatPace } from './playerProfile';
import { collectFinishedGames, playerMoveTimes } from './moveTimes';
import { plural } from './games';
import { pointsText } from './standings';
import { outForFairPlay } from './fairPlay';
import { decidedAtTable } from './games';
import { MASTER_OPENING_ID, MASTER_OPENING_TITLE, masterSurname, openingFamily, playsFamily } from './masterOpening';
import { analysisOf, moveLabel } from './analysis';
import { extractGameId } from './utils';
import type { FinishedGame } from './moveTimes';
import type { GameAnalysis } from '../types';
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
  master?: { name?: string; opening?: string }, // the season's master and their opening family
  fairPlayBan?: boolean // TournamentMeta.fairPlayAwardsBan: who had a game closed for cheating wins nothing
): SeasonAward[] {
  const nameOf = (h: string) => players.find((p) => p.handle === h)?.name ?? h;
  const who = (handles: string[]) => handles.map((handle) => ({ handle, name: nameOf(handle) }));
  const games = collectFinishedGames(players, history, gameStates);
  const out = outForFairPlay(fairPlayBan, history, gameStates);
  const can = (h: string | undefined) => !!h && !out.has(h.toLowerCase());

  const awards: SeasonAward[] = [];

  // Trofeo Pillsbury: who beat their pronostico by most (see lib/pillsbury). First, apart from
  // the light-hearted awards. One winner, unless two beat it by the same (to a millionth of a point),
  // and only above the objective as the race table shows it (▲): not the first of those in line.
  const race = finalPillsburyRace(players, history, gameStates, seasons, seeds, withdrawals, fairPlayBan);
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
        : `${halves(best.gap)} punti più dell'obiettivo`,
    });
  }

  // Fulmine: the decisive game won in the fewest moves. The loser is not named: it would put
  // the quickest defeat of the season on display
  const decisive = games.filter((g) => can(g.winner) && g.moves > 0);
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
  const eligible = [...playerMoveTimes(games)].filter(([h]) => can(h));
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
    [g.white, g.black].filter(can).forEach((h) => draws.set(h, (draws.get(h) ?? 0) + 1));
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
      if (can(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
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

  awards.push(...analysisAwards(history, games, can, nameOf, who));

  return awards;
}

// The awards from the analysis of the games (lib/analysis.ts): only the games the GitHub Action has
// analysed count, so a game finished in the last minutes may be missing. None on how alike a
// player's moves are to the engine's: it would invite talk of cheating.
// Houdini: the lowest chances (%) a game was saved or won from: a lost position
const HOUDINI_MAX = 20;
// La mossa della stagione: an only move, every other move clearly worse (points of chances)
const MOVE_MIN_GAP = 20;
// La partita della stagione: turns, chances and changes of lead, together at least
const BATTLE_MIN = 3;

// How many times the lead changed hands along a game: White ahead (58% or more) to Black ahead
// (42% or less) or back, the level stretches between not counted
export function leadChanges(curve: number[]): number {
  let leader: 'white' | 'black' | undefined;
  let changes = 0;
  for (const w of curve) {
    const now = w >= 58 ? 'white' : w <= 42 ? 'black' : undefined;
    if (!now) continue;
    if (leader && now !== leader) changes++;
    leader = now;
  }
  return changes;
}

type Who = (handles: string[]) => { handle: string; name: string }[];

function analysisAwards(history: HistoryGame[], games: FinishedGame[], can: (h?: string) => boolean, nameOf: (h: string) => string, who: Who): SeasonAward[] {
  const byId = new Map(games.map((g) => [g.state.id, g]));
  const analysed: { g: FinishedGame; a: GameAnalysis }[] = history.flatMap((h) => {
    const id = extractGameId(h.url);
    const g = id ? byId.get(id) : undefined;
    const a = g ? analysisOf(h) : undefined;
    return g && a ? [{ g, a }] : [];
  });
  const other = (g: FinishedGame, h: string) => (h === g.white ? g.black : g.white);
  const awards: SeasonAward[] = [];

  // Houdini: a game won or drawn from the lowest chances; a win on time is no comeback on the board
  const escapes = analysed.flatMap(({ g, a }) =>
    (['white', 'black'] as const).flatMap((color) => {
      const handle = g[color];
      if (!can(handle) || (g.winner && g.winner !== handle) || g.status === 'outoftime' || g.status === 'timeout') return [];
      const low = Math.min(...(a.curve ?? []).map((w) => (color === 'white' ? w : 100 - w)));
      return low <= HOUDINI_MAX ? [{ handle, low, g, won: g.winner === handle }] : [];
    })
  );
  if (escapes.length > 0) {
    const lowest = Math.min(...escapes.map((e) => e.low));
    const top = escapes.filter((e) => e.low === lowest);
    const pct = lowest < 1 ? "meno dell'1%" : `${lowest}%`;
    const one = top.length === 1 ? top[0] : undefined;
    awards.push({
      id: 'houdini',
      emoji: '🪄',
      title: 'Houdini',
      description: "La rimonta più grande: la partita vinta o salvata dalla posizione più difficile, secondo l'analisi",
      winners: who([...new Set(top.map((e) => e.handle))]),
      detail: one ? `da ${pct} di possibilità ${one.won ? 'alla vittoria' : 'alla patta'} contro ${nameOf(other(one.g, one.handle))}` : `da ${pct} di possibilità`,
      ...linked(top.map((e) => e.g.state.id)),
    });
  }

  // La mossa della stagione: the only move with every other move the most worse
  const onlyMoves = analysed.flatMap(({ g, a }) =>
    (a.best ?? []).map((b) => ({ b, g, handle: g[b.color] })).filter((x) => can(x.handle) && (x.b.gap ?? 0) >= MOVE_MIN_GAP)
  );
  if (onlyMoves.length > 0) {
    const widest = Math.max(...onlyMoves.map((x) => x.b.gap ?? 0));
    const top = onlyMoves.filter((x) => x.b.gap === widest);
    const one = top.length === 1 ? top[0] : undefined;
    awards.push({
      id: 'move',
      emoji: '🎯',
      title: 'La mossa della stagione',
      description: "La mossa più difficile da trovare: quella in cui ogni altra mossa era peggiore di più, secondo l'analisi",
      winners: who([...new Set(top.map((x) => x.handle))]),
      detail: one ? `${moveLabel(one.b.ply, one.b.san)} contro ${nameOf(other(one.g, one.handle))}` : 'mosse uniche di pari valore',
      ...linked(top.map((x) => x.g.state.id)),
    });
  }

  // La partita della stagione: the most fought game, to both its players, with why it was
  const battles = analysed
    .filter(({ g }) => can(g.white) && can(g.black))
    .map(({ g, a }) => {
      const turns = a.turns?.length ?? 0;
      const chances = a.chances?.length ?? 0;
      const changes = leadChanges(a.curve ?? []);
      return { g, turns, chances, changes, score: 2 * turns + chances + changes };
    })
    .filter((x) => x.turns + x.chances + x.changes >= BATTLE_MIN)
    // the most fought; on a tie, more turns, then the longer game
    .sort((x, y) => y.score - x.score || y.turns - x.turns || y.g.moves - x.g.moves);
  const battle = battles[0];
  if (battle) {
    const { g } = battle;
    const why = [
      battle.turns > 0 ? plural(battle.turns, 'svolta', 'svolte') : '',
      battle.chances > 0 ? plural(battle.chances, 'occasione', 'occasioni') : '',
      battle.changes > 0 ? `il vantaggio passato di mano ${battle.changes === 1 ? 'una volta' : `${battle.changes} volte`}` : '',
    ].filter(Boolean);
    const list = why.length > 1 ? `${why.slice(0, -1).join(', ')} e ${why[why.length - 1]}` : why[0];
    awards.push({
      id: 'battle',
      emoji: '🎢',
      title: 'La partita della stagione',
      description: "La partita più combattuta, ai suoi due giocatori: più svolte, occasioni e cambi di vantaggio, secondo l'analisi",
      winners: who([g.white, g.black]),
      // the players are the winners already: the detail is why
      detail: list,
      ...linked([g.state.id]),
    });
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
  const decisive = games.filter((g) => winnerOf(g) && !decidedAtTable(g.status) && (g.plies ?? 0) > 0);
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
