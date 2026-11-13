// La stagione in breve: at the end of a season, a player's own summary, from the games as they are
// archived (the same shape for the current season, see allTime.seasonsWithGames): the results, the
// best run, the opponent who hurt most and the one beaten most, the longest game, the quickest win,
// the opening played most, the colpacci and how the Elo del torneo moved.
import { ArchivedGame } from '../types';
import { byRound, decidedAtTable } from './games';
import { EloReport, gameKey } from './tournamentElo';
import { upsetFrom } from './upset';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface OpponentRecord {
  opponent: string;
  scored: number;
  conceded: number;
}

export interface SeasonWrapped {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  winStreak: number; // longest run of wins (from 2)
  unbeaten: number; // longest run without a loss (from 3, only when longer than the wins)
  nemesis?: OpponentRecord; // the opponent the player scored least against, below even
  favourite?: OpponentRecord; // the one they scored most against, above even
  longest?: { opponent: string; moves: number; score: number }; // the game with most moves
  quickestWin?: { opponent: string; moves: number }; // the win in fewest moves, on the board
  opening?: { name: string; games: number }; // the opening family played most, from 2 games
  upsets: number; // colpacci: wins and draws against someone much stronger
  elo?: { start: number; end: number };
}

const scoreOf = (handle: string, g: ArchivedGame) => {
  if (g.result === '½-½') return 0.5;
  return (g.result === '1-0') === same(g.white, handle) ? 1 : 0;
};

// "Sicilian Defense: Najdorf Variation" -> "Sicilian Defense"
const family = (opening: string) => opening.split(':')[0].trim();

export function seasonWrapped(handle: string, games: ArchivedGame[], elo?: EloReport, eloKey?: string): SeasonWrapped | null {
  const mine = games.filter((g) => same(g.white, handle) || same(g.black, handle)).sort((a, b) => byRound(a.round, b.round) || (a.end ?? 0) - (b.end ?? 0));
  if (mine.length === 0) return null;
  const opp = (g: ArchivedGame) => (same(g.white, handle) ? g.black : g.white);
  const scores = mine.map((g) => scoreOf(handle, g));

  // Runs, in round order
  let winRun = 0, winStreak = 0, safeRun = 0, unbeaten = 0;
  scores.forEach((s) => {
    winRun = s === 1 ? winRun + 1 : 0;
    safeRun = s > 0 ? safeRun + 1 : 0;
    winStreak = Math.max(winStreak, winRun);
    unbeaten = Math.max(unbeaten, safeRun);
  });

  // Against each opponent
  const records = new Map<string, OpponentRecord>();
  mine.forEach((g, i) => {
    const o = opp(g);
    const r = records.get(o.toLowerCase()) ?? { opponent: o, scored: 0, conceded: 0 };
    r.scored += scores[i];
    r.conceded += 1 - scores[i];
    records.set(o.toLowerCase(), r);
  });
  const list = [...records.values()];
  const balance = (r: OpponentRecord) => r.scored - r.conceded;
  // Only one that stands out: with two or more alike (a player who lost to everyone) none is named
  const standsOut = (sorted: OpponentRecord[]) => (sorted.length > 0 && (sorted.length === 1 || balance(sorted[0]) !== balance(sorted[1])) ? sorted[0] : undefined);
  const nemesis = standsOut(list.filter((r) => balance(r) < 0).sort((a, b) => balance(a) - balance(b)));
  const favourite = standsOut(list.filter((r) => balance(r) > 0).sort((a, b) => balance(b) - balance(a)));

  // Games on the board only (not those decided at the table: forfeits, cheating), moves rounded up from the half-moves
  const onBoard = mine.map((g, i) => ({ g, s: scores[i] })).filter(({ g }) => !decidedAtTable(g.status) && typeof g.plies === 'number' && g.plies > 0);
  const moves = (g: ArchivedGame) => Math.ceil(g.plies! / 2);
  const longestGame = [...onBoard].sort((a, b) => b.g.plies! - a.g.plies!)[0];
  const quickest = onBoard.filter(({ s }) => s === 1).sort((a, b) => a.g.plies! - b.g.plies!)[0];

  const openings = new Map<string, number>();
  mine.forEach((g) => g.opening && openings.set(family(g.opening), (openings.get(family(g.opening)) ?? 0) + 1));
  const [openingName, openingGames] = [...openings.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

  const upsets =
    elo && eloKey
      ? mine.filter((g) => {
          const u = upsetFrom(g.result, elo.before.get(gameKey(g, eloKey)));
          return u && (u.player === 'white') === same(g.white, handle);
        }).length
      : 0;
  const eloSeason = eloKey ? elo?.seasons.find((s) => s.key === eloKey) : undefined;
  const start = eloSeason?.start.get(handle.toLowerCase());
  const end = eloSeason?.end.get(handle.toLowerCase());

  const won = scores.filter((s) => s === 1).length;
  const drawn = scores.filter((s) => s === 0.5).length;
  return {
    played: mine.length,
    won,
    drawn,
    lost: mine.length - won - drawn,
    points: won + drawn / 2,
    winStreak: winStreak >= 2 ? winStreak : 0,
    unbeaten: unbeaten >= 3 && unbeaten > winStreak ? unbeaten : 0,
    nemesis,
    favourite,
    longest: longestGame ? { opponent: opp(longestGame.g), moves: moves(longestGame.g), score: longestGame.s } : undefined,
    quickestWin: quickest ? { opponent: opp(quickest.g), moves: moves(quickest.g) } : undefined,
    opening: openingGames >= 2 ? { name: openingName, games: openingGames } : undefined,
    upsets,
    elo: start !== undefined && end !== undefined && !eloSeason!.newcomers.has(handle.toLowerCase()) ? { start: Math.round(start), end: Math.round(end) } : undefined,
  };
}
