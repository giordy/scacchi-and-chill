import { HistoryGame, LichessExportGame } from '../types';
import { gameProgress } from './progress';
import { visiblePlies } from './phase';

const VOID = new Set(['aborted', 'noStart']);

// "Partita del turno": in a concluded round, the longest game (as the bulletin's highlight).
// Ties go to a decisive game; still tied, or fewer than two games played, no pick.
// Returns the Lichess URL of each round's pick.
export function gamesOfTheRound(
  games: HistoryGame[],
  stateOf: (g: HistoryGame) => LichessExportGame | undefined
): Set<string> {
  const byRound = new Map<string, HistoryGame[]>();
  games.forEach((g) => byRound.set(g.round, [...(byRound.get(g.round) ?? []), g]));

  const picks = new Set<string>();
  byRound.forEach((roundGames) => {
    if (roundGames.some((g) => gameProgress(stateOf(g)) !== 'finished')) return;
    const played = roundGames
      .filter((g) => g.url && !VOID.has(stateOf(g)!.status) && visiblePlies(stateOf(g)) > 0)
      .map((g) => ({ g, plies: visiblePlies(stateOf(g)), decisive: !!stateOf(g)!.winner }))
      .sort((a, b) => b.plies - a.plies || Number(b.decisive) - Number(a.decisive));
    if (played.length < 2) return;
    const [first, second] = played;
    if (first.plies === second.plies && first.decisive === second.decisive) return;
    picks.add(first.g.url!);
  });
  return picks;
}
