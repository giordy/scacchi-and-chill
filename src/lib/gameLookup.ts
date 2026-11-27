import { GameAnalysis, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { NameOf } from './roster';
import { extractGameId } from './utils';
import { byOrganizer, stateOf } from './games';
import { analysisOf, analysisPending } from './analysis';
import { shortSeason } from './honours';

// A game of the tournament found by its Lichess id (an address "#/partita/<id>", lib/routes.ts): in
// this season's games or in an archived season. What the replay needs to show it.
export interface FoundGame {
  id: string;
  url: string;
  white: string; // names, as the site shows them
  black: string;
  season?: string; // the archived season it was played in ("Stagione 1"); none for this season
  round?: string; // none when the season did not keep its rounds
  // How it ended on Lichess, for the last line of the key moments
  ending?: { status?: string; winner?: 'white' | 'black' };
  // Not over yet: the replay would show the position the site keeps hidden while the game is played
  ongoing: boolean;
  // A result decided by the organizer or a game won by forfeit: the moves on Lichess tell another story
  decided: boolean;
  // This season's key moments, on the game itself; an archived game's are read when it opens
  analysis?: GameAnalysis;
  // Finished, its analysis on its way (this season's games only)
  pending?: boolean;
}

const ONGOING = new Set(['created', 'started']);
const winnerOf = (result: string): 'white' | 'black' | undefined => (result === '1-0' ? 'white' : result === '0-1' ? 'black' : undefined);

export function findGame(
  id: string,
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  seasons: SeasonArchive[],
  nameOf: NameOf
): FoundGame | undefined {
  const current = history.find((g) => extractGameId(g.url) === id);
  if (current) {
    const s = stateOf(current, gameStates);
    const decided = !!current.decision || byOrganizer(s?.status) || s?.status === 'forfeit';
    return {
      id,
      url: current.url,
      white: nameOf(current.white),
      black: nameOf(current.black),
      round: current.round,
      ending: s ? { status: s.status, winner: s.winner } : undefined,
      ongoing: !s || ONGOING.has(s.status),
      decided,
      analysis: decided ? undefined : analysisOf(current),
      pending: !decided && !!s && !ONGOING.has(s.status) && analysisPending(current, s),
    };
  }
  // The newest season first: a game id is unique on Lichess, but an archive restored twice is not
  const archived = [...seasons].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  for (const season of archived) {
    const g = season.games?.find((x) => x.id === id);
    if (!g) continue;
    const nameIn = (handle: string) => nameOf(handle, season.standings.find((s) => s.handle.toLowerCase() === handle.toLowerCase())?.name);
    return {
      id,
      url: `https://lichess.org/${id}`,
      white: nameIn(g.white),
      black: nameIn(g.black),
      season: shortSeason(season.season, season.title),
      // The first season was archived without its rounds ("–")
      round: /\d/.test(g.round) ? g.round : undefined,
      ending: { status: g.status, winner: winnerOf(g.result) },
      ongoing: false,
      decided: byOrganizer(g.status) || g.status === 'forfeit',
    };
  }
  return undefined;
}
