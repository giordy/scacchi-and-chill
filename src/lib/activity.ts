// Cronaca: what happened in the tournament, as a list of events in the order they happened. Everything
// is read from the data the site already has (games, their Lichess states, withdrawals, archived
// seasons): nothing is stored for it. Ongoing games give no event, Lichess hides their last moves.
import { HistoryGame, LichessExportGame, MasterAnecdote, Player, ScheduledMatch, SeasonArchive, Withdrawal } from '../types';
import { byRound, isVoid, movesText, stateOf } from './games';
import { leadersOf, pointsText, scoredResult } from './standings';
import { CURRENT, decidedAtTable, EloReport, gameKey, playersOnBoard } from './tournamentElo';
import { upsetFrom, upsetOf } from './upset';
import { masterSurname, openingFamily, playsFamily } from './masterOpening';
import { HOW_DRAW, HOW_WIN, extractGameId } from './utils';
import { isReturnLeg, returnLegStart } from './legs';
import { computeSeasonProgress } from './progress';
import { withScheduledGames } from './publicGames';
import { summitGames, summitKey } from './summit';
import { titleRace } from './titleRace';
import { anecdoteForRound } from './masterAnecdotes';
import { publicViewHref } from './routes';

// A piece of an event's sentence: plain text, or a player (shown as a link to their page)
export type ActivityPart = string | { handle: string };

export type ActivityKind =
  | 'season' // the first round starts
  | 'round' // a round starts
  | 'anecdote' // the anecdote of the master of the round
  | 'withdrawal'
  | 'result'
  | 'firstWin' // a first win of the season after games without one, or the first in the tournament
  | 'streak' // a third win in a row, or more
  | 'leader' // someone goes alone at the top
  | 'champion' // nobody can reach the leader any more
  | 'roundEnd' // the last game of a round is over
  | 'end'; // the last game of the season is over

export interface ActivityEvent {
  key: string; // stable, for React
  kind: ActivityKind;
  at: number; // ms
  emoji: string;
  parts: ActivityPart[];
  detail?: string; // a second, smaller line
  tags?: string[]; // "Colpaccio", "L'apertura di Capablanca"
  gameId?: string; // Lichess id, for a link to the game
  link?: { href: string; label: string }; // a page of the site
  score?: string; // a result: "1 – 0", "0 – 1", "½ – ½"
}

type Result = '1-0' | '0-1' | '½-½';

// A scored game as the cronaca needs it, from the current season or an archive
interface ScoredGame {
  key: string;
  round: string;
  white: string; // as the standings count it (a substitute takes over the games of who left)
  black: string;
  boardWhite: string; // who actually sat at the board
  boardBlack: string;
  result: Result;
  status?: string;
  plies?: number;
  opening?: string;
  at: number;
  id?: string;
  upset: boolean;
  master: boolean;
  summit?: boolean; // scontro al vertice (see lib/summit.ts)
  silent?: boolean; // counts for the standings but has no event of its own (forfeits after a withdrawal)
}

const lower = (h: string) => h.toLowerCase();

function resultParts(g: ScoredGame): ActivityPart[] {
  if (g.result === '½-½') {
    const how = HOW_DRAW[g.status ?? ''];
    return [{ handle: g.boardWhite }, ' e ', { handle: g.boardBlack }, ` fanno patta${how ? ` ${how}` : ''}`];
  }
  const [winner, loser] = g.result === '1-0' ? [g.boardWhite, g.boardBlack] : [g.boardBlack, g.boardWhite];
  const how = g.status === 'cheat' ? 'a tavolino' : HOW_WIN[g.status ?? ''];
  return [{ handle: winner }, ' batte ', { handle: loser }, how ? ` ${how}` : ''];
}

// "Turno 3 · 34 mosse · Italian Game"
const gameDetail = (g: ScoredGame) =>
  [g.round && /\d/.test(g.round) ? `Turno ${g.round}` : '', g.plies ? movesText(Math.ceil(g.plies / 2)) : '', g.opening ?? '']
    .filter(Boolean)
    .join(' · ');

// A win in a row worth telling, from the third (as the record in the Albo)
const MIN_STREAK = 3;
const ORDINALS = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima'];
const ordinal = (n: number) => ORDINALS[n] ?? `${n}ª`;

// A first win worth telling: the very first in the tournament (from the second season on, for who
// never won before), or the first of the season after at least one game without a win. A win in the
// first game of the season is just a good start: the result says it already.
function firstWinText(gamesPlayed: number, firstEver: boolean): string | undefined {
  if (firstEver) return ' conquista la sua prima vittoria nel torneo';
  return gamesPlayed > 1 ? ' conquista la sua prima vittoria della stagione' : undefined;
}

// The events of the games: one per result; a first win (see firstWinText); one for each win from the
// third in a row; one each time someone goes alone at the top of the standings (points, then
// Sonneborn-Berger, then wins, as the table). A shared first place gives no event; going back alone
// on top after it does only for someone new.
// pastWinners: who won a game in an earlier season, by lower-case handle; undefined when there is no
// earlier season to tell a first win in the tournament from (the first season, or an archive)
function gameEvents(games: ScoredGame[], seasonKey: string, masterLabel: string, pastWinners?: Set<string>): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const ordered = [...games].sort((a, b) => a.at - b.at || byRound(a.round, b.round));
  const points = new Map<string, number>();
  const won = new Map<string, number>();
  const done: ScoredGame[] = [];
  const shown = new Map<string, string>(); // the handle as written in the games, by lower case
  const runs = new Map<string, number>(); // wins in a row on the board, by lower-case handle
  const played = new Map<string, number>(); // games on the board so far, by lower-case handle
  const hasWon = new Set<string>(); // who already won a game this season
  let leader: string | undefined;
  ordered.forEach((g) => {
    if (!g.silent) {
      const winner = g.result === '1-0' ? g.boardWhite : g.result === '0-1' ? g.boardBlack : undefined;
      [g.boardWhite, g.boardBlack].forEach((h) => {
        const k = lower(h);
        runs.set(k, h === winner ? (runs.get(k) ?? 0) + 1 : 0);
      });
      [g.boardWhite, g.boardBlack].forEach((h) => played.set(lower(h), (played.get(lower(h)) ?? 0) + 1));
      if (winner && !hasWon.has(lower(winner))) {
        hasWon.add(lower(winner));
        const text = firstWinText(played.get(lower(winner))!, pastWinners ? !pastWinners.has(lower(winner)) : false);
        if (text) {
          events.push({ key: `${seasonKey}:f:${g.key}`, kind: 'firstWin', at: g.at, emoji: '🎉', parts: [{ handle: winner }, text] });
        }
      }
      const run = winner ? runs.get(lower(winner))! : 0;
      if (winner && run >= MIN_STREAK) {
        events.push({
          key: `${seasonKey}:v:${g.key}`,
          kind: 'streak',
          at: g.at,
          emoji: '🔥',
          parts: [{ handle: winner }, ` vince la ${ordinal(run)} partita di fila`],
        });
      }
    }
    if (!g.silent) {
      const tags = [g.summit ? 'Scontro al vertice' : '', g.upset ? 'Colpaccio' : '', g.master ? masterLabel : ''].filter(Boolean);
      events.push({
        key: `${seasonKey}:r:${g.key}`,
        kind: 'result',
        at: g.at,
        emoji: g.result === '½-½' ? '🤝' : '🏁',
        parts: resultParts(g),
        score: g.result === '1-0' ? '1 – 0' : g.result === '0-1' ? '0 – 1' : '½ – ½',
        detail: gameDetail(g) || undefined,
        ...(tags.length > 0 ? { tags } : {}),
        ...(g.id ? { gameId: g.id } : {}),
      });
    }
    const w = lower(g.white);
    const b = lower(g.black);
    shown.set(w, g.white);
    shown.set(b, g.black);
    const sw = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
    points.set(w, (points.get(w) ?? 0) + sw);
    points.set(b, (points.get(b) ?? 0) + 1 - sw);
    if (sw === 1) won.set(w, (won.get(w) ?? 0) + 1);
    if (sw === 0) won.set(b, (won.get(b) ?? 0) + 1);
    done.push(g);

    const sb = new Map<string, number>();
    done.forEach((d) => {
      const dw = lower(d.white);
      const db = lower(d.black);
      const s = d.result === '1-0' ? 1 : d.result === '0-1' ? 0 : 0.5;
      sb.set(dw, (sb.get(dw) ?? 0) + s * (points.get(db) ?? 0));
      sb.set(db, (sb.get(db) ?? 0) + (1 - s) * (points.get(dw) ?? 0));
    });
    const rows = [...points.keys()]
      .map((h) => ({ handle: h, points: points.get(h)!, sb: sb.get(h) ?? 0, won: won.get(h) ?? 0 }))
      .sort((x, y) => y.points - x.points || y.sb - x.sb || y.won - x.won);
    const leaders = leadersOf(rows);
    if (leaders.length !== 1 || leaders[0].handle === leader) return;
    leader = leaders[0].handle;
    events.push({
      key: `${seasonKey}:l:${g.key}`,
      kind: 'leader',
      at: g.at,
      emoji: '📈',
      parts: [{ handle: shown.get(leader) ?? leader }, ' passa in testa alla classifica'],
      detail: `con ${pointsText(leaders[0].points)}`,
    });
  });
  return events;
}

// The champions of a table: everyone sharing the first place
function endParts(standings: { handle: string; points: number; sb: number; won?: number }[], season: string): { parts: ActivityPart[]; detail?: string } | null {
  const leaders = leadersOf(standings);
  if (leaders.length === 0) return null;
  const detail = `con ${pointsText(leaders[0].points)}`;
  if (leaders.length === 1) return { parts: [{ handle: leaders[0].handle }, ` vince la ${season}`], detail };
  const parts: ActivityPart[] = [];
  leaders.forEach((l, i) => {
    if (i > 0) parts.push(i === leaders.length - 1 ? ' e ' : ', ');
    parts.push({ handle: l.handle });
  });
  parts.push(` chiudono la ${season} a pari merito in testa`);
  return { parts, detail };
}

const masterLabelOf = (masterName: string | undefined) => {
  const surname = masterSurname(masterName);
  return surname ? `L'apertura di ${surname}` : "L'apertura del maestro";
};

export interface CurrentSeasonInput {
  season: string; // "Stagione 2"
  masterName?: string;
  masterOpening?: string;
  players: Player[];
  history: HistoryGame[]; // as the standings see it (withdrawals applied)
  gameStates: Record<string, LichessExportGame>;
  schedule?: ScheduledMatch[];
  withdrawals?: Withdrawal[];
  elo?: EloReport;
  masterAnecdotes?: MasterAnecdote[];
  archives?: SeasonArchive[]; // the earlier seasons: who already won a game in the tournament
}

// Who won at least one game in the archived seasons, by lower-case handle: from the games kept with
// each season, or from its table for the seasons archived without them
export function pastWinnersOf(archives: SeasonArchive[]): Set<string> {
  const out = new Set<string>();
  archives.forEach((a) => {
    if (a.games && a.games.length > 0) {
      a.games.forEach((g) => {
        if (g.result === '1-0') out.add(lower(g.white));
        if (g.result === '0-1') out.add(lower(g.black));
      });
    } else {
      a.standings.forEach((s) => s.won > 0 && out.add(lower(s.handle)));
    }
  });
  return out;
}

// The season being played: its start, the start and the end of each round with the master's
// anecdote, results (summits, colpacci and the master's opening tagged), winning streaks, leaders,
// withdrawals, the campione matematico and, once the last game is over, who won it
export function currentSeasonActivity(input: CurrentSeasonInput): ActivityEvent[] {
  const { season, history, gameStates, withdrawals = [], elo } = input;
  const handles = input.players.map((p) => p.handle);
  const family = openingFamily(input.masterOpening);
  const events: ActivityEvent[] = [];

  // Rounds: when their first game was created on Lichess
  const starts = new Map<string, { at: number; games: number }>();
  history.forEach((g) => {
    if (!extractGameId(g.url)) return;
    const at = g.createdAt ?? stateOf(g, gameStates)?.createdAt;
    const prev = starts.get(g.round);
    const games = (prev?.games ?? 0) + 1;
    const first = typeof at === 'number' && at > 0 && (!prev || !prev.at || at < prev.at) ? at : prev?.at ?? 0;
    starts.set(g.round, { at: first, games });
  });
  const schedule = input.schedule ?? [];
  const returnStart = returnLegStart(schedule.length > 0 ? schedule : history);
  const rounds = [...starts.keys()].filter((r) => starts.get(r)!.at > 0).sort(byRound);
  rounds.forEach((round, i) => {
    const { at, games } = starts.get(round)!;
    const leg = returnStart === undefined ? '' : isReturnLeg(round, returnStart) ? 'ritorno' : 'andata';
    const gamesText = games === 1 ? '1 partita' : `${games} partite`;
    events.push(
      i === 0
        ? {
            key: `${CURRENT}:s`,
            kind: 'season',
            at,
            emoji: '🎬',
            parts: [`Comincia la ${season}`],
            detail: [`Turno ${round}`, gamesText, input.masterName ? `dedicata a ${input.masterName}` : ''].filter(Boolean).join(' · '),
          }
        : {
            key: `${CURRENT}:t:${round}`,
            kind: 'round',
            at,
            emoji: '📣',
            parts: [`Inizia il turno ${round}`],
            detail: [gamesText, leg].filter(Boolean).join(' · '),
          }
    );
    const anecdote = anecdoteForRound(input.masterAnecdotes, round);
    if (anecdote) {
      const about = input.masterName ? `su ${masterSurname(input.masterName)}` : 'sul maestro';
      events.push({
        key: `${CURRENT}:a:${round}`,
        kind: 'anecdote',
        at,
        emoji: '📜',
        parts: [`Nuovo aneddoto ${about}: «${anecdote.anecdote.title.replace(/[*_]/g, '')}»`],
        link: { href: publicViewHref('season'), label: 'Leggi' },
      });
    }
  });

  // Withdrawals, and when the games they gave by forfeit count
  const forfeitAt = new Map<string, number>();
  withdrawals.forEach((w, i) => {
    const at = Date.parse(w.at);
    if (!Number.isFinite(at)) return;
    (w.forfeits ?? []).forEach((f) => forfeitAt.set(`${f.round}|${lower(f.white)}|${lower(f.black)}`, at));
    const parts: ActivityPart[] =
      w.mode === 'replaced' && w.replacedBy
        ? [{ handle: w.replacedBy.handle }, ' prende il posto di ', { handle: w.handle }]
        : [{ handle: w.handle }, ' si ritira'];
    const detail =
      w.mode === 'annulled'
        ? 'Le sue partite sono annullate'
        : w.mode === 'forfeit'
        ? 'Le partite che restavano vanno agli avversari'
        : 'Gioca le partite che restavano';
    events.push({ key: `${CURRENT}:w:${i}`, kind: 'withdrawal', at, emoji: w.mode === 'replaced' ? '🔄' : '🚪', parts, detail });
  });

  // The whole calendar, games still to create on Lichess included: for summits, rounds and the title race
  const calendar = withScheduledGames(history, schedule);
  const summits = summitGames(input.players, calendar, gameStates);
  const games: ScoredGame[] = [];
  const finishedAt = new Map<HistoryGame, number>();
  history.forEach((g, i) => {
    const s = stateOf(g, gameStates);
    const result = scoredResult(s);
    if (!s || !result || isVoid(s)) return;
    const forfeit = s.status === 'forfeit';
    const at = forfeit ? forfeitAt.get(`${g.round}|${lower(g.white)}|${lower(g.black)}`) : s.lastMoveAt;
    if (typeof at !== 'number' || !(at > 0)) return;
    finishedAt.set(g, at);
    const id = extractGameId(g.url) || undefined;
    const board = forfeit ? { white: g.white, black: g.black } : playersOnBoard(g, s, handles);
    games.push({
      key: id ?? `${g.round}|${g.white}|${g.black}|${i}`,
      round: g.round,
      white: g.white,
      black: g.black,
      boardWhite: board.white,
      boardBlack: board.black,
      result,
      status: s.status,
      plies: s.moves?.trim() ? s.moves.trim().split(/\s+/).length : undefined,
      opening: s.opening?.name,
      at,
      id,
      upset: !forfeit && !!upsetOf(s, elo, { ...board, round: g.round, id }),
      master: !!family && playsFamily(s.opening?.name, family),
      summit: summits.has(summitKey(g)),
      silent: forfeit,
    });
  });
  events.push(...gameEvents(games, CURRENT, masterLabelOf(input.masterName), input.archives?.length ? pastWinnersOf(input.archives) : undefined));

  // The end of the season, with the last game: who won it (the title is written at the closing)
  const progress = computeSeasonProgress(history, gameStates, schedule);
  let seasonEnd: number | undefined;
  if (progress.total > 0 && progress.finished === progress.total && games.length > 0) {
    seasonEnd = Math.max(...games.map((g) => g.at));
    const end = endParts(finalTable(games), season);
    if (end) events.push({ key: `${CURRENT}:e`, kind: 'end', at: seasonEnd, emoji: '🏆', ...end });
  }

  // Rounds over: with their last game, and who leads then. The last one is the end of the season.
  const byRoundGames = new Map<string, HistoryGame[]>();
  calendar.forEach((g) => byRoundGames.set(g.round, [...(byRoundGames.get(g.round) ?? []), g]));
  [...byRoundGames.keys()].sort(byRound).forEach((round) => {
    const times = byRoundGames.get(round)!.map((g) => finishedAt.get(g));
    if (times.some((t) => t === undefined)) return;
    const at = Math.max(...(times as number[]));
    if (at === seasonEnd) return;
    const leaders = leadersOf(finalTable(games.filter((g) => g.at <= at)));
    const parts: ActivityPart[] = [`Si chiude il turno ${round}`];
    if (leaders.length > 0 && leaders.length <= 3) {
      parts.push(': in testa ');
      leaders.forEach((l, i) => {
        if (i > 0) parts.push(i === leaders.length - 1 ? ' e ' : ', ');
        parts.push({ handle: l.handle });
      });
    }
    events.push({
      key: `${CURRENT}:c:${round}`,
      kind: 'roundEnd',
      at,
      emoji: '✅',
      parts,
      ...(leaders.length > 0 ? { detail: `${leaders.length > 3 ? `${leaders.length} giocatori in testa ` : ''}con ${pointsText(leaders[0].points)}` } : {}),
    });
  });

  // Campione matematico: the first moment nobody can reach the leader any more, the season not over
  const moments = [...new Set(games.map((g) => g.at))].sort((a, b) => a - b);
  for (const t of moments) {
    const view = calendar.map((g) => {
      const at = finishedAt.get(g);
      return { ...g, url: '', lichess: at !== undefined && at <= t ? stateOf(g, gameStates) : undefined };
    });
    const race = titleRace(input.players, view, {});
    if (!race?.champion) continue;
    const ahead = race.roundsLeft === 1 ? "con un turno d'anticipo" : `con ${race.roundsLeft} turni d'anticipo`;
    events.push({
      key: `${CURRENT}:m`,
      kind: 'champion',
      at: t,
      emoji: '👑',
      parts: [{ handle: race.champion.handle }, ' vince matematicamente la stagione: nessuno può più arrivare in testa'],
      detail: ahead,
    });
    break;
  }
  return sortEvents(events);
}

// Points, Sonneborn-Berger and wins of the scored games, as the standings
function finalTable(games: ScoredGame[]) {
  const pts = new Map<string, number>();
  const won = new Map<string, number>();
  const name = new Map<string, string>();
  games.forEach((g) => {
    const s = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
    [
      [g.white, s],
      [g.black, 1 - s],
    ].forEach(([h, p]) => {
      const k = lower(h as string);
      name.set(k, h as string);
      pts.set(k, (pts.get(k) ?? 0) + (p as number));
      if (p === 1) won.set(k, (won.get(k) ?? 0) + 1);
    });
  });
  const sb = new Map<string, number>();
  games.forEach((g) => {
    const s = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
    const w = lower(g.white);
    const b = lower(g.black);
    sb.set(w, (sb.get(w) ?? 0) + s * pts.get(b)!);
    sb.set(b, (sb.get(b) ?? 0) + (1 - s) * pts.get(w)!);
  });
  return [...pts.keys()]
    .map((k) => ({ handle: name.get(k)!, points: pts.get(k)!, sb: sb.get(k) ?? 0, won: won.get(k) ?? 0 }))
    .sort((x, y) => y.points - x.points || y.sb - x.sb || y.won - x.won);
}

// The season's name for a sentence: older archives carry the tournament's title before it
// ("Scacchi & Chill - Stagione 1"), which reads oddly in "vince la …"
export function seasonLabel(archive: Pick<SeasonArchive, 'season' | 'title'>): string {
  const title = archive.title?.trim();
  if (!title || !archive.season.startsWith(title)) return archive.season;
  const rest = archive.season.slice(title.length).replace(/^\s*[-–—:·]\s*/, '').trim();
  return rest || archive.season;
}

// An archived season: the results kept with it (those with the time of their last move), the
// leaders, and who won it, from its final table. Rounds and withdrawals have no date in the archive.
export function archivedSeasonActivity(archive: SeasonArchive, elo?: EloReport): ActivityEvent[] {
  const family = openingFamily(archive.masterOpening);
  const games: ScoredGame[] = [];
  (archive.games ?? []).forEach((g, i) => {
    if (typeof g.end !== 'number' || !(g.end > 0)) return;
    const ratings = elo?.before.get(gameKey(g, archive.id));
    games.push({
      key: g.id ?? `${g.round}|${g.white}|${g.black}|${i}`,
      round: g.round,
      white: g.white,
      black: g.black,
      boardWhite: g.white,
      boardBlack: g.black,
      result: g.result,
      status: g.status,
      plies: g.plies,
      opening: g.opening,
      at: g.end,
      id: g.id,
      upset: !decidedAtTable(g.status) && !!upsetFrom(g.result, ratings),
      master: !!family && playsFamily(g.opening, family),
      silent: g.status === 'forfeit',
    });
  });
  const events = gameEvents(games, archive.id, masterLabelOf(archive.masterName));
  const at = games.length > 0 ? Math.max(...games.map((g) => g.at)) : Date.parse(archive.archivedAt);
  const end = endParts(archive.standings, seasonLabel(archive));
  if (end && Number.isFinite(at)) events.push({ key: `${archive.id}:e`, kind: 'end', at, emoji: '🏆', ...end });
  return sortEvents(events);
}

// Newest first; at the same moment, the later event first (a leader after the result that made them)
const ORDER: Record<ActivityKind, number> = {
  season: 0,
  round: 1,
  anecdote: 2,
  withdrawal: 3,
  result: 4,
  firstWin: 5,
  streak: 5,
  leader: 6,
  champion: 7,
  roundEnd: 8,
  end: 9,
};
export function sortEvents(events: ActivityEvent[]): ActivityEvent[] {
  return events
    .map((e, n) => ({ e, n }))
    .sort((a, b) => b.e.at - a.e.at || ORDER[b.e.kind] - ORDER[a.e.kind] || b.n - a.n)
    .map(({ e }) => e);
}

// Whether an event happened after the last visit (none on a first visit)
export const isNewSince = (e: ActivityEvent, lastVisit: number | undefined) => lastVisit !== undefined && e.at > lastVisit;

// The frame of the season (rounds and anecdotes) and the moments worth telling: the three weights
// of the cronaca. Only what is not frame counts as news.
export const FRAME_KINDS = new Set<ActivityKind>(['season', 'round', 'roundEnd', 'anecdote']);
export const HIGHLIGHT_KINDS = new Set<ActivityKind>(['leader', 'firstWin', 'streak', 'champion', 'end']);

// The events since the last visit worth calling news, newest first
export const newsSince = (events: ActivityEvent[], lastVisit: number | undefined) =>
  events.filter((e) => !FRAME_KINDS.has(e.kind) && isNewSince(e, lastVisit));

// The sentence of an event as plain text, players by their names
export const plainText = (e: ActivityEvent, nameOf: (handle: string) => string) =>
  e.parts.map((p) => (typeof p === 'string' ? p : nameOf(p.handle))).join('');

