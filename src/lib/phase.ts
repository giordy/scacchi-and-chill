import { LichessExportGame } from '../types';
import { getApproxMoves } from './utils';
import { movesText, pliesOf } from './games';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export const PHASE_LABEL: Record<GamePhase, string> = {
  opening: 'apertura',
  middlegame: 'mediogioco',
  endgame: 'finale',
};

// Phase of the game from Lichess' own division (the plies where middlegame and endgame begin,
// computed from material and position, no engine analysis). Undefined when Lichess sent none.
export function gamePhase(state?: LichessExportGame): GamePhase | undefined {
  const division = state?.division;
  if (!division) return undefined;
  const plies = pliesOf(state);
  if (division.end !== undefined && plies >= division.end) return 'endgame';
  if (division.middle !== undefined && plies >= division.middle) return 'middlegame';
  return 'opening';
}

// "34 mosse" for finished games, "più di 20 mosse" for ongoing ones (same bands as the bulletin)
export function movesLabel(state: LichessExportGame | undefined, finished: boolean): string {
  const plies = pliesOf(state);
  if (plies === 0) return '';
  return finished ? movesText(Math.ceil(plies / 2)) : getApproxMoves(plies).approxMoves;
}
