// All-time views across seasons: the archived seasons plus the one in progress.
// Standings-based figures (career, all-time table) cover every archived season; game-based ones
// (head-to-heads, records) only the seasons whose games were archived, and the current one.
import { ArchivedGame, HistoryGame, LichessExportGame, SeasonArchive, SeasonWinner } from '../types';
import { archivedGames, seasonId } from './seasons';
import { RankKey, seasonStarted, sharedRanks } from './standings';
import { fullPodium } from './honours';
import { UPSET_GAP } from './upset';
import { replacedIn } from './departures';
import { SeasonDeparture } from '../types';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface SeasonGames {
  season: string;
  games: ArchivedGame[];
  current: boolean;
}

export interface CurrentSeason {
  season: string;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
}

// Oldest first (the archive list comes newest first)
const oldestFirst = (seasons: SeasonArchive[]) => [...seasons].sort((a, b) => a.archivedAt.localeCompare(b.archivedAt));

// Seasons with their games, in the order they were played, the current one last. Seasons archived
// without games are left out; the current season is left out if an archive has its name already.
export function seasonsWithGames(seasons: SeasonArchive[], current?: CurrentSeason): SeasonGames[] {
  const list: SeasonGames[] = oldestFirst(seasons)
    .filter((s) => s.games && s.games.length > 0)
    .map((s) => ({ season: s.season, games: s.games!, current: false }));
  if (current && !seasons.some((s) => s.id === seasonId(current.season))) {
    const games = archivedGames(current.history, current.gameStates);
    if (games.length > 0) list.push({ season: current.season, games, current: true });
  }
  return list;
}

// Points a player scored in a game: 1, ½ or 0; null when they did not play it
function scoreOf(handle: string, g: ArchivedGame): number | null {
  const white = same(g.white, handle);
  if (!white && !same(g.black, handle)) return null;
  if (g.result === '½-½') return 0.5;
  return (g.result === '1-0') === white ? 1 : 0;
}

export interface AllTimeHeadToHead {
  opponent: string;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  seasons: number; // seasons in which they met
}

// A player's record against every opponent they ever met, most games first
export function allTimeHeadToHead(handle: string, list: SeasonGames[]): AllTimeHeadToHead[] {
  const rows = new Map<string, AllTimeHeadToHead & { seasonSet: Set<string> }>();
  list.forEach(({ season, games }) =>
    games.forEach((g) => {
      const score = scoreOf(handle, g);
      if (score === null) return;
      const opponent = same(g.white, handle) ? g.black : g.white;
      const key = opponent.toLowerCase();
      const row = rows.get(key) ?? { opponent, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, seasons: 0, seasonSet: new Set<string>() };
      row.opponent = opponent; // the latest spelling
      if (score === 1) row.won++;
      else if (score === 0) row.lost++;
      else row.drawn++;
      row.scored += score;
      row.conceded += 1 - score;
      row.seasonSet.add(season);
      rows.set(key, row);
    })
  );
  return [...rows.values()]
    .map(({ seasonSet, ...r }) => ({ ...r, seasons: seasonSet.size }))
    .sort((a, b) => b.won + b.drawn + b.lost - (a.won + a.drawn + a.lost) || a.opponent.localeCompare(b.opponent));
}

interface StandingRow extends RankKey {
  handle: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

export interface CurrentStandings {
  season: string;
  standings: StandingRow[];
  departures?: SeasonDeparture[];
}

export interface CareerSeason {
  season: string;
  place: number | null; // null before the first game
  tied: boolean;
  of: number; // players in that season
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  current: boolean;
  replacing?: { handle: string; name: string }; // the player whose place they took
}

// Every season a player took part in, newest first: the one in progress, then the archived ones
export function careerOf(handle: string, seasons: SeasonArchive[], current?: CurrentStandings): CareerSeason[] {
  const entry = (season: string, standings: StandingRow[], isCurrent: boolean, departures?: SeasonDeparture[]): CareerSeason | null => {
    const i = standings.findIndex((s) => same(s.handle, handle));
    if (i === -1) return null;
    const ranks = sharedRanks(standings);
    const started = seasonStarted(standings);
    const s = standings[i];
    const replacing = replacedIn(departures, handle);
    return {
      ...(replacing ? { replacing } : {}),
      season,
      place: started ? ranks[i] : null,
      tied: started && ranks.filter((r) => r === ranks[i]).length > 1,
      of: standings.length,
      points: s.points,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      current: isCurrent,
    };
  };
  const archived = [...oldestFirst(seasons)].reverse().map((s) => entry(s.season, s.standings, false, s.departures));
  const live =
    current && !seasons.some((s) => s.id === seasonId(current.season)) ? entry(current.season, current.standings, true, current.departures) : null;
  return [live, ...archived].filter((c): c is CareerSeason => c !== null);
}

// The name a player had in the latest table they appear in
export function archivedName(handle: string, seasons: SeasonArchive[]): string | undefined {
  for (const s of [...oldestFirst(seasons)].reverse()) {
    const row = s.standings.find((r) => same(r.handle, handle));
    if (row) return row.name;
  }
  return undefined;
}

export interface AllTimeRow {
  handle: string;
  name: string;
  seasons: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  titles: number;
}

// Totals over every season, archived and current: most points first, then the better average
export function allTimeTable(seasons: SeasonArchive[], winners: SeasonWinner[] | undefined, current?: CurrentStandings): AllTimeRow[] {
  const rows = new Map<string, AllTimeRow>();
  const add = (standings: StandingRow[]) =>
    standings.forEach((s) => {
      if (s.played === 0) return;
      const key = s.handle.toLowerCase();
      const row = rows.get(key) ?? { handle: s.handle, name: s.name, seasons: 0, played: 0, won: 0, drawn: 0, lost: 0, points: 0, titles: 0 };
      row.seasons++;
      row.played += s.played;
      row.won += s.won;
      row.drawn += s.drawn;
      row.lost += s.lost;
      row.points += s.points;
      row.name = s.name;
      rows.set(key, row);
    });
  // Oldest first, so the newest name wins
  oldestFirst(seasons).forEach((s) => add(s.standings));
  if (current && !seasons.some((s) => s.id === seasonId(current.season))) add(current.standings);
  (winners ?? []).forEach((w) =>
    fullPodium(w)
      .filter((p) => p.place === 1)
      .forEach((p) => {
        const row = rows.get(p.handle.toLowerCase());
        if (row) row.titles++;
      })
  );
  const avg = (r: AllTimeRow) => (r.played ? r.points / r.played : 0);
  return [...rows.values()].sort((a, b) => b.points - a.points || avg(b) - avg(a) || a.name.localeCompare(b.name));
}

// Places of the all-time table, shared on equal points
export const allTimeRanks = (rows: AllTimeRow[]) => rows.map((r) => 1 + rows.filter((o) => o.points > r.points).length);

export interface GameRecord {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  players: string[]; // handles; the record holder first
  season: string; // the season(s) in which it happened
  url?: string; // the game on Lichess, for records set by one game
}

// Shortest streaks worth a record
const MIN_WIN_STREAK = 3;
const MIN_UNBEATEN_STREAK = 4;

const moves = (plies: number) => Math.ceil(plies / 2);
const gameUrl = (g: ArchivedGame) => (g.id ? `https://lichess.org/${g.id}` : undefined);
const onBoard = (g: ArchivedGame) => g.status !== 'forfeit' && (g.plies ?? 0) > 0;
const seasonSpan = (from: string, to: string) => (from === to ? from : `${from} → ${to}`);

// The all-time records from the archived games: longest winning and unbeaten runs, longest game,
// quickest win, biggest upset. A record shared by several games goes to the earliest one.
export function allTimeRecords(list: SeasonGames[], nameOf: (handle: string) => string): GameRecord[] {
  const all = list.flatMap(({ season, games }) => games.map((g) => ({ g, season })));
  const records: GameRecord[] = [];

  // Runs, per player, in the order the games were played
  const handles = new Map<string, string>();
  all.forEach(({ g }) => [g.white, g.black].forEach((h) => handles.set(h.toLowerCase(), h)));
  const bestRun = (keep: (score: number) => boolean) => {
    let best: { handle: string; length: number; from: string; to: string } | null = null;
    handles.forEach((handle) => {
      let length = 0;
      let from = '';
      all.forEach(({ g, season }) => {
        const score = scoreOf(handle, g);
        if (score === null) return;
        if (keep(score)) {
          if (length === 0) from = season;
          length++;
          if (!best || length > best.length) best = { handle, length, from, to: season };
        } else length = 0;
      });
    });
    return best as { handle: string; length: number; from: string; to: string } | null;
  };

  const wins = bestRun((s) => s === 1);
  if (wins && wins.length >= MIN_WIN_STREAK) {
    records.push({
      id: 'win-streak',
      emoji: '🔥',
      title: 'Vittorie di fila',
      detail: `${wins.length} vittorie consecutive di ${nameOf(wins.handle)}`,
      players: [wins.handle],
      season: seasonSpan(wins.from, wins.to),
    });
  }
  const unbeaten = bestRun((s) => s > 0);
  if (unbeaten && unbeaten.length >= MIN_UNBEATEN_STREAK && unbeaten.length > (wins?.length ?? 0)) {
    records.push({
      id: 'unbeaten',
      emoji: '🛡️',
      title: 'Imbattibile',
      detail: `${unbeaten.length} partite senza perdere di ${nameOf(unbeaten.handle)}`,
      players: [unbeaten.handle],
      season: seasonSpan(unbeaten.from, unbeaten.to),
    });
  }

  const board = all.filter(({ g }) => onBoard(g));
  const longest = board.reduce<(typeof board)[number] | null>((best, x) => (!best || x.g.plies! > best.g.plies! ? x : best), null);
  if (longest) {
    records.push({
      id: 'longest',
      emoji: '🐢',
      title: 'La partita più lunga',
      detail: `${moves(longest.g.plies!)} mosse, ${nameOf(longest.g.white)} – ${nameOf(longest.g.black)} (${longest.g.result})`,
      players: [longest.g.white, longest.g.black],
      season: longest.season,
      url: gameUrl(longest.g),
    });
  }

  const quickest = board
    .filter(({ g }) => g.result !== '½-½' && g.status !== 'outoftime' && g.status !== 'timeout')
    .reduce<(typeof board)[number] | null>((best, x) => (!best || x.g.plies! < best.g.plies! ? x : best), null);
  if (quickest) {
    const winner = quickest.g.result === '1-0' ? quickest.g.white : quickest.g.black;
    // Only the winner is named: a quick defeat is nothing to put on show
    records.push({
      id: 'quickest',
      emoji: '⚡',
      title: 'La vittoria più rapida',
      detail: `${nameOf(winner)}, in ${moves(quickest.g.plies!)} mosse`,
      players: [winner],
      season: quickest.season,
      url: gameUrl(quickest.g),
    });
  }

  // Biggest upset: the largest rating gap overturned, provisional ratings excluded (as in lib/upset)
  let upset: { x: (typeof all)[number]; gap: number; winner: string; loser: string } | null = null;
  all.forEach((x) => {
    const { g } = x;
    if (g.result === '½-½' || g.provisional || g.whiteRating === undefined || g.blackRating === undefined) return;
    const whiteWon = g.result === '1-0';
    const gap = whiteWon ? g.blackRating - g.whiteRating : g.whiteRating - g.blackRating;
    if (gap >= UPSET_GAP && (!upset || gap > upset.gap)) {
      upset = { x, gap, winner: whiteWon ? g.white : g.black, loser: whiteWon ? g.black : g.white };
    }
  });
  if (upset) {
    const u = upset as { x: (typeof all)[number]; gap: number; winner: string; loser: string };
    records.push({
      id: 'upset',
      emoji: '🗡️',
      title: 'Il colpaccio più grosso',
      detail: `${nameOf(u.winner)} batte ${nameOf(u.loser)}, che aveva ${u.gap} punti Elo in più`,
      players: [u.winner, u.loser],
      season: u.x.season,
      url: gameUrl(u.x.g),
    });
  }

  return records;
}

// Names for the all-time views: the current players' names, otherwise the latest archived one
export const allTimeNameOf = (nameOf: (handle: string) => string, seasons: SeasonArchive[]) => (handle: string) => {
  const name = nameOf(handle);
  return name !== handle ? name : archivedName(handle, seasons) ?? handle;
};
