import { HistoryGame, LichessExportGame, Player } from '../types';
import { extractGameId } from './utils';

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

const emptyStats = () => ({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 });

// Pure function: standings, tiebreaks and crosstable from the games and their Lichess states.
// Ranking: points, then Sonneborn-Berger, then wins, then name.
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
    const id = extractGameId(g.url);
    const s = id ? gameStates[id] : undefined;
    const { white, black } = g;

    if (!stats[white]) stats[white] = emptyStats();
    if (!stats[black]) stats[black] = emptyStats();

    if (!s || UNFINISHED_STATUSES.has(s.status)) return;

    stats[white].played++;
    stats[black].played++;

    if (s.winner === "white") {
      stats[white].won++;
      stats[white].points += 1;
      stats[black].lost++;
      setCross(white, black, "1");
      setCross(black, white, "0");
      finished.push({ white, black, result: "1-0" });
    } else if (s.winner === "black") {
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
