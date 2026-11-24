import { describe, expect, it } from 'vitest';
import { applyDecisions, cleanDecision, decidedState, decisionLabel } from '../decisions';
import { computeStandings, pointsOf, scoreFor, scoredResult } from '../standings';
import { applyWithdrawals } from '../withdrawals';
import { byOrganizer, decidedAtTable, stateOf } from '../games';
import { archivedGames } from '../seasons';
import { tournamentElo } from '../tournamentElo';
import { upsetFrom } from '../upset';
import { allTimeHeadToHead } from '../allTime';
import { currentSeasonActivity } from '../activity';
import { computePlayerProfile } from '../playerProfile';
import { gameFromDoc } from '../firestoreRest';
import { isOpen } from '../roundDeadline';
import { ArchivedGame, HistoryGame, LichessExportGame } from '../../types';

const players = ['anna', 'bruno', 'carla', 'dario'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const url = (id: string) => `https://lichess.org/${id}`;
const AT = Date.UTC(2026, 11, 15, 12);
// Anna–Bruno still open on Lichess, Carla–Dario never accepted, Anna–Carla won by Anna on the board
const raw: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'bruno', url: url('aaaaaaaa'), createdAt: 1, lichess: { id: 'aaaaaaaa', status: 'started', moves: 'e4 e5 Nf3', opening: { name: 'Italian Game' } } as LichessExportGame },
  { round: '1', white: 'carla', black: 'dario', url: url('bbbbbbbb'), createdAt: 1 },
  { round: '2', white: 'anna', black: 'carla', url: url('cccccccc'), createdAt: 2, lichess: { id: 'cccccccc', status: 'resign', winner: 'white', lastMoveAt: 5, moves: 'e4 e5' } as LichessExportGame },
];
const decide = (history: HistoryGame[], i: number, result: '1-0' | '0-1' | '½-½' | '0-0'): HistoryGame[] =>
  history.map((g, j) => (j === i ? { ...g, decision: { result, at: AT } } : g));

describe('the points of a result', () => {
  it('are 1 and 0, ½ each, or 0 each for a 0-0', () => {
    expect(pointsOf('1-0')).toEqual([1, 0]);
    expect(pointsOf('0-1')).toEqual([0, 1]);
    expect(pointsOf('½-½')).toEqual([0.5, 0.5]);
    expect(pointsOf('0-0')).toEqual([0, 0]);
    expect(scoreFor('0-0', true)).toBe(0);
    expect(scoreFor('0-0', false)).toBe(0);
    expect(scoreFor('0-1', false)).toBe(1);
  });
});

describe('a result decided by the organizer', () => {
  it('is read from Firestore only when well formed', () => {
    expect(cleanDecision({ result: '0-0', at: 5, note: '  nessun accordo ' })).toEqual({ result: '0-0', at: 5, note: 'nessun accordo' });
    expect(cleanDecision({ result: '1-0', at: 5, note: '  ' })).toEqual({ result: '1-0', at: 5 });
    expect(cleanDecision({ result: '2-0', at: 5 })).toBeUndefined();
    expect(cleanDecision({ result: '1-0' })).toBeUndefined();
    expect(cleanDecision(null)).toBeUndefined();
    expect(gameFromDoc({ round: '1', white: 'a', black: 'b', url: '', decision: { result: '½-½', at: 3 } })?.decision).toEqual({ result: '½-½', at: 3 });
    expect(gameFromDoc({ round: '1', white: 'a', black: 'b', url: '' })).not.toHaveProperty('decision');
  });

  it('becomes the state of the game: the result, ended when decided, the moves so far kept', () => {
    const s = decidedState(raw[0], { result: '0-1', at: AT });
    expect(s).toMatchObject({ id: 'aaaaaaaa', status: 'decided', winner: 'black', lastMoveAt: AT, moves: 'e4 e5 Nf3', opening: { name: 'Italian Game' } });
    expect(s).not.toHaveProperty('lastFen');
    expect(decidedState(raw[1], { result: '0-0', at: AT })).toMatchObject({ id: 'bbbbbbbb', status: 'doubleLoss' });
    expect(decidedState(raw[1], { result: '½-½', at: AT })).not.toHaveProperty('winner');
    expect(scoredResult(decidedState(raw[1], { result: '0-0', at: AT }))).toBe('0-0');
    expect(scoredResult(decidedState(raw[1], { result: '½-½', at: AT }))).toBe('½-½');
    expect(decidedAtTable('decided') && decidedAtTable('doubleLoss') && byOrganizer('doubleLoss')).toBe(true);
    expect(byOrganizer('forfeit')).toBe(false);
  });

  it('wins over the state read fresh from Lichess, once applied with the withdrawals', () => {
    const live = { aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white' } as LichessExportGame };
    const season = applyWithdrawals(decide(raw, 0, '0-1'), []);
    expect(stateOf(season[0], live)?.status).toBe('decided');
    expect(scoredResult(stateOf(season[0], live))).toBe('0-1');
    // without it, Lichess as before; the undecided games untouched
    expect(stateOf(applyWithdrawals(raw, [])[0], live)?.winner).toBe('white');
    expect(applyDecisions(raw)).toBe(raw);
    expect(season[2]).toBe(decide(raw, 0, '0-1')[2]);
    // a decided game is no longer being played (Turni con scadenza, overdue games)
    expect(isOpen(decide(raw, 0, '0-1')[0], {})).toBe(false);
    expect(isOpen(raw[0], {})).toBe(true);
  });

  it('labels the choices with the players', () => {
    expect(decisionLabel('1-0', 'Anna', 'Bruno')).toBe('1-0: vince Anna');
    expect(decisionLabel('0-1', 'Anna', 'Bruno')).toBe('0-1: vince Bruno');
    expect(decisionLabel('½-½', 'Anna', 'Bruno')).toBe('½-½: patta');
    expect(decisionLabel('0-0', 'Anna', 'Bruno')).toBe('0-0: persa per entrambi');
  });
});

describe('0-0 in the standings', () => {
  const season = applyWithdrawals(decide(raw, 1, '0-0'), []);
  const { standings, crosstable } = computeStandings(players, season, {});
  const row = (h: string) => standings.find((s) => s.handle === h)!;

  it('is a game played and lost by both, with no points', () => {
    expect(row('carla')).toMatchObject({ played: 2, won: 0, drawn: 0, lost: 2, points: 0 });
    expect(row('dario')).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0 });
    expect(crosstable.carla.dario).toBe('0');
    expect(crosstable.dario.carla).toBe('0');
  });

  it('gives nothing to the Sonneborn-Berger, and leaves the others as they were', () => {
    expect(row('dario').sb).toBe(0);
    expect(row('anna')).toMatchObject({ points: 1, won: 1 });
    expect(row('anna').sb).toBe(0); // Carla, beaten by Anna, has no points
  });

  it('a decided win counts as a win, a decided draw as a draw', () => {
    const won = computeStandings(players, applyWithdrawals(decide(raw, 0, '0-1'), []), {}).standings;
    expect(won.find((s) => s.handle === 'bruno')).toMatchObject({ won: 1, points: 1 });
    const drawn = computeStandings(players, applyWithdrawals(decide(raw, 0, '½-½'), []), {}).standings;
    expect(drawn.find((s) => s.handle === 'anna')).toMatchObject({ drawn: 1, points: 1.5 });
  });
});

describe('decided results elsewhere', () => {
  const season = applyWithdrawals(decide(decide(raw, 1, '0-0'), 0, '1-0'), []);

  it('go to the archive with their result and status', () => {
    const archived = archivedGames(season, {});
    expect(archived.find((g) => g.white === 'carla')).toMatchObject({ result: '0-0', status: 'doubleLoss', end: AT });
    expect(archived.find((g) => g.white === 'anna' && g.black === 'bruno')).toMatchObject({ result: '1-0', status: 'decided' });
  });

  it('stay out of the Elo del torneo and the colpacci', () => {
    const elo = tournamentElo([], players.map((p) => p.handle), season, {});
    expect(elo.played.map((p) => `${p.game.white}-${p.game.black}`)).toEqual(['anna-carla']);
    expect(upsetFrom('0-0', { white: 1200, black: 2000, newcomer: false })).toBeNull();
  });

  it('count for the head-to-heads of always: 0-0 is a defeat for both, conceding nothing', () => {
    const games: ArchivedGame[] = [{ round: '1', white: 'carla', black: 'dario', result: '0-0', status: 'doubleLoss' }];
    const [h] = allTimeHeadToHead('carla', [{ season: 'S', games, current: true }]);
    expect(h).toMatchObject({ opponent: 'dario', won: 0, drawn: 0, lost: 1, scored: 0, conceded: 0 });
  });

  it('give the cronaca no event, but count for the leader', () => {
    const events = currentSeasonActivity({ season: 'S', players, history: season, gameStates: {} });
    expect(events.filter((e) => e.kind === 'result').map((e) => e.key)).toEqual([expect.stringContaining('cccccccc')]);
    // Anna leads with her two wins; nobody gets a point from the 0-0
    const lead = events.filter((e) => e.kind === 'leader');
    expect(JSON.stringify(lead.at(-1)?.parts)).toContain('anna');
  });

  it('show in the player page: 0-0 as a defeat that gives the opponent nothing', () => {
    const profile = computePlayerProfile('carla', players, season, {})!;
    const vsDario = profile.headToHead.find((h) => h.opponent === 'dario')!;
    expect(vsDario).toMatchObject({ outcomes: ['loss'], scored: 0, conceded: 0 });
    const drawn = computePlayerProfile('anna', players, applyWithdrawals(decide(raw, 0, '½-½'), []), {})!;
    expect(drawn.headToHead.find((h) => h.opponent === 'bruno')?.outcomes).toEqual(['draw']);
  });
});
