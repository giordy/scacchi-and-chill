import { describe, expect, it } from 'vitest';
import { isMonthKey, monthKey, monthLabel, pastSeasonPeriod, periodLabel, periodOfGames } from '../period';
import { HistoryGame, LichessExportGame } from '../../types';

const D = 86400e3;
const NOV = Date.UTC(2026, 10, 10, 12);
const g = (id: string, createdAt?: number, lichess?: Partial<LichessExportGame>): HistoryGame => ({
  round: '1',
  white: 'anna',
  black: 'bruno',
  url: `https://lichess.org/${id}`,
  createdAt,
  lichess: lichess ? ({ id, ...lichess } as LichessExportGame) : undefined,
});

describe('monthKey', () => {
  it('uses Italian time', () => {
    expect(monthKey(Date.UTC(2026, 9, 31, 23, 30))).toBe('2026-11'); // 00:30 on 1 November in Rome
    expect(monthKey(Date.UTC(2026, 0, 15))).toBe('2026-01');
  });
});

describe('periodOfGames', () => {
  it('starts with the first challenge and ends with the last move once every game is over', () => {
    const history = [
      g('a', NOV + 20 * D, { status: 'mate', winner: 'white', lastMoveAt: NOV + 30 * D }),
      g('b', NOV, { status: 'draw', lastMoveAt: NOV + 100 * D }),
    ];
    expect(periodOfGames(history)).toEqual({ start: '2026-11', end: '2027-02' });
  });

  it('has no end while a game is still to finish', () => {
    const history = [g('a', NOV, { status: 'mate', lastMoveAt: NOV + D }), g('b', NOV, { status: 'started' })];
    expect(periodOfGames(history)).toEqual({ start: '2026-11', end: undefined });
  });

  it('ignores aborted games for the end, and uses Lichess when the challenge time is missing', () => {
    const history = [
      g('a', undefined, { status: 'resign', winner: 'black', createdAt: NOV, lastMoveAt: NOV + 5 * D }),
      g('b', NOV, { status: 'aborted' }),
    ];
    expect(periodOfGames(history)).toEqual({ start: '2026-11', end: '2026-11' });
  });

  it('reads fresh states over the stored ones', () => {
    const history = [g('aaaaaaaa', NOV, { status: 'started' })];
    const fresh = { aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', lastMoveAt: NOV + 40 * D } as LichessExportGame };
    expect(periodOfGames(history, fresh).end).toBe('2026-12');
  });

  it('is empty without games', () => {
    expect(periodOfGames([])).toEqual({ start: undefined, end: undefined });
  });
});

describe('periodLabel', () => {
  it('writes the months short or long', () => {
    expect(monthLabel('2026-11')).toBe('nov 2026');
    expect(monthLabel('2027-03', true)).toBe('marzo 2027');
  });
  it('covers every combination', () => {
    expect(periodLabel({ start: '2026-11', end: '2027-03' })).toBe('nov 2026 – mar 2027');
    expect(periodLabel({ start: '2026-11', end: '2026-11' })).toBe('nov 2026');
    expect(periodLabel({ start: '2026-11' }, true)).toBe('da novembre 2026');
    expect(periodLabel({ end: '2027-03' })).toBe('fino a mar 2027');
    expect(periodLabel({})).toBe('');
  });
  it('ignores what is not a month', () => {
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
    expect(periodLabel({ start: 'novembre', end: '2027-03' })).toBe('fino a mar 2027');
  });
});

describe('pastSeasonPeriod', () => {
  const archive = { start: '2026-01', end: '2026-05', archivedAt: '2026-06-02T10:00:00Z' };

  it('prefers the period in the hall of fame, which the organizer can correct', () => {
    expect(pastSeasonPeriod({ start: '2025-12', end: '2026-05' }, archive)).toBe('dic 2025 – mag 2026');
  });

  it('falls back to the archive, then to the archive date as the end', () => {
    expect(pastSeasonPeriod({}, archive)).toBe('gen 2026 – mag 2026');
    expect(pastSeasonPeriod(undefined, { archivedAt: '2026-06-02T10:00:00Z' })).toBe('fino a giu 2026');
  });

  it('shows the year of older entries when nothing else is known', () => {
    expect(pastSeasonPeriod({ year: '2026' })).toBe('2026');
    expect(pastSeasonPeriod(undefined)).toBe('');
  });
});
