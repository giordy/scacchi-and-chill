import { HistoryGame, ScheduledMatch } from '../types';
import { byRound } from './games';
export { byRound };

// One game of a round as the organizer sees it: planned in the schedule, created on Lichess, or both
export interface RoundMatch {
  white: string;
  black: string;
  // Lichess link, empty until the challenge is created
  url: string;
  // The game saved on Firestore, if the challenge was created
  game?: HistoryGame;
  // False for games created outside the schedule (older seasons, manual pairings)
  scheduled: boolean;
}

export interface RoundSummary {
  round: string;
  matches: RoundMatch[];
  // Matches that already have a Lichess link
  created: number;
}


const same = (a: { round: string; white: string; black: string }, b: { round: string; white: string; black: string }) =>
  a.round === b.round && a.white === b.white && a.black === b.black;

// Every round of the season, merging the official schedule with the games created on Lichess.
// Matches keep the schedule order; games created outside the schedule come after them.
export function roundsOf(schedule: ScheduledMatch[], history: HistoryGame[]): RoundSummary[] {
  const map = new Map<string, RoundMatch[]>();
  const push = (round: string, m: RoundMatch) => {
    const list = map.get(round) ?? [];
    list.push(m);
    map.set(round, list);
  };
  schedule.forEach((m) => {
    const game = history.find((g) => same(m, g));
    push(m.round, { white: m.white, black: m.black, url: game?.url ?? '', game, scheduled: true });
  });
  history
    .filter((g) => !schedule.some((m) => same(m, g)))
    .forEach((g) => push(g.round, { white: g.white, black: g.black, url: g.url, game: g, scheduled: false }));

  return [...map.keys()].sort(byRound).map((round) => {
    const matches = map.get(round)!;
    return { round, matches, created: matches.filter((m) => m.url).length };
  });
}

// Number for a new round: one after the highest numeric round
export function nextRoundNumber(rounds: { round: string }[]): string {
  const nums = rounds.map((r) => parseInt(r.round, 10)).filter(Number.isFinite);
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

// The round to open by default: the first one with games still to create, otherwise the last one
export function currentRound(rounds: RoundSummary[]): string | undefined {
  return (rounds.find((r) => r.created < r.matches.length) ?? rounds[rounds.length - 1])?.round;
}

// Schedule editing helpers: they return a new schedule and never touch other rounds

export function addMatch(schedule: ScheduledMatch[], match: ScheduledMatch): ScheduledMatch[] {
  return schedule.some((m) => same(m, match)) ? schedule : [...schedule, match];
}

export function removeMatch(schedule: ScheduledMatch[], match: ScheduledMatch): ScheduledMatch[] {
  return schedule.filter((m) => !same(m, match));
}

export function swapColors(schedule: ScheduledMatch[], match: ScheduledMatch): ScheduledMatch[] {
  return schedule.map((m) => (same(m, match) ? { ...m, white: m.black, black: m.white } : m));
}

export function removeRound(schedule: ScheduledMatch[], round: string): ScheduledMatch[] {
  return schedule.filter((m) => m.round !== round);
}
