import { PodiumPlace, SeasonWinner } from '../types';

export type Medal = 1 | 2 | 3;
export const MEDAL_EMOJI: Record<Medal, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

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

// Places 2 and 3 from the organizer's picks: a tie for second leaves no third place
export function podiumFromPicks(second: string[], third: string[]): Array<{ handle: string; place: Medal }> {
  const seconds = [...new Set(second.filter(Boolean))];
  const thirds = seconds.length >= 2 ? [] : [...new Set(third.filter((h) => h && !seconds.includes(h)))];
  return [...seconds.map((handle) => ({ handle, place: 2 as Medal })), ...thirds.map((handle) => ({ handle, place: 3 as Medal }))];
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
