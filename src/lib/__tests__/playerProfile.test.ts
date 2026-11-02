import { describe, expect, it } from 'vitest';
import { computePlayerProfile } from '../playerProfile';
import { parsePlayerHash, playerHref, isAdminLocation } from '../routes';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
  { name: 'Carla', handle: 'carla' },
  { name: 'Dario', handle: 'dario' },
];
const g = (round: string, white: string, black: string, id: string): HistoryGame => ({
  round,
  white,
  black,
  url: `https://lichess.org/${id}`,
});
const st = (id: string, status: string, winner?: 'white' | 'black'): LichessExportGame => ({ id, status, winner });

describe('computePlayerProfile', () => {
  it('returns null for an unknown handle and matches case-insensitively', () => {
    expect(computePlayerProfile('nobody', players, [], {})).toBeNull();
    expect(computePlayerProfile('ANNA', players, [], {})?.player.handle).toBe('anna');
  });

  it('describes games from the player point of view', () => {
    const history = [
      g('2', 'bruno', 'anna', 'bbbbbbbb'),
      g('1', 'anna', 'carla', 'aaaaaaaa'),
      g('3', 'anna', 'dario', 'cccccccc'),
    ];
    const gs = {
      aaaaaaaa: st('aaaaaaaa', 'mate', 'white'),
      bbbbbbbb: st('bbbbbbbb', 'resign', 'white'),
      cccccccc: st('cccccccc', 'started'),
    };
    const p = computePlayerProfile('anna', players, history, gs)!;
    expect(p.games.map((x) => [x.round, x.opponent, x.color, x.outcome])).toEqual([
      ['1', 'carla', 'white', 'win'],
      ['2', 'bruno', 'black', 'loss'],
      ['3', 'dario', 'white', 'ongoing'],
    ]);
    expect(p.standing).toMatchObject({ points: 1, won: 1, lost: 1 });
    expect(p.rank).toBeGreaterThanOrEqual(1);
  });

  it('marks a draw and a game without Lichess state', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'anna', 'carla', 'bbbbbbbb')];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'draw') })!;
    expect(p.games.map((x) => x.outcome)).toEqual(['draw', 'pending']);
  });

  it('lists opponents not met yet, scheduled ones first with round and color', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa')];
    const schedule: ScheduledMatch[] = [
      { round: '3', white: 'dario', black: 'anna' },
      { round: '2', white: 'anna', black: 'carla' },
      { round: '1', white: 'anna', black: 'bruno' },
    ];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'mate', 'white') }, schedule)!;
    expect(p.remaining).toEqual([
      { opponent: 'carla', round: '2', color: 'white' },
      { opponent: 'dario', round: '3', color: 'black' },
    ]);
  });

  it('includes unscheduled opponents and counts aborted games as still to play', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa')];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'aborted') })!;
    expect(p.games).toEqual([]);
    expect(p.remaining.map((r) => r.opponent)).toEqual(['bruno', 'carla', 'dario']);
  });
});

describe('routes', () => {
  it('builds and parses player hashes', () => {
    expect(playerHref('marco_chess')).toBe('#/giocatore/marco_chess');
    expect(parsePlayerHash('#/giocatore/marco_chess')).toBe('marco_chess');
    expect(parsePlayerHash(playerHref('a b'))).toBe('a b');
  });

  it('ignores other hashes and malformed input', () => {
    expect(parsePlayerHash('')).toBeNull();
    expect(parsePlayerHash('#admin')).toBeNull();
    expect(parsePlayerHash('#/giocatore/')).toBeNull();
    expect(parsePlayerHash('#/giocatore/%E0%A4%A')).toBeNull();
  });

  it('does not treat a player page of an "admin" handle as the admin area', () => {
    expect(isAdminLocation('#admin', '')).toBe(true);
    expect(isAdminLocation('', '?admin')).toBe(true);
    expect(isAdminLocation('#/giocatore/administrator', '')).toBe(false);
  });
});
