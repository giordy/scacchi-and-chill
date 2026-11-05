import { LichessExportGame } from '../types';

// Colpaccio: a win against an opponent rated at least this many Lichess points higher
export const UPSET_GAP = 150;

export interface Upset {
  winner: 'white' | 'black';
  gap: number; // rating points the loser had more than the winner, at the start of the game
}

// Ratings are the ones at the start of the game. A provisional rating ("1500?" on Lichess) says
// too little yet, so a game where either rating is provisional is never a colpaccio.
export function upsetOf(state?: LichessExportGame): Upset | null {
  if (!state?.winner) return null;
  const win = state.players?.[state.winner];
  const lose = state.players?.[state.winner === 'white' ? 'black' : 'white'];
  if (typeof win?.rating !== 'number' || typeof lose?.rating !== 'number') return null;
  if (win.provisional || lose.provisional) return null;
  const gap = lose.rating - win.rating;
  return gap >= UPSET_GAP ? { winner: state.winner, gap } : null;
}

export const upsetTitle = (u: Upset) => `Ha battuto un avversario con ${u.gap} punti Elo in più`;
