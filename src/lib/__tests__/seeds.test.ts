import { describe, expect, it } from 'vitest';
import { computeSeed, firstGames, reliableRatingsAt, seedDate, seedsToFix } from '../seeds';
import { HistoryGame, LichessExportGame } from '../../types';

// A Lichess rating history: `days` days of rated games of a kind, one a day up to `last`, ending at `rating`
const kind = (name: string, rating: number, days = 12, last = '2026-09-01') =>
  ({
    name,
    points: Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.parse(last) - (days - 1 - i) * 86400000);
      return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), i === days - 1 ? rating : rating - 50];
    }),
  });

describe('seedDate', () => {
  it('is 30 days before the first game', () => {
    expect(seedDate(Date.parse('2026-10-08T15:00:00Z'))).toBe('2026-09-08');
  });
});

describe('reliableRatingsAt', () => {
  it('takes the last rating up to the day, of the kinds with at least 10 days of rated games', () => {
    const history = [kind('Rapid', 1720), kind('Classical', 1800, 9), kind('Blitz', 1500), kind('Correspondence', 1900, 60, '2026-10-20')];
    // Correspondence: the days after 2026-09-08 do not count
    expect(reliableRatingsAt(history, '2026-09-08')).toEqual({ rapid: 1720, correspondence: 1850 });
  });

  it('leaves out a rating whose last game is more than a year old, and anything unreadable', () => {
    expect(reliableRatingsAt([kind('Rapid', 1720, 12, '2025-06-01')], '2026-09-08')).toEqual({});
    expect(reliableRatingsAt(null, '2026-09-08')).toEqual({});
    expect(reliableRatingsAt([{ name: 'Rapid', points: 'x' }, 7], '2026-09-08')).toEqual({});
  });
});

describe('computeSeed', () => {
  const date = '2026-09-08';
  // Regulars: Elo del torneo at the start of the season
  const regulars = new Map([['anna', 1600], ['bruno', 1500], ['carla', 1400]]);

  it('moves the Lichess rating onto the scale of the regulars', () => {
    const histories = new Map<string, unknown>([
      ['anna', [kind('Rapid', 1900)]],
      ['bruno', [kind('Rapid', 1800)]],
      ['carla', [kind('Rapid', 1700)]],
      ['dario', [kind('Rapid', 1850)]],
    ]);
    // Regulars: 1500 on average here, 1800 on Lichess: −300
    expect(computeSeed('Dario', date, regulars, histories)).toEqual({ handle: 'Dario', rating: 1550, date, perf: 'rapid', lichess: 1850, offset: -300 });
  });

  it('takes the first kind that is reliable for the player and for at least 3 regulars', () => {
    const histories = new Map<string, unknown>([
      // Correspondence reliable for 2 regulars only: skipped; classical for all
      ['anna', [kind('Correspondence', 2000), kind('Classical', 1700)]],
      ['bruno', [kind('Correspondence', 1900), kind('Classical', 1650)]],
      ['carla', [kind('Classical', 1600)]],
      ['dario', [kind('Correspondence', 2100), kind('Classical', 1750), kind('Rapid', 1500)]],
    ]);
    expect(computeSeed('dario', date, regulars, histories)).toMatchObject({ perf: 'classical', lichess: 1750, offset: -150, rating: 1600 });
  });

  it('gives no rating without a reliable one, or with fewer than 3 regulars to set the scale', () => {
    const histories = new Map<string, unknown>([
      ['anna', [kind('Rapid', 1900)]],
      ['bruno', [kind('Rapid', 1800)]],
      ['dario', [kind('Rapid', 1850), kind('Blitz', 1700)]],
      ['elena', [kind('Rapid', 1850, 5)]],
    ]);
    expect(computeSeed('dario', date, regulars, histories)).toEqual({ handle: 'dario', rating: null, date });
    expect(computeSeed('elena', date, regulars, histories)).toEqual({ handle: 'elena', rating: null, date });
    expect(computeSeed('nobody', date, regulars, histories)).toEqual({ handle: 'nobody', rating: null, date });
  });
});

describe('which seeds to fix', () => {
  const players = ['anna', 'dario', 'elena', 'fabio'];
  const history: HistoryGame[] = [
    { round: '1', white: 'anna', black: 'dario', url: 'https://lichess.org/aaaaaaaa', createdAt: Date.parse('2026-11-01') },
    { round: '2', white: 'dario', black: 'elena', url: 'https://lichess.org/bbbbbbbb' },
    { round: '3', white: 'fabio', black: 'anna', url: '' }, // not created yet
  ];
  const states: Record<string, LichessExportGame> = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'started', createdAt: Date.parse('2026-10-08T10:00:00Z') },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'created', createdAt: Date.parse('2026-10-22T10:00:00Z') },
  };

  it('dates each player from their first challenge on Lichess', () => {
    const first = firstGames(history, states, players);
    expect(first.get('dario')).toBe(Date.parse('2026-10-08T10:00:00Z')); // the challenge, not the saved link
    expect(first.get('elena')).toBe(Date.parse('2026-10-22T10:00:00Z'));
    expect(first.has('fabio')).toBe(false);
  });

  it('fixes those in their first season with a game and no seed yet, once', () => {
    const first = firstGames(history, states, players);
    const firstSeason = new Set(['dario', 'elena', 'fabio']);
    expect(seedsToFix(firstSeason, undefined, first)).toEqual([
      { handle: 'dario', date: '2026-09-08' },
      { handle: 'elena', date: '2026-09-22' },
    ]);
    // A seed without a rating is fixed too: never computed again
    expect(seedsToFix(firstSeason, [{ handle: 'Dario', rating: null, date: '2026-09-08' }], first)).toEqual([{ handle: 'elena', date: '2026-09-22' }]);
  });
});
