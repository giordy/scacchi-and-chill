// What a result decided by the organizer (lib/decisions.ts) does to the rest of the season: the
// Trofeo Pillsbury, the awards, the Elo del torneo, the cronaca and the messages
import { describe, expect, it } from 'vitest';
import { applyWithdrawals } from '../withdrawals';
import { pillsburyRace } from '../pillsbury';
import { tournamentElo } from '../tournamentElo';
import { computeSeasonAwards } from '../awards';
import { currentSeasonActivity } from '../activity';
import { seasonWrapped } from '../wrapped';
import { lastMovesOf } from '../seenMoves';
import { liveGameIds } from '../live';
import { syncTargets } from '../games';
import { reviewMatches } from '../../ReviewsTab';
import { titleRace } from '../titleRace';
import { ArchivedGame, GameDecision, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const handles = ['anna', 'bruno', 'carla', 'dario'];
const players = handles.map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const url = (id: string) => `https://lichess.org/${id}`;
const moves = (n: number) => Array.from({ length: n }, () => 'e4').join(' ');
// A season played before: everybody has a rating, nobody is an esordiente
const past: SeasonArchive = {
  id: 'stagione-1', season: 'Stagione 1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: 6,
  standings: players.map((p) => ({ handle: p.handle, name: p.name, played: 3, won: 1, drawn: 1, lost: 1, points: 1.5, sb: 0 })),
  games: [
    { round: '1', white: 'anna', black: 'bruno', result: '1-0', end: 1 },
    { round: '1', white: 'carla', black: 'dario', result: '½-½', end: 2 },
    { round: '2', white: 'bruno', black: 'carla', result: '1-0', end: 3 },
    { round: '2', white: 'dario', black: 'anna', result: '½-½', end: 4 },
    { round: '3', white: 'carla', black: 'anna', result: '1-0', end: 5 },
    { round: '3', white: 'bruno', black: 'dario', result: '0-1', end: 6 },
  ],
};
const played = (round: string, white: string, black: string, id: string, s: Partial<LichessExportGame>, at: number): HistoryGame => ({
  round, white, black, url: url(id), createdAt: 1,
  lichess: { id, moves: moves(40), lastMoveAt: at, opening: { name: "Queen's Gambit Declined" }, ...s } as LichessExportGame,
});
const D = (result: GameDecision['result'], at: number): GameDecision => ({ result, at });
// Round 1 on the board; round 2: Anna–Carla still open on Lichess, Bruno–Dario never accepted
const board = [
  played('1', 'anna', 'bruno', 'aaaaaaaa', { status: 'draw' }, 100),
  played('1', 'carla', 'dario', 'bbbbbbbb', { status: 'draw' }, 200),
];
const open = [
  played('2', 'anna', 'carla', 'cccccccc', { status: 'started', lastMoveAt: 300 }, 300),
  { round: '2', white: 'bruno', black: 'dario', url: url('dddddddd'), createdAt: 1 },
];
const season = (decisions: (GameDecision | undefined)[]) =>
  applyWithdrawals([...board, ...open.map((g, i) => (decisions[i] ? { ...g, decision: decisions[i] } : g))], []);

describe('a decided result and the Trofeo Pillsbury', () => {
  it('counts neither for the points nor for the objective of the race', () => {
    const before = season([]);
    const after = season([D('1-0', 400), D('0-0', 400)]);
    const race = (h: HistoryGame[]) => pillsburyRace(players, tournamentElo([past], handles, h, {}), h, h, {});
    const r0 = race(before);
    const r1 = race(after);
    // the decided games leave the calendar of the race: one game fewer each
    expect(r1.counted.anna).toEqual({ played: 1, games: 1 });
    expect(r0.counted.anna).toEqual({ played: 1, games: 2 });
    expect(r1.counted.bruno.games).toBe(1);
    // points and objective made only on the board: the decided win gives Anna nothing in the race
    expect(r1.forecasts.anna.points).toBe(0.5);
    expect(r1.forecasts.anna.expectedSoFar).toBeCloseTo(r0.forecasts.anna.expectedSoFar, 10);
  });
});

describe('a decided result and the awards', () => {
  it('makes no draw for Il muro, nor a game for the other awards', () => {
    // Anna: one draw on the board and two decided ones (three in the standings); Bruno and Carla: two on the board
    const extra: HistoryGame[] = [
      played('3', 'carla', 'bruno', 'eeeeeeee', { status: 'draw' }, 500),
      { ...played('3', 'anna', 'dario', 'ffffffff', { status: 'started' }, 500), decision: D('½-½', 600) },
    ];
    const h = applyWithdrawals([...board, ...extra, { ...open[0], decision: D('½-½', 700) }], []);
    const awards = computeSeasonAwards(players, h, {}, [past]);
    const wall = awards.find((a) => a.id === 'draws');
    expect(wall?.winners.map((w) => w.handle).sort()).toEqual(['bruno', 'carla']);
    // the longest win, the quickest: only games won on the board (there are none here)
    expect(awards.find((a) => a.id === 'fastest')).toBeUndefined();
    expect(awards.find((a) => a.id === 'longest')).toBeUndefined();
  });
});

describe('a decided result and the Elo del torneo', () => {
  it('moves no rating: as if the game was not there', () => {
    const decided = tournamentElo([past], handles, season([D('1-0', 400), D('0-0', 400)]), {});
    const without = tournamentElo([past], handles, applyWithdrawals(board, []), {});
    expect([...decided.ratings]).toEqual([...without.ratings]);
    expect(decided.played.filter((p) => p.season !== 'stagione-1')).toHaveLength(2);
  });

  it('nor does a 0-0 kept in an archived season', () => {
    const archived: SeasonArchive = { ...past, id: 'stagione-0', archivedAt: '2025-01-01', games: [{ round: '1', white: 'anna', black: 'bruno', result: '0-0', status: 'doubleLoss', end: 1 }] };
    const withIt = tournamentElo([archived, past], handles, [], {});
    const withoutIt = tournamentElo([{ ...archived, games: [] }, past], handles, [], {});
    expect([...withIt.ratings]).toEqual([...withoutIt.ratings]);
  });
});

describe('a decided result and the cronaca', () => {
  const events = (h: HistoryGame[]) => currentSeasonActivity({ season: 'S', players, history: h, gameStates: {}, schedule: [] });

  it('closes the round when its last game is decided, at the time of the decision', () => {
    const h = season([D('½-½', 400), D('0-0', 500)]);
    const end = events(h).find((e) => e.kind === 'roundEnd' && e.key.endsWith(':2'));
    // round 2 is the last of the season: its end is the season's (no roundEnd), round 1 closed at 200
    expect(end).toBeUndefined();
    expect(events(h).find((e) => e.kind === 'roundEnd' && e.key.endsWith(':1'))?.at).toBe(200);
    const more = [...h, { round: '3', white: 'anna', black: 'dario', url: url('gggggggg'), createdAt: 1 }];
    expect(events(more).find((e) => e.kind === 'roundEnd' && e.key.endsWith(':2'))?.at).toBe(500);
  });

  it('has no event of its own, while the round still open has none', () => {
    const h = season([D('1-0', 400), undefined]);
    const results = events(h).filter((e) => e.kind === 'result');
    expect(results.map((e) => e.key.split(':').pop()).sort()).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect(events(h).some((e) => e.kind === 'roundEnd' && e.key.endsWith(':2'))).toBe(false);
  });
});

describe('a decided result and the messages', () => {
  it('is said as such in the prompt of the season story, 0-0 included, without moves nor opening', () => {
    const { finishedMatches, ongoingMatches } = reviewMatches(season([D('0-1', 400), D('0-0', 400)]), {});
    expect(finishedMatches.find((m) => m.white === 'anna' && m.black === 'carla')).toEqual({
      round: '2', white: 'anna', black: 'carla', result: "0-1 (deciso dall'organizzatore)", winner: 'carla',
    });
    expect(finishedMatches.find((m) => m.white === 'bruno')).toEqual({
      round: '2', white: 'bruno', black: 'dario', result: "0-0 (deciso dall'organizzatore, persa per entrambi)",
    });
    expect(ongoingMatches).toEqual([]);
    expect(reviewMatches(season([]), {}).ongoingMatches).toHaveLength(2);
  });

  it('gives no news of moves played on Lichess after the decision, nor live updates', () => {
    const h = season([D('½-½', 400)]);
    const live = { cccccccc: { id: 'cccccccc', status: 'started', lastMoveAt: Date.now() } as LichessExportGame };
    expect(lastMovesOf(h, live)).not.toHaveProperty('cccccccc');
    expect(lastMovesOf(season([]), live)).toHaveProperty('cccccccc');
    const presence = { seenAt: { anna: Date.now(), carla: Date.now() }, flair: {}, now: Date.now() };
    expect(liveGameIds(h, live, presence as any, Date.now()).has('cccccccc')).toBe(false);
    expect(liveGameIds(season([]), live, presence as any, Date.now()).has('cccccccc')).toBe(true);
  });

  it('is not read again from Lichess by the organizer area', () => {
    expect(syncTargets(season([D('½-½', 400)])).ids).toEqual(['dddddddd']);
  });
});

describe('0-0 in the season in short', () => {
  it('is a defeat that gives the opponent nothing, and breaks a run without defeats', () => {
    const games: ArchivedGame[] = [
      { round: '1', white: 'anna', black: 'bruno', result: '½-½', plies: 40 },
      { round: '2', white: 'anna', black: 'carla', result: '0-0', status: 'doubleLoss' },
      { round: '3', white: 'dario', black: 'anna', result: '½-½', plies: 40 },
    ];
    const w = seasonWrapped('anna', games)!;
    expect(w).toMatchObject({ played: 3, won: 0, drawn: 2, lost: 1, points: 1 });
    const c = seasonWrapped('carla', games)!;
    expect(c).toMatchObject({ played: 1, lost: 1, points: 0 });
  });
});

describe('a decided result and the race for the Scudetto', () => {
  it('is a game no longer to play: it leaves no points to win', () => {
    // Anna won three, Bruno one; their last game is decided 0-0: nobody can catch Anna any more
    const g = (round: string, white: string, black: string, id: string, winner?: 'white' | 'black') =>
      played(round, white, black, id, { status: winner ? 'resign' : 'draw', winner }, Number(round));
    const games = [
      g('1', 'anna', 'carla', 'a1a1a1a1', 'white'),
      g('1', 'bruno', 'dario', 'b1b1b1b1', 'white'),
      g('2', 'dario', 'anna', 'a2a2a2a2', 'black'),
      g('2', 'carla', 'bruno', 'b2b2b2b2', 'white'),
      g('3', 'anna', 'bruno', 'a3a3a3a3', 'white'),
      { round: '4', white: 'bruno', black: 'anna', url: url('a4a4a4a4'), createdAt: 1, lichess: { id: 'a4a4a4a4', status: 'started' } as LichessExportGame },
      { round: '4', white: 'carla', black: 'dario', url: url('c4c4c4c4'), createdAt: 1, lichess: { id: 'c4c4c4c4', status: 'started' } as LichessExportGame },
    ];
    const open = titleRace(players, applyWithdrawals(games, []), {});
    expect(open?.contenders.find((c) => c.handle === 'anna')?.max).toBe(4);
    const decided = titleRace(players, applyWithdrawals(games.map((x) => (x.round === '4' && x.white === 'bruno' ? { ...x, decision: D('0-0', 9) } : x)), []), {});
    // Anna stays at 3, with nothing left to play; nobody else can get there
    expect(decided?.contenders.map((c) => c.handle)).toEqual(['anna']);
    expect(decided?.champion?.handle).toBe('anna');
  });
});
