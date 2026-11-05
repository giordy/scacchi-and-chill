import { HistoryGame, LichessExportGame } from '../types';
import { stateOf } from './games';

// Lichess serves the flair images from its asset host
export const flairUrl = (flair: string) => `https://lichess1.org/assets/flair/img/${flair}.webp`;

// The player's Lichess flair, from their most recent game (Lichess sends it with each player)
export function flairFromGames(
  handle: string,
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): string | undefined {
  const key = handle.toLowerCase();
  let best: { at: number; flair?: string } | undefined;
  history.forEach((g) => {
    const s = stateOf(g, gameStates);
    if (!s?.players) return;
    (['white', 'black'] as const).forEach((c) => {
      const u = s.players?.[c]?.user;
      if (u?.id?.toLowerCase() !== key) return;
      const at = s.lastMoveAt ?? s.createdAt ?? 0;
      // A missing flair in a newer game means the player removed it
      if (!best || at >= best.at) best = { at, flair: u.flair };
    });
  });
  return best?.flair;
}
