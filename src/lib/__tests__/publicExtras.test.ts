import { describe, expect, it } from 'vitest';
import { parseFenBoard } from '../fen';
import { mergeGameStates } from '../progress';
import { computePlayerProfile } from '../playerProfile';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
  { name: 'Carla', handle: 'carla' },
];
const g = (round: string, white: string, black: string, id: string): HistoryGame => ({
  round,
  white,
  black,
  url: `https://lichess.org/${id}`,
});
const st = (id: string, status: string, winner?: 'white' | 'black', lastMoveAt?: number): LichessExportGame => ({
  id,
  status,
  winner,
  lastMoveAt,
});

describe('parseFenBoard', () => {
  it('reads the starting position, rank 8 first', () => {
    const b = parseFenBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')!;
    expect(b).toHaveLength(8);
    expect(b[0].join('')).toBe('rnbqkbnr');
    expect(b[4][4]).toBe('P');
    expect(b[4].filter(Boolean)).toHaveLength(1);
  });

  it('rejects malformed placements', () => {
    expect(parseFenBoard('')).toBeNull();
    expect(parseFenBoard('8/8/8/8/8/8/8')).toBeNull();
    expect(parseFenBoard('9/8/8/8/8/8/8/8')).toBeNull();
    expect(parseFenBoard('7x/8/8/8/8/8/8/8')).toBeNull();
  });
});

describe('mergeGameStates', () => {
  it('lets live states replace only unfinished stored ones', () => {
    const stored = { a: st('a', 'started'), b: st('b', 'mate', 'white') };
    const live = { a: st('a', 'resign', 'black'), b: st('b', 'started'), c: st('c', 'started') };
    const merged = mergeGameStates(stored, live);
    expect(merged.a.winner).toBe('black');
    expect(merged.b.status).toBe('mate');
    expect(merged.c.status).toBe('started');
  });
});

describe('player page extras', () => {
  const history = [g('1', 'anna', 'bruno', 'x1x1x1x1'), g('2', 'carla', 'anna', 'x2x2x2x2'), g('3', 'bruno', 'anna', 'x3x3x3x3')];
  const states = { x1x1x1x1: st('x1x1x1x1', 'mate', 'white'), x2x2x2x2: st('x2x2x2x2', 'draw'), x3x3x3x3: st('x3x3x3x3', 'started') };
  const schedule: ScheduledMatch[] = [
    { round: '1', white: 'anna', black: 'bruno' },
    { round: '2', white: 'carla', black: 'anna' },
    { round: '3', white: 'bruno', black: 'anna' },
    { round: '4', white: 'anna', black: 'carla' },
  ];

  it('accumulates points round by round over finished games', () => {
    const p = computePlayerProfile('anna', players, history, states, schedule)!;
    expect(p.pointsByRound.map((r) => [r.round, r.points])).toEqual([
      ['1', 1],
      ['2', 1.5],
    ]);
  });

  it('summarizes the record against each opponent', () => {
    const p = computePlayerProfile('anna', players, history, states, schedule)!;
    expect(p.headToHead).toEqual([
      { opponent: 'bruno', outcomes: ['win', 'ongoing'], scored: 1, conceded: 0, upcoming: [] },
      { opponent: 'carla', outcomes: ['draw'], scored: 0.5, conceded: 0.5, upcoming: [{ round: '4', color: 'white' }] },
    ]);
  });

  it('lists aborted games as still to play, without a round', () => {
    const p = computePlayerProfile('anna', players, [g('1', 'anna', 'bruno', 'y1y1y1y1')], { y1y1y1y1: st('y1y1y1y1', 'aborted') })!;
    expect(p.headToHead[0]).toMatchObject({ opponent: 'bruno', outcomes: [], upcoming: [{}] });
    expect(p.headToHead[1]).toMatchObject({ opponent: 'carla', outcomes: [], upcoming: [] });
  });
});
