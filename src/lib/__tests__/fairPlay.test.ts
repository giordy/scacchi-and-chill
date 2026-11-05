import { describe, expect, it } from 'vitest';
import { cheatCases } from '../fairPlay';
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
