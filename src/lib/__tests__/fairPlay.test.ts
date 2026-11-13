import { describe, expect, it } from 'vitest';
import { AWARDS_BAN_RULE, cheatCases, outForFairPlay, withAwardsBanRule } from '../fairPlay';
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
