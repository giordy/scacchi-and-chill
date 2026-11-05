import { LichessExportGame } from '../types';
import { getApproxMoves } from './utils';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export const PHASE_LABEL: Record<GamePhase, string> = {
  opening: 'apertura',
  middlegame: 'mediogioco',
  endgame: 'finale',
};

// Half-moves returned by Lichess (for ongoing games the last ones are hidden, anti-cheat)
export function visiblePlies(state?: LichessExportGame): number {
  const moves = state?.moves?.trim();
  return moves ? moves.split(/\s+/).length : 0;
}

// Phase of the game from Lichess' own division (the plies where middlegame and endgame begin,
// computed from material and position, no engine analysis). Undefined when Lichess sent none.
export function gamePhase(state?: LichessExportGame): GamePhase | undefined {
  const division = state?.division;
  if (!division) return undefined;
  const plies = visiblePlies(state);
  if (division.end !== undefined && plies >= division.end) return 'endgame';
  if (division.middle !== undefined && plies >= division.middle) return 'middlegame';
  return 'opening';
}

// "34 mosse" for finished games, "più di 20 mosse" for ongoing ones (same bands as the bulletin)
export function movesLabel(state: LichessExportGame | undefined, finished: boolean): string {
  const plies = visiblePlies(state);
  if (plies === 0) return '';
  if (!finished) return getApproxMoves(plies).approxMoves;
  const moves = Math.ceil(plies / 2);
  return `${moves} ${moves === 1 ? 'mossa' : 'mosse'}`;
}
