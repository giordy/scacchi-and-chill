// Rebuilding a past season that was closed without its games: from the Lichess links shared in the
// group chat (see tabs/settings/RebuildSeasonSection.tsx). Pure helpers, the page does the fetching.
import { HistoryGame, LichessExportGame, Player, SeasonArchive, Withdrawal } from '../types';
import { buildSeasonArchive } from './seasons';

// Lichess game ids in any text, e.g. a WhatsApp export: "lichess.org/AbCd1234" or the 12-character
// link of one side ("lichess.org/AbCd1234wXyZ"), each id once, in the order they first appear.
// Words that are Lichess pages, not games ("lichess.org/training"), are dropped by Lichess itself.
export function lichessIdsFromText(text: string): string[] {
  const ids: string[] = [];
  const re = /lichess\.org\/(?:game\/|embed\/(?:game\/)?)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?![A-Za-z0-9])/g;
  for (const m of text.matchAll(re)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

const userOf = (g: LichessExportGame, color: 'white' | 'black') => g.players?.[color]?.user?.name;

// Games that can belong to the tournament: correspondence, between two Lichess accounts
export const isTournamentCandidate = (g: LichessExportGame) =>
  g.speed === 'correspondence' && !!userOf(g, 'white') && !!userOf(g, 'black');

export interface FoundPlayer {
  handle: string;
  games: number;
}

// Everyone who played the candidate games, most games first
export function playersOfGames(games: LichessExportGame[]): FoundPlayer[] {
  const counts = new Map<string, FoundPlayer>();
  games.forEach((g) =>
    (['white', 'black'] as const).forEach((c) => {
      const handle = userOf(g, c)!;
      const key = handle.toLowerCase();
      const row = counts.get(key) ?? { handle, games: 0 };
      row.games++;
      counts.set(key, row);
    })
  );
  return [...counts.values()].sort((a, b) => b.games - a.games || a.handle.localeCompare(b.handle));
}

// A game won by forfeit, typed by hand: it has no Lichess link
export interface ManualGame {
  white: string;
  black: string;
  winner: 'white' | 'black';
}

// The season as the standings and the archive read it: the games among the chosen players, oldest
// first. A player who left and was replaced hands their games to the substitute (as the site does
// with a replacement today: `replacedBy`, lowercase handle of who left -> handle of the substitute);
// the games of one who left without a substitute are dropped, as they are not among the players.
// Rounds are not known: every game gets "–".
export function rebuiltHistory(
  games: LichessExportGame[],
  players: Player[],
  manual: ManualGame[] = [],
  replacedBy: Record<string, string> = {}
): HistoryGame[] {
  const handles = new Map(players.map((p) => [p.handle.toLowerCase(), p.handle]));
  const handleOf = (name?: string) => (name ? handles.get((replacedBy[name.toLowerCase()] ?? name).toLowerCase()) : undefined);
  const fromLichess = games
    .map((g): HistoryGame | null => {
      const white = handleOf(userOf(g, 'white'));
      const black = handleOf(userOf(g, 'black'));
      if (!white || !black || white === black) return null;
      const game: HistoryGame = { round: '–', white, black, url: `https://lichess.org/${g.id}`, lichess: g };
      if (g.createdAt) game.createdAt = g.createdAt;
      return game;
    })
    .filter((g): g is HistoryGame => g !== null)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const forfeits = manual.map(
    (m): HistoryGame => ({ round: '–', white: m.white, black: m.black, url: '', lichess: { id: '', status: 'forfeit', winner: m.winner } })
  );
  return [...fromLichess, ...forfeits];
}

// When the archive was "closed": the last move of the season, so it sorts among the other seasons
export function lastMoveOf(games: LichessExportGame[]): Date | undefined {
  const last = Math.max(0, ...games.map((g) => g.lastMoveAt ?? g.createdAt ?? 0));
  return last > 0 ? new Date(last) : undefined;
}

// Games of the season in progress, left out when the export runs into it: the ones the site already
// has, and any created since the first of them
export function isCurrentSeasonGame(g: LichessExportGame, current: HistoryGame[]): boolean {
  const ids = new Set(current.map((h) => h.url.match(/lichess\.org\/(\w{8})/)?.[1]).filter(Boolean));
  if (ids.has(g.id)) return true;
  const starts = current.map((h) => h.createdAt ?? h.lichess?.createdAt).filter((t): t is number => !!t);
  return starts.length > 0 && !!g.createdAt && g.createdAt >= Math.min(...starts);
}

// A player who left, and the substitute who took over their games
export interface Replacement {
  handle: string; // who left
  name: string; // their name, for the note under the table
  by: string; // the substitute's handle, one of the players
}

export interface RebuildInput {
  title: string; // the tournament
  season: string;
  master?: string;
  games: LichessExportGame[]; // the games kept
  players: Player[]; // the players of the season, with the names to show
  manual?: ManualGame[];
  replaced?: Replacement[];
}

// The archive of a rebuilt season: standings, games, awards and period from the games; the
// replacements as the season's withdrawals; archived at the last move, so it sorts among the others
export function rebuildArchive({ title, season, master, games, players, manual = [], replaced = [] }: RebuildInput): SeasonArchive {
  const substitutes = Object.fromEntries(replaced.map((r) => [r.handle.toLowerCase(), r.by]));
  const history = rebuiltHistory(games, players, manual, substitutes);
  const states = Object.fromEntries(games.map((g) => [g.id, g]));
  const withdrawals: Withdrawal[] = replaced.flatMap((r) => {
    const to = players.find((p) => p.handle.toLowerCase() === r.by.toLowerCase());
    return to ? [{ handle: r.handle, name: r.name, at: '', played: 0, total: 0, mode: 'replaced' as const, replacedBy: to }] : [];
  });
  const meta = { title, season, description: '', withdrawals, ...(master ? { masterName: master } : {}) };
  return buildSeasonArchive(meta, players, history, states, lastMoveOf(games) ?? new Date());
}
