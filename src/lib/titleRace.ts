import { HistoryGame, LichessExportGame, Player } from '../types';
import { computeStandings } from './standings';
import { gameProgress } from './progress';
import { isVoid, stateOf } from './games';

export interface TitleRace {
  // Players who can still finish first (alone or level on points), in standings order
  contenders: { handle: string; name: string; points: number; max: number }[];
  champion?: { handle: string; name: string }; // set once nobody else can reach the leader
  roundsLeft: number; // rounds with games still to play
  needs: TitleNeed[]; // what each contender needs, in the same order
}

// What a contender needs from their own games left to finish first whatever the others do: the
// fewest points (in halves) that put them beyond every rival's best, null when no score is enough
// on their own (they need the others to drop points too). `level` is the same to finish at least
// level on points (the tie-break then decides).
export interface TitleNeed {
  handle: string;
  left: number; // games left
  alone: number | null; // points enough to finish first alone
  level: number | null; // points enough to finish at least level
}

// Who can still win the season, from the points so far plus one point per game left. Shown only
// when it says something: once someone is out of reach, until the season ends. Players out of the
// race are never named, only those still in it.
export function titleRace(players: Player[], games: HistoryGame[], gameStates: Record<string, LichessExportGame>): TitleRace | null {
  const { standings } = computeStandings(players, games, gameStates);
  const left = new Map<string, number>();
  const between = new Map<string, number>(); // games left between two players, "a|b" both ways
  const openRounds = new Set<string>();
  games.forEach((g) => {
    const s = stateOf(g, gameStates);
    // Not finished, or aborted (to be replayed): still to play
    if (gameProgress(s) === 'finished' && !isVoid(s)) return;
    openRounds.add(g.round);
    [g.white, g.black].forEach((h) => left.set(h, (left.get(h) ?? 0) + 1));
    [`${g.white}|${g.black}`, `${g.black}|${g.white}`].forEach((k) => between.set(k, (between.get(k) ?? 0) + 1));
  });
  if (openRounds.size === 0 || standings.length < 2) return null; // season not started or over
  const leader = standings[0];
  if (leader.points <= 0) return null;

  const race = standings.map((s) => ({ handle: s.handle, name: s.name, points: s.points, max: s.points + (left.get(s.handle) ?? 0) }));
  const contenders = race.filter((r) => r.max >= leader.points);
  if (contenders.length === race.length) return null; // everyone can still win: nothing to say
  // Clinched when nobody else can even draw level with the leader
  const champion = contenders.length === 1 ? { handle: leader.handle, name: leader.name } : undefined;
  const needs = champion ? [] : contenders.map((c) => titleNeed(c, race, left, between));
  return { contenders, champion, roundsLeft: openRounds.size, needs };
}

// The worst case for a contender scoring x in their games left: the points come from the games
// against others first, so each rival keeps as many of their own games against the contender as
// possible, and wins all the rest
function titleNeed(
  c: { handle: string; points: number },
  race: { handle: string; points: number }[],
  left: Map<string, number>,
  between: Map<string, number>
): TitleNeed {
  const mine = left.get(c.handle) ?? 0;
  const rivalBest = (x: number) =>
    Math.max(
      ...race
        .filter((r) => r.handle !== c.handle)
        .map((r) => {
          const h = between.get(`${c.handle}|${r.handle}`) ?? 0;
          const taken = Math.max(0, x - (mine - h)); // points the contender must take off this rival
          return r.points + (left.get(r.handle) ?? 0) - taken;
        })
    );
  const least = (beats: (me: number, rival: number) => boolean) => {
    for (let x = 0; x <= mine; x += 0.5) if (beats(c.points + x, rivalBest(x))) return x;
    return null;
  };
  return { handle: c.handle, left: mine, alone: least((me, rival) => me > rival), level: least((me, rival) => me >= rival) };
}

const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');
const pointsText = (n: number) => `${halves(n)} ${n === 1 || n === 0.5 ? 'punto' : 'punti'}`;
const gamesText = (n: number) => (n === 1 ? "nell'ultima partita" : `nelle ultime ${n} partite`);

// What a contender needs, in words: "bastano 2 punti nelle ultime 3 partite"
export function needText(need: TitleNeed): string {
  // Games all played: nothing left to do but wait for the others
  if (need.left === 0) {
    return need.level !== null
      ? 'ha finito le sue partite: nessuno può superarlo, ma può ancora essere raggiunto a pari punti'
      : 'ha finito le sue partite: servono passi falsi degli altri';
  }
  if (need.alone !== null) {
    return need.alone === need.left && need.left > 0
      ? `deve vincere ${need.left === 1 ? "l'ultima partita" : `tutte le ultime ${need.left} partite`}`
      : `${need.alone === 1 || need.alone === 0.5 ? 'basta' : 'bastano'} ${pointsText(need.alone)} ${gamesText(need.left)}`;
  }
  if (need.level !== null) {
    return `con ${pointsText(need.level)} ${gamesText(need.left)} arriva almeno a pari punti; per il primo posto servono passi falsi degli altri`;
  }
  return 'non dipende solo dalle sue partite: servono passi falsi degli altri';
}
