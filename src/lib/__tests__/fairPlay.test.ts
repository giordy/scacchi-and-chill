import { describe, expect, it } from 'vitest';
import { AWARDS_BAN_RULE, cheatCases, outForFairPlay, withAwardsBanRule } from '../fairPlay';
import { applyWithdrawals } from '../withdrawals';
import { buildSeasonArchive } from '../seasons';
import { currentSeasonActivity, archivedSeasonActivity } from '../activity';
import { Withdrawal } from '../../types';
import { DEFAULT_TOURNAMENT } from '../tournament';
import { HistoryGame, LichessExportGame } from '../../types';

const g = (round: string, white: string, black: string, id: string): HistoryGame => ({ round, white, black, url: `https://lichess.org/${id}` });

describe('cheatCases', () => {
  it('finds the player at fault (the loser) and counts the repeats', () => {
    const history = [g('3', 'carla', 'bruno', 'cccccccc'), g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'bruno', 'dario', 'bbbbbbbb')];
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'white' }, // Bruno at fault
      bbbbbbbb: { id: 'bbbbbbbb', status: 'resign', winner: 'white' },
      cccccccc: { id: 'cccccccc', status: 'cheat', winner: 'white' }, // Bruno again
    };
    expect(cheatCases(history, states).map((c) => [c.round, c.handle, c.opponent, c.count])).toEqual([
      ['1', 'bruno', 'anna', 1],
      ['3', 'bruno', 'carla', 2],
    ]);
  });
  it('reads the stored state when there is no fresh one', () => {
    const game = { ...g('1', 'matepaco', 'frasal', 'n8dWafTV'), lichess: { id: 'n8dWafTV', status: 'cheat', winner: 'white' as const } };
    expect(cheatCases([game], {})[0]).toMatchObject({ handle: 'frasal', count: 1 });
  });
});

describe('out of the Trofeo Pillsbury and the awards for fair play', () => {
  const history = [g('1', 'anna', 'Bruno', 'aaaaaaaa')];
  const states: Record<string, LichessExportGame> = { aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'white' } };
  it('only once the rule applies, from the season after the one it was decided in', () => {
    expect([...outForFairPlay(undefined, history, states)]).toEqual([]);
    expect([...outForFairPlay(false, history, states)]).toEqual([]);
    expect([...outForFairPlay(true, history, states)]).toEqual(['bruno']);
  });
});

describe('a replacement: the fault stays with who played the game on Lichess', () => {
  // Bruno is replaced by Zeno after round 1: the calendar (with the withdrawal applied) gives Zeno
  // Bruno's games, and Bruno the ones after him nowhere
  const replaced: Withdrawal[] = [{ handle: 'bruno', name: 'Bruno', at: '2026-01-10', played: 1, total: 3, mode: 'replaced', replacedBy: { handle: 'zeno', name: 'Zeno' } }];
  const onLichess = (white: string, black: string): LichessExportGame['players'] => ({ white: { user: { id: white } }, black: { user: { id: black } } });
  it('who left cheated: the substitute keeps every trophy', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'zeno', 'carla', 'bbbbbbbb')];
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'white', players: onLichess('anna', 'bruno') },
      bbbbbbbb: { id: 'bbbbbbbb', status: 'started', players: onLichess('zeno', 'carla') },
    };
    const seen = applyWithdrawals(history, replaced);
    expect(seen[0].black).toBe('zeno'); // the place is Zeno's in the standings...
    expect([...outForFairPlay(true, seen, states)]).toEqual(['bruno']); // ...the fault is Bruno's
    expect(cheatCases(seen, states)[0]).toMatchObject({ handle: 'bruno', opponent: 'anna' });
  });
  it('the substitute cheated: the fault is theirs, never of who left', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'zeno', 'carla', 'bbbbbbbb')];
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white', players: onLichess('anna', 'bruno') },
      bbbbbbbb: { id: 'bbbbbbbb', status: 'cheat', winner: 'black', players: onLichess('zeno', 'carla') },
    };
    expect([...outForFairPlay(true, applyWithdrawals(history, replaced), states)]).toEqual(['zeno']);
  });
  it('counts the repeats of a player whatever the case of the handle', () => {
    const history = [g('1', 'anna', 'Bruno', 'aaaaaaaa'), g('2', 'bruno', 'carla', 'bbbbbbbb')];
    const states: Record<string, LichessExportGame> = {
      aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'white', players: onLichess('anna', 'bruno') },
      bbbbbbbb: { id: 'bbbbbbbb', status: 'cheat', winner: 'black', players: onLichess('bruno', 'carla') },
    };
    expect(cheatCases(history, states).map((c) => [c.handle, c.count])).toEqual([['Bruno', 1], ['bruno', 2]]);
  });
});

describe('several games closed for cheating', () => {
  const on = (white: string, black: string) => ({ white: { user: { id: white } }, black: { user: { id: black } } });
  // Round 1: Anna and Dario cheat; round 2: Carla and Anna (her second time)
  const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('1', 'carla', 'dario', 'bbbbbbbb'), g('2', 'bruno', 'carla', 'cccccccc'), g('2', 'dario', 'anna', 'dddddddd')];
  const states: Record<string, LichessExportGame> = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'cheat', winner: 'black', players: on('anna', 'bruno'), lastMoveAt: 1 },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'cheat', winner: 'white', players: on('carla', 'dario'), lastMoveAt: 2 },
    cccccccc: { id: 'cccccccc', status: 'cheat', winner: 'white', players: on('bruno', 'carla'), lastMoveAt: 3 },
    dddddddd: { id: 'dddddddd', status: 'cheat', winner: 'white', players: on('dario', 'anna'), lastMoveAt: 4 },
  };
  const players = ['anna', 'bruno', 'carla', 'dario'].map((h) => ({ handle: h, name: h }));

  it('count each player apart, in round order, and put all of them out', () => {
    expect(cheatCases(history, states).map((c) => [c.handle, c.count])).toEqual([['anna', 1], ['dario', 1], ['carla', 1], ['anna', 2]]);
    expect([...outForFairPlay(true, history, states)]).toEqual(['anna', 'dario', 'carla']);
  });

  it('leave the Scudetto to the only one who can win it, and no awards from those games', () => {
    const archive = buildSeasonArchive({ title: 'T', season: 'S', description: '', fairPlayAwardsBan: true }, players, history, states);
    expect(archive.champion?.handle).toBe('bruno');
    expect(archive.noTrophies).toEqual(['anna', 'dario', 'carla']);
    expect(archive.awards ?? []).toEqual([]);
  });

  it('are not told in the cronaca: no result, first win or streak from them, only the standings they make', () => {
    const events = currentSeasonActivity({ season: 'S', players, history, gameStates: states, fairPlayBan: true });
    expect(events.filter((e) => ['result', 'firstWin', 'streak'].includes(e.kind))).toEqual([]);
    // The end of the season still says who wins it
    expect(events.find((e) => e.kind === 'end')?.parts).toContainEqual({ handle: 'bruno' });
    const archive = buildSeasonArchive({ title: 'T', season: 'S', description: '', fairPlayAwardsBan: true }, players, history, states);
    expect(archivedSeasonActivity(archive).filter((e) => e.kind === 'result')).toEqual([]);
  });

  it('once a player is excluded (every game annulled), the others are counted as before', () => {
    const excluded: Withdrawal[] = [{ handle: 'anna', name: 'Anna', at: '2026-01-05', played: 2, total: 3, mode: 'annulled' }];
    const left = applyWithdrawals(history, excluded);
    expect(cheatCases(left, states).map((c) => [c.handle, c.count])).toEqual([['dario', 1], ['carla', 1]]);
    expect([...outForFairPlay(true, left, states)]).toEqual(['dario', 'carla']);
  });
});

describe('withAwardsBanRule', () => {
  const old = DEFAULT_TOURNAMENT.fairPlayText!.replace(` ${AWARDS_BAN_RULE}`, '');
  it('puts the sentence after the penalty of a first time, once', () => {
    const next = withAwardsBanRule(old);
    expect(next).toBe(DEFAULT_TOURNAMENT.fairPlayText);
    expect(next).toContain(`perde la partita e i punti del turno. ${AWARDS_BAN_RULE} Alla seconda volta`);
    expect(withAwardsBanRule(next)).toBe(next);
  });
  it('adds it at the end of rules written otherwise, and leaves empty rules empty', () => {
    expect(withAwardsBanRule('• Niente motori.')).toBe(`• Niente motori.\n• ${AWARDS_BAN_RULE}`);
    expect(withAwardsBanRule('')).toBe('');
  });
});
