import { describe, expect, it } from 'vitest';
import { canRelink, checkOwnGame, linkState, relinkMessage } from '../relink';
import { buildBulletin } from '../bulletin';
import { defaultConfig } from '../config';
import { HistoryGame, LichessExportGame } from '../../types';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 10, 12);
const game = (createdAt?: number): HistoryGame => ({ round: '3', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', createdAt });
const state = (status: string, white = 'anna', black = 'bruno'): LichessExportGame => ({
  id: 'bbbbbbbb',
  status,
  players: { white: { user: { id: white, name: white } }, black: { user: { id: black, name: black } } },
});

describe('linkState', () => {
  it('tells a waiting challenge from an expired one', () => {
    expect(linkState(game(now - DAY), undefined, 2, now)).toEqual({ kind: 'waiting', expiresAt: now + DAY });
    expect(linkState(game(now - 3 * DAY), undefined, 2, now)).toEqual({ kind: 'expired', expiredAt: now - DAY });
    expect(linkState(game(), undefined, 2, now).kind).toBe('waiting');
  });

  it('lets replace an aborted game, never an accepted one', () => {
    expect(linkState(game(now), state('aborted'), 2, now)).toEqual({ kind: 'void' });
    expect(linkState(game(now), state('noStart'), 2, now)).toEqual({ kind: 'void' });
    const playing = linkState(game(now - 9 * DAY), state('started'), 2, now);
    expect(playing).toEqual({ kind: 'playing' });
    expect(canRelink(playing)).toBe(false);
    expect(canRelink({ kind: 'expired', expiredAt: 0 })).toBe(true);
  });
});

describe('checkOwnGame (a game the players created themselves)', () => {
  it('accepts the two players, taking the Lichess colors when swapped', () => {
    expect(checkOwnGame(state('started', 'Anna', 'Bruno'), 'anna', 'bruno')).toEqual({ white: 'anna', black: 'bruno', swapped: false });
    expect(checkOwnGame(state('started', 'bruno', 'anna'), 'anna', 'bruno')).toEqual({ white: 'bruno', black: 'anna', swapped: true });
  });
  it('refuses a game between other players', () => {
    expect(checkOwnGame(state('started', 'anna', 'carla'), 'anna', 'bruno')).toEqual({
      error: 'Su Lichess la partita è tra @anna e @carla, non tra i due giocatori di questo turno.',
    });
  });
});

describe('relinkMessage', () => {
  it('gives the new link, with its deadline when known', () => {
    const text = relinkMessage('3', 'Anna', 'Bruno', 'https://lichess.org/cccccccc', now);
    expect(text).toContain('🔁 *Turno 3*: nuovo link per *Anna* ⚪ vs *Bruno* ⚫\nhttps://lichess.org/cccccccc');
    expect(text).toContain('Da accettare entro');
    expect(relinkMessage('3', 'Anna', 'Bruno', 'u')).not.toContain('Da accettare');
  });
});

describe('bulletin with a recreated link', () => {
  it('counts the deadline of each challenge: a recreated one is not expired', () => {
    const config = { ...defaultConfig, players: [{ handle: 'anna', name: 'Anna' }, { handle: 'bruno', name: 'Bruno' }, { handle: 'carla', name: 'Carla' }, { handle: 'dario', name: 'Dario' }] };
    const old: HistoryGame = { round: '3', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', createdAt: now - 5 * DAY };
    const recreated: HistoryGame = { round: '3', white: 'carla', black: 'dario', url: 'https://lichess.org/cccccccc', createdAt: now - DAY };
    const b = buildBulletin({ round: '3', games: [old, recreated], states: {}, history: [old, recreated], config, expiryDays: 2, now, random: () => 0 });
    const text = typeof b === 'string' ? b : (b as { text: string }).text ?? JSON.stringify(b);
    expect(text).toContain('Link scaduto: la sfida va ricreata');
    expect(text).toMatch(/Da accettare entro [^\n]*Carla–Dario/);
    expect(text).not.toMatch(/Da accettare entro [^\n]*Anna–Bruno/);
  });
});
