import { HistoryGame } from '../types';
import { GameProgress } from './progress';
import { byRound } from './games';

export interface RoundBlock {
  round: string;
  games: HistoryGame[];
}

// How the public "Partite" list is laid out, so the current round never sinks to the bottom
export interface MatchesLayout {
  // Highest round with a game created on Lichess, shown first and open
  current?: RoundBlock;
  // Games created in earlier rounds and not finished yet, shown right below the current round
  late: HistoryGame[];
  // Rounds after the current one, in round order, collapsed by default
  upcoming: RoundBlock[];
  // Rounds before the current one, most recent first, collapsed by default
  played: RoundBlock[];
  // True when every game of every round is over
  concluded: boolean;
}


// `games` already sorted by round; `progressOf` reads the live Lichess state of a game
export function layoutMatches(games: HistoryGame[], progressOf: (g: HistoryGame) => GameProgress): MatchesLayout {
  const rounds: RoundBlock[] = [];
  games.forEach((g) => {
    const last = rounds[rounds.length - 1];
    if (last && last.round === g.round) last.games.push(g);
    else rounds.push({ round: g.round, games: [g] });
  });

  const concluded = games.length > 0 && games.every((g) => progressOf(g) === 'finished');
  const created = rounds.filter((r) => r.games.some((g) => g.url)).map((r) => r.round).sort(byRound);
  const currentRound = created[created.length - 1];

  // Season not started yet: plain round order, nothing to bring forward
  if (currentRound === undefined) return { late: [], upcoming: rounds, played: [], concluded };

  const current = rounds.find((r) => r.round === currentRound);
  const played = rounds.filter((r) => byRound(r.round, currentRound) < 0).reverse();
  const upcoming = rounds.filter((r) => byRound(r.round, currentRound) > 0);
  // Only games already on Lichess: a pairing never created is not "late", it was dropped
  const late = played
    .slice()
    .reverse()
    .flatMap((r) => r.games.filter((g) => g.url && progressOf(g) !== 'finished'));

  return { current, late, upcoming, played, concluded };
}
