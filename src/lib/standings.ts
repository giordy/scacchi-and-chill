import { HistoryGame, LichessExportGame, Player } from '../types';
import { stateOf } from './games';

export interface PlayerStanding {
  handle: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  sb: number; // Sonneborn-Berger
}

// Crosstable cell: "1" win, "0" loss, "½" draw, "-" not played, "✕" same player
export type CrosstableResult = "1" | "0" | "½" | "-" | "✕";
export type Crosstable = Record<string, Record<string, CrosstableResult>>;

// Statuses of a game that has not produced a result yet
const UNFINISHED_STATUSES = new Set(["created", "started", "aborted", "noStart"]);

// The result a game counts for in the standings, null while it has none
export function scoredResult(s?: LichessExportGame): "1-0" | "0-1" | "½-½" | null {
  if (!s || UNFINISHED_STATUSES.has(s.status)) return null;
  return s.winner === "white" ? "1-0" : s.winner === "black" ? "0-1" : "½-½";
}

const emptyStats = () => ({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 });

// Pure function: standings, tiebreaks and crosstable from the games and their Lichess states.
// Ranking: points, then Sonneborn-Berger, then wins, then name (the name only orders players
// level on all the rest: they share the place, see sharedRanks).
export function computeStandings(
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): { standings: PlayerStanding[]; crosstable: Crosstable } {
  const stats: Record<string, ReturnType<typeof emptyStats>> = {};
  players.forEach((p) => {
    stats[p.handle] = emptyStats();
  });

  const crosstable: Crosstable = {};
  players.forEach((p1) => {
    crosstable[p1.handle] = {};
    players.forEach((p2) => {
      crosstable[p1.handle][p2.handle] = p1.handle === p2.handle ? "✕" : "-";
    });
  });
  const setCross = (a: string, b: string, value: CrosstableResult) => {
    if (crosstable[a] && crosstable[b]) crosstable[a][b] = value;
  };

  const finished: Array<{ white: string; black: string; result: "1-0" | "0-1" | "½-½" }> = [];

  history.forEach((g) => {
    const s = stateOf(g, gameStates);
    const { white, black } = g;

    if (!stats[white]) stats[white] = emptyStats();
    if (!stats[black]) stats[black] = emptyStats();

    const result = scoredResult(s);
    if (!result) return;

    stats[white].played++;
    stats[black].played++;

    if (result === "1-0") {
      stats[white].won++;
      stats[white].points += 1;
      stats[black].lost++;
      setCross(white, black, "1");
      setCross(black, white, "0");
      finished.push({ white, black, result: "1-0" });
    } else if (result === "0-1") {
      stats[black].won++;
      stats[black].points += 1;
      stats[white].lost++;
      setCross(white, black, "0");
      setCross(black, white, "1");
      finished.push({ white, black, result: "0-1" });
    } else {
      stats[white].drawn++;
      stats[white].points += 0.5;
      stats[black].drawn++;
      stats[black].points += 0.5;
      setCross(white, black, "½");
      setCross(black, white, "½");
      finished.push({ white, black, result: "½-½" });
    }
  });

  // Sonneborn-Berger: points of defeated opponents + half the points of drawn opponents
  finished.forEach((m) => {
    if (m.result === "1-0") {
      stats[m.white].sb += stats[m.black].points;
    } else if (m.result === "0-1") {
      stats[m.black].sb += stats[m.white].points;
    } else {
      stats[m.white].sb += stats[m.black].points * 0.5;
      stats[m.black].sb += stats[m.white].points * 0.5;
    }
  });

  const standings = players
    .map((p) => ({ handle: p.handle, name: p.name, ...stats[p.handle] }))
    .sort((a, b) => b.points - a.points || b.sb - a.sb || b.won - a.won || a.name.localeCompare(b.name));

  return { standings, crosstable };
}

// What decides a place: points, then Sonneborn-Berger, then wins (won is missing on some old
// archives: then it does not separate anyone)
export interface RankKey {
  points: number;
  sb: number;
  won?: number;
}

const ahead = (a: RankKey, b: RankKey) =>
  a.points > b.points ||
  (a.points === b.points && (a.sb > b.sb || (a.sb === b.sb && (a.won ?? 0) > (b.won ?? 0))));

// Places of an ordered table, shared when points, Sonneborn-Berger and wins are all equal: a place
// is 1 + the players ahead, so two seconds are followed by a fourth. The name only orders the
// tied players in the table, it never gives them different places.
export function sharedRanks(standings: RankKey[]): number[] {
  return standings.map((s) => 1 + standings.filter((o) => ahead(o, s)).length);
}

// Whether the place at index i is shared with someone else
export const isTied = (ranks: number[], i: number) => ranks.filter((r) => r === ranks[i]).length > 1;

// Before the first game everyone is level at zero: no places to show yet
export const seasonStarted = (standings: Array<{ played: number }>) => standings.some((s) => s.played > 0);

// Gold, silver or bronze for a place in the table; none without points
export const podiumPlace = (rank: number, points: number): 1 | 2 | 3 | undefined =>
  points > 0 && rank <= 3 ? (rank as 1 | 2 | 3) : undefined;

// The players sharing the first place, once someone has points
export function leadersOf<T extends RankKey>(standings: T[]): T[] {
  if (!standings[0] || standings[0].points <= 0) return [];
  const ranks = sharedRanks(standings);
  return standings.filter((_, i) => ranks[i] === 1);
}

// "1 punto", "2½ punti", "½ punto"
export const pointsText = (n: number) => {
  const s = String(n).replace(".5", "½").replace(/^0½/, "½");
  return `${s} ${n === 1 || n === 0.5 ? "punto" : "punti"}`;
};

// The hero line once the last game is over: who won, before the organizer closes the season (the
// title is then written in the Albo d'Oro). Tied winners named together, more than three counted.
export function championText(standings: Array<RankKey & { name: string }>): string {
  const leaders = leadersOf(standings);
  if (leaders.length === 0) return "Stagione conclusa.";
  const pts = pointsText(leaders[0].points);
  if (leaders.length === 1) return `Stagione conclusa: vince ${leaders[0].name} con ${pts}! 🏆`;
  if (leaders.length > 3) return `Stagione conclusa: vincono a pari merito ${leaders.length} giocatori, con ${pts}! 🏆`;
  const names = leaders.map((l) => l.name);
  return `Stagione conclusa: vincono a pari merito ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}, con ${pts}! 🏆`;
}

// The hero line: " In testa Anna con 3 punti.", tied leaders named together, more than three
// only counted. Empty while nobody has points.
export function leaderText(standings: Array<RankKey & { name: string }>): string {
  const leaders = leadersOf(standings);
  if (leaders.length === 0) return "";
  const pts = pointsText(leaders[0].points);
  if (leaders.length === 1) return ` In testa ${leaders[0].name} con ${pts}.`;
  if (leaders.length > 3) return ` In testa ${leaders.length} giocatori a pari merito, con ${pts}.`;
  const names = leaders.map((l) => l.name);
  return ` In testa a pari merito ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}, con ${pts}.`;
}
