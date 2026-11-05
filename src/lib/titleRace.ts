import { HistoryGame, LichessExportGame, Player } from '../types';
import { computeStandings } from './standings';
import { gameProgress } from './progress';
import { isVoid, stateOf } from './games';

export interface TitleRace {
  // Players who can still finish first (alone or level on points), in standings order
  contenders: { handle: string; name: string; points: number; max: number }[];
  champion?: { handle: string; name: string }; // set once nobody else can reach the leader
  roundsLeft: number; // rounds with games still to play
}

// Who can still win the season, from the points so far plus one point per game left. Shown only
// when it says something: once someone is out of reach, until the season ends. Players out of the
// race are never named, only those still in it.
export function titleRace(players: Player[], games: HistoryGame[], gameStates: Record<string, LichessExportGame>): TitleRace | null {
  const { standings } = computeStandings(players, games, gameStates);
  const left = new Map<string, number>();
  const openRounds = new Set<string>();
  games.forEach((g) => {
    const s = stateOf(g, gameStates);
    // Not finished, or aborted (to be replayed): still to play
    if (gameProgress(s) === 'finished' && !isVoid(s)) return;
    openRounds.add(g.round);
    [g.white, g.black].forEach((h) => left.set(h, (left.get(h) ?? 0) + 1));
  });
  if (openRounds.size === 0 || standings.length < 2) return null; // season not started or over
  const leader = standings[0];
  if (leader.points <= 0) return null;

  const race = standings.map((s) => ({ handle: s.handle, name: s.name, points: s.points, max: s.points + (left.get(s.handle) ?? 0) }));
  const contenders = race.filter((r) => r.max >= leader.points);
  if (contenders.length === race.length) return null; // everyone can still win: nothing to say
  // Clinched when nobody else can even draw level with the leader
  const champion = contenders.length === 1 ? { handle: leader.handle, name: leader.name } : undefined;
  return { contenders, champion, roundsLeft: openRounds.size };
}
