// Rebuilding a past season that was closed without its games: from the Lichess links shared in the
// group chat (see tabs/settings/RebuildSeasonSection.tsx). Pure helpers, the page does the fetching.
import { HistoryGame, LichessExportGame, Player } from '../types';

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
// first. Rounds are not known: every game gets "–".
export function rebuiltHistory(games: LichessExportGame[], players: Player[], manual: ManualGame[] = []): HistoryGame[] {
  const handles = new Map(players.map((p) => [p.handle.toLowerCase(), p.handle]));
  const handleOf = (name?: string) => (name ? handles.get(name.toLowerCase()) : undefined);
  const fromLichess = games
    .map((g): HistoryGame | null => {
      const white = handleOf(userOf(g, 'white'));
      const black = handleOf(userOf(g, 'black'));
      if (!white || !black) return null;
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
