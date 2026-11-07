import { LichessExportGame } from '../types';
import { CURRENT, EloReport, gameKey } from './tournamentElo';
import { scoredResult } from './standings';

// Colpaccio: a result against someone much stronger, by the Elo del torneo at the start of the
// game (see lib/tournamentElo). A win counts from this many points of difference...
export const UPSET_WIN_GAP = 100;
// ...a draw, which is worth less, from this many
export const UPSET_DRAW_GAP = 200;

export interface Upset {
  kind: 'win' | 'draw';
  player: 'white' | 'black'; // who pulled it off: the lower rated side
  gap: number; // Elo del torneo points the opponent had more, at the start of the game
}

export interface Ratings {
  white: number;
  black: number;
  newcomer?: boolean; // an esordiente played: no colpaccio, their rating says nothing yet
}

// Pure rule, from the result and the two ratings before the game
export function upsetFrom(result: '1-0' | '0-1' | '½-½' | null | undefined, ratings: Ratings | undefined): Upset | null {
  if (!result || !ratings || ratings.newcomer) return null;
  const diff = Math.round(ratings.black - ratings.white); // > 0: Black was stronger
  if (result === '½-½') {
    const gap = Math.abs(diff);
    return gap >= UPSET_DRAW_GAP ? { kind: 'draw', player: diff > 0 ? 'white' : 'black', gap } : null;
  }
  const winner = result === '1-0' ? 'white' : 'black';
  const gap = winner === 'white' ? diff : -diff;
  return gap >= UPSET_WIN_GAP ? { kind: 'win', player: winner, gap } : null;
}

// The ratings of a game of the current season, as the Elo del torneo had them when it started
export function ratingsBefore(
  report: EloReport | undefined,
  game: { round?: string; white: string; black: string; id?: string }
): Ratings | undefined {
  return report?.before.get(gameKey(game, CURRENT));
}

// Colpaccio of a finished game of the current season
export function upsetOf(
  state: LichessExportGame | undefined,
  report: EloReport | undefined,
  game: { round?: string; white: string; black: string; id?: string }
): Upset | null {
  if (!state || state.status === 'forfeit') return null;
  return upsetFrom(scoredResult(state), ratingsBefore(report, game));
}

// "Stefano ha battuto un avversario molto più forte": the gap in points says little to most
export function upsetSentence(u: Upset, name: string): string {
  return u.kind === 'win'
    ? `${name} ha battuto un avversario molto più forte, secondo l'Elo del torneo`
    : `${name} ha pareggiato con un avversario molto più forte, secondo l'Elo del torneo`;
}
