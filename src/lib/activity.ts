// Cronaca: what happened in the tournament, as a list of events in the order they happened. Everything
// is read from the data the site already has (games, their Lichess states, withdrawals, archived
// seasons): nothing is stored for it. Ongoing games give no event, Lichess hides their last moves.
import { HistoryGame, LichessExportGame, Player, ScheduledMatch, SeasonArchive, Withdrawal } from '../types';
import { byRound, isVoid, movesText, stateOf } from './games';
import { leadersOf, pointsText, scoredResult } from './standings';
import { CURRENT, decidedAtTable, EloReport, gameKey, playersOnBoard } from './tournamentElo';
import { upsetFrom, upsetOf } from './upset';
import { masterSurname, openingFamily, playsFamily } from './masterOpening';
import { HOW_DRAW, HOW_WIN, extractGameId } from './utils';
import { isReturnLeg, returnLegStart } from './legs';
import { computeSeasonProgress } from './progress';

// A piece of an event's sentence: plain text, or a player (shown as a link to their page)
export type ActivityPart = string | { handle: string };

export type ActivityKind = 'season' | 'round' | 'result' | 'leader' | 'withdrawal' | 'end';

export interface ActivityEvent {
  key: string; // stable, for React
  kind: ActivityKind;
  at: number; // ms
  emoji: string;
  parts: ActivityPart[];
  detail?: string; // a second, smaller line
  tags?: string[]; // "💥 Colpaccio", "♞ L'apertura di Capablanca"
  gameId?: string; // Lichess id, for a link to the game
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

// The events of the games: one per result, and one each time someone goes alone at the top of the
// standings (points, then Sonneborn-Berger, then wins, as the table). A shared first place gives
// no event; going back alone on top after it does only for someone new.
function gameEvents(games: ScoredGame[], seasonKey: string, masterLabel: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const ordered = [...games].sort((a, b) => a.at - b.at || byRound(a.round, b.round));
  const points = new Map<string, number>();
  const won = new Map<string, number>();
  const done: ScoredGame[] = [];
  const shown = new Map<string, string>(); // the handle as written in the games, by lower case
  let leader: string | undefined;
  ordered.forEach((g) => {
    if (!g.silent) {
      const tags = [g.upset ? '💥 Colpaccio' : '', g.master ? `♞ ${masterLabel}` : ''].filter(Boolean);
      events.push({
        key: `${seasonKey}:r:${g.key}`,
        kind: 'result',
        at: g.at,
        emoji: g.result === '½-½' ? '🤝' : '🏁',
        parts: resultParts(g),
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
}

// The season being played: its start and the start of each round, results, leaders, withdrawals and,
// once the last game is over, who won it
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

  const games: ScoredGame[] = [];
  history.forEach((g, i) => {
    const s = stateOf(g, gameStates);
    const result = scoredResult(s);
    if (!s || !result || isVoid(s)) return;
    const forfeit = s.status === 'forfeit';
    const at = forfeit ? forfeitAt.get(`${g.round}|${lower(g.white)}|${lower(g.black)}`) : s.lastMoveAt;
    if (typeof at !== 'number' || !(at > 0)) return;
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
      silent: forfeit,
    });
  });
  events.push(...gameEvents(games, CURRENT, masterLabelOf(input.masterName)));

  // The end of the season, with the last game: who won it (the title is written at the closing)
  const progress = computeSeasonProgress(history, gameStates, schedule);
  if (progress.total > 0 && progress.finished === progress.total && games.length > 0) {
    const last = Math.max(...games.map((g) => g.at));
    const table = finalTable(games);
    const end = endParts(table, season);
    if (end) events.push({ key: `${CURRENT}:e`, kind: 'end', at: last, emoji: '🏆', ...end });
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
  const end = endParts(archive.standings, archive.season);
  if (end && Number.isFinite(at)) events.push({ key: `${archive.id}:e`, kind: 'end', at, emoji: '🏆', ...end });
  return sortEvents(events);
}

// Newest first; at the same moment, the later event first (a leader after the result that made them)
const ORDER: Record<ActivityKind, number> = { season: 0, round: 1, withdrawal: 2, result: 3, leader: 4, end: 5 };
export function sortEvents(events: ActivityEvent[]): ActivityEvent[] {
  return events
    .map((e, n) => ({ e, n }))
    .sort((a, b) => b.e.at - a.e.at || ORDER[b.e.kind] - ORDER[a.e.kind] || b.n - a.n)
    .map(({ e }) => e);
}

// Whether an event happened after the last visit (none on a first visit)
export const isNewSince = (e: ActivityEvent, lastVisit: number | undefined) => lastVisit !== undefined && e.at > lastVisit;

