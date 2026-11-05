import { describe, expect, it } from 'vitest';
import { gamePhase, movesLabel } from '../phase';
import { LichessExportGame } from '../../types';

const game = (plies: number, division?: LichessExportGame['division']): LichessExportGame => ({
  id: 'x',
  status: 'started',
  moves: Array.from({ length: plies }, () => 'e4').join(' '),
  division,
});

describe('gamePhase', () => {
  it('is unknown when Lichess sends no division', () => {
    expect(gamePhase(game(30))).toBeUndefined();
  });
  it('follows the plies where middlegame and endgame begin', () => {
    expect(gamePhase(game(12, {}))).toBe('opening');
    expect(gamePhase(game(12, { middle: 20 }))).toBe('opening');
    expect(gamePhase(game(25, { middle: 20 }))).toBe('middlegame');
    expect(gamePhase(game(70, { middle: 20, end: 60 }))).toBe('endgame');
  });
});

describe('movesLabel', () => {
  it('is exact for finished games and approximate for ongoing ones', () => {
    expect(movesLabel(game(67), true)).toBe('34 mosse');
    expect(movesLabel(game(1), true)).toBe('1 mossa');
    expect(movesLabel(game(45), false)).toBe('più di 20 mosse');
    expect(movesLabel(game(0), false)).toBe('');
  });
});
