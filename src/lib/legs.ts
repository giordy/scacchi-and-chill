import { byRound } from './games';

type Match = { round: string; white: string; black: string };

const pairKey = (m: Match) => [m.white, m.black].sort().join('\u0000');

// First round of the return leg ("ritorno"): the first round whose games are all rematches
// of pairs that already met earlier. Undefined for a single round robin.
// Works for generated and hand-made schedules alike.
export function returnLegStart(matches: Match[]): string | undefined {
  const rounds = [...new Set(matches.map((m) => m.round))].sort(byRound);
  const seen = new Set<string>();
  for (const r of rounds) {
    const games = matches.filter((m) => m.round === r);
    if (games.length > 0 && seen.size > 0 && games.every((m) => seen.has(pairKey(m)))) return r;
    games.forEach((m) => seen.add(pairKey(m)));
  }
  return undefined;
}

export function isReturnLeg(round: string, start: string | undefined): boolean {
  return start !== undefined && byRound(round, start) >= 0;
}
