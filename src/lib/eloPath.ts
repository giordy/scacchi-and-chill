// How a player's Elo del torneo moved in a season, game after game, for the chart of «La stagione
// in breve»: the rating before each game, the opponent's, the result and the rating after. The
// same steps as lib/tournamentElo.ts computeElo (K = 32, against an esordiente only the esordiente
// moves); at the end of a first (archived) season the rating then becomes the performance, so the
// end can differ from the last step.
import { CURRENT, ELO_K, EloReport, expectedScore, gameKey } from './tournamentElo';

export interface EloStep {
  opponent: string;
  round?: string;
  score: 0 | 0.5 | 1; // the player's
  opponentElo: number; // at the start of the game
  expected: number; // the player's expected score
  before: number;
  after: number;
  still: boolean; // against an esordiente: the rating does not move
}

export interface EloPath {
  start: number;
  steps: EloStep[];
  end: number; // at the end of the season (now, for the current one)
  firstSeason: boolean;
  performance: boolean; // the end is the first season's performance, not the last step
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function seasonEloPath(elo: EloReport, handle: string, key: string): EloPath | null {
  const season = elo.seasons.find((s) => s.key === key);
  const me = handle.toLowerCase();
  const start = season?.start.get(me);
  if (!season || start === undefined) return null;
  const steps: EloStep[] = [];
  elo.played
    .filter((p) => p.season === key && (same(p.game.white, handle) || same(p.game.black, handle)))
    .forEach(({ game }) => {
      const at = elo.before.get(gameKey(game, key));
      if (!at) return;
      const white = same(game.white, handle);
      const opponent = white ? game.black : game.white;
      const before = white ? at.white : at.black;
      const opponentElo = white ? at.black : at.white;
      const whiteScore = game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5;
      const score = (white ? whiteScore : 1 - whiteScore) as EloStep['score'];
      const expected = expectedScore(before, opponentElo);
      const still = season.newcomers.has(opponent.toLowerCase()) && !season.newcomers.has(me);
      steps.push({ opponent, round: game.round, score, opponentElo, expected, before, after: still ? before : before + ELO_K * (score - expected), still });
    });
  if (steps.length === 0) return null;
  const end = season.end.get(me) ?? steps[steps.length - 1].after;
  const firstSeason = season.firstSeason.has(me);
  return { start, steps, end, firstSeason, performance: firstSeason && key !== CURRENT && Math.abs(end - steps[steps.length - 1].after) >= 0.5 };
}
