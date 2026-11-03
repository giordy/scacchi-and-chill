import { HistoryGame, ScheduledMatch } from '../types';

const sameGame = (m: ScheduledMatch, g: HistoryGame) =>
  m.round === g.round && m.white === g.white && m.black === g.black;

// Games shown in the public "Partite" tab: those already created on Lichess plus the scheduled
// ones not created yet (empty url), so visitors can see the whole season ahead.
export function withScheduledGames(history: HistoryGame[], schedule: ScheduledMatch[]): HistoryGame[] {
  const future = schedule
    .filter((m) => !history.some((g) => sameGame(m, g)))
    .map((m) => ({ round: m.round, white: m.white, black: m.black, url: '' }));
  return [...history, ...future];
}
