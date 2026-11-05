import { PodiumPlace, SeasonWinner } from '../types';

export type Medal = 1 | 2 | 3;
export const MEDAL_EMOJI: Record<Medal, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Whole podium of a season, champion first, then by place
export function fullPodium(w: SeasonWinner): PodiumPlace[] {
  return [{ handle: w.handle, name: w.name, place: 1 as const }, ...(w.podium ?? [])].sort((a, b) => a.place - b.place);
}

// Champions of the latest season in the hall of fame (more than one when they tied)
export function reigningChampions(winners: SeasonWinner[] | undefined): { season: string; handles: string[] } | undefined {
  const last = reigningChampion(winners);
  if (!last) return undefined;
  return {
    season: last.season,
    handles: fullPodium(last).filter((p) => p.place === 1).map((p) => p.handle.toLowerCase()),
  };
}

// The champion of the latest season in the hall of fame (the list is in season order)
export function reigningChampion(winners: SeasonWinner[] | undefined): SeasonWinner | undefined {
  return winners && winners.length > 0 ? winners[winners.length - 1] : undefined;
}

// Podium of a final table, champion excluded. Places are shared on equal points and tiebreak,
// and a shared place uses up the next ones (two seconds, no third). No medal without points.
export function podiumFromStandings(
  standings: Array<{ handle: string; name: string; points: number; sb: number }>
): PodiumPlace[] {
  const better = (a: { points: number; sb: number }, b: { points: number; sb: number }) =>
    a.points > b.points || (a.points === b.points && a.sb > b.sb);
  return standings
    .slice(1)
    .filter((s) => s.points > 0)
    .map((s) => ({ handle: s.handle, name: s.name, place: 1 + standings.filter((o) => better(o, s)).length }))
    .filter((p): p is PodiumPlace => p.place <= 3);
}

// A podium typed by the organizer is valid when every place follows the shared ranking:
// a place is 1 + the players placed above it (two firsts then a 3rd, three seconds then nothing).
export function podiumError(rows: Array<{ handle: string; place: Medal }>): string | null {
  const filled = rows.filter((r) => r.handle.trim());
  if (!filled.some((r) => r.place === 1)) return "Indica almeno un primo posto.";
  const handles = filled.map((r) => r.handle.trim().toLowerCase());
  if (new Set(handles).size !== handles.length) return "Lo stesso giocatore compare due volte.";
  const wrong = filled.find((r) => r.place !== 1 + filled.filter((o) => o.place < r.place).length);
  if (wrong) {
    return `Il ${wrong.place}° posto non torna: con ${filled.filter((o) => o.place < wrong.place).length} giocatori davanti, il posto è il ${
      1 + filled.filter((o) => o.place < wrong.place).length
    }°.`;
  }
  return null;
}

export interface PlayerMedal {
  season: string;
  place: Medal;
}

// Every podium of a player in the hall of fame, in season order
export function medalsOf(handle: string, winners: SeasonWinner[] | undefined): PlayerMedal[] {
  const key = handle.toLowerCase();
  const medals: PlayerMedal[] = [];
  (winners ?? []).forEach((w) => {
    if (w.handle.toLowerCase() === key) medals.push({ season: w.season, place: 1 });
    (w.podium ?? []).forEach((p) => {
      if (p.handle.toLowerCase() === key) medals.push({ season: w.season, place: p.place });
    });
  });
  return medals;
}
