import { describe, expect, it } from 'vitest';
import { byRound, fullMovesOf, isVoid, movesText, nameFrom, plural, pliesOf, stateOf, storedStates } from '../games';
import { HistoryGame } from '../../types';

describe('game helpers', () => {
  it('orders rounds as numbers', () => {
    expect(['10', '2', '1'].sort(byRound)).toEqual(['1', '2', '10']);
  });
  it('reads the fresh state first, then the stored one', () => {
    const g: HistoryGame = { round: '1', white: 'a', black: 'b', url: 'https://lichess.org/abcdefgh', lichess: { id: 'abcdefgh', status: 'started' } };
    expect(stateOf(g, { abcdefgh: { id: 'abcdefgh', status: 'mate' } })?.status).toBe('mate');
    expect(stateOf(g, {})?.status).toBe('started');
    const forfeit: HistoryGame = { round: '1', white: 'a', black: 'b', url: '', lichess: { id: '', status: 'forfeit' } };
    expect(stateOf(forfeit, {})?.status).toBe('forfeit');
    expect(storedStates([g, forfeit])).toEqual({ abcdefgh: g.lichess });
  });
  it('counts moves', () => {
    expect(pliesOf({ id: 'x', status: 'started', moves: ' e4 e5  Nf3 ' })).toBe(3);
    expect(pliesOf({ id: 'x', status: 'started' })).toBe(0);
    expect(fullMovesOf({ id: 'x', status: 'mate', moves: 'e4 e5 Nf3' })).toBe(2);
    expect(movesText(1)).toBe('1 mossa');
    expect(movesText(34)).toBe('34 mosse');
    expect(plural(1, 'colpaccio', 'colpacci')).toBe('1 colpaccio');
  });
  it('tells games that did not take place', () => {
    expect(isVoid({ id: 'x', status: 'aborted' })).toBe(true);
    expect(isVoid({ id: 'x', status: 'noStart' })).toBe(true);
    expect(isVoid({ id: 'x', status: 'resign' })).toBe(false);
    expect(isVoid(undefined)).toBe(false);
  });
  it('names players, falling back to the handle', () => {
    const nameOf = nameFrom([{ handle: 'anna', name: 'Anna' }]);
    expect(nameOf('anna')).toBe('Anna');
    expect(nameOf('zeta')).toBe('zeta');
  });
});
