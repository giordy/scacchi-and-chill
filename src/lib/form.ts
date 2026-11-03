import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from './utils';
import { gameProgress } from './progress';

export type FormResult = 'win' | 'draw' | 'loss';

const VOID_STATUSES = new Set(['aborted', 'noStart']);

// Result of a finished game from one side, or null when it gives no result (unfinished or voided)
export function resultFor(state: LichessExportGame | undefined, color: 'white' | 'black'): FormResult | null {
  if (!state || gameProgress(state) !== 'finished' || VOID_STATUSES.has(state.status)) return null;
  if (state.winner) return state.winner === color ? 'win' : 'loss';
  return 'draw';
}

// Last `size` results of each player, oldest first: ordered by round, then by when the game ended
export function computeRecentForm(
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  size = 5
): Record<string, FormResult[]> {
  const finished = history
    .map((g) => {
      const id = extractGameId(g.url);
      return { g, s: id ? gameStates[id] : undefined };
    })
    .filter(({ s }) => resultFor(s, 'white') !== null)
    .sort(
      (a, b) =>
        a.g.round.localeCompare(b.g.round, undefined, { numeric: true }) ||
        (a.s?.lastMoveAt ?? 0) - (b.s?.lastMoveAt ?? 0)
    );

  const form: Record<string, FormResult[]> = {};
  finished.forEach(({ g, s }) => {
    (form[g.white] ??= []).push(resultFor(s, 'white') as FormResult);
    (form[g.black] ??= []).push(resultFor(s, 'black') as FormResult);
  });
  Object.keys(form).forEach((h) => {
    form[h] = form[h].slice(-size);
  });
  return form;
}
