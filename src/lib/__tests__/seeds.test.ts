import { describe, expect, it } from 'vitest';
import { computeSeed, firstGames, historySummary, reliableRatingsAt, seedDate, seedsToFix } from '../seeds';
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
    const history = [kind('Rapid', 1720), kind('Classical', 1800, 9), kind('Blitz', 1500), kind('Bullet', 1450), kind('Correspondence', 1900, 60, '2026-10-20')];
    // Correspondence: the days after 2026-09-08 do not count; bullet is never taken
    expect(reliableRatingsAt(history, '2026-09-08')).toEqual({ rapid: 1720, blitz: 1500, correspondence: 1850 });
  });

  it('leaves out a rating that stayed flat for years, as Lichess draws one without games', () => {
    // A rapid rating from 2021 and a blitz played every day: as Francesco Sal and Alessandro
    const history = [kind('Rapid', 1780, 12, '2021-05-01'), kind('Blitz', 1490, 200, '2026-09-07')];
    expect(reliableRatingsAt(history, '2026-09-08')).toEqual({ blitz: 1490 });
  });

  it('leaves out a rating whose last game is more than a year old, and anything unreadable', () => {
    expect(reliableRatingsAt([kind('Rapid', 1720, 12, '2025-06-01')], '2026-09-08')).toEqual({});
    expect(reliableRatingsAt(null, '2026-09-08')).toEqual({});
    expect(reliableRatingsAt([{ name: 'Rapid', points: 'x' }, 7], '2026-09-08')).toEqual({});
  });
});

describe('a real Lichess rating history', () => {
  // Alessandro (drake097), the last 12 days of each kind up to 2026-09-09, as Lichess sends it: names
  // in lower case ("blitz", "rapid"...), points [year, month from 0, day, rating]
  const drake097 = [{"name": "ultraBullet", "points": []}, {"name": "bullet", "points": [[2026, 7, 17, 1764], [2026, 7, 18, 1757], [2026, 7, 19, 1765], [2026, 7, 21, 1770], [2026, 7, 24, 1776], [2026, 7, 25, 1768], [2026, 7, 26, 1759], [2026, 7, 27, 1764], [2026, 7, 28, 1772], [2026, 7, 30, 1778], [2026, 8, 1, 1777], [2026, 8, 7, 1780]]}, {"name": "blitz", "points": [[2026, 7, 14, 1871], [2026, 7, 15, 1842], [2026, 7, 17, 1846], [2026, 7, 18, 1843], [2026, 7, 19, 1832], [2026, 7, 28, 1838], [2026, 7, 30, 1831], [2026, 8, 2, 1838], [2026, 8, 6, 1837], [2026, 8, 7, 1803], [2026, 8, 8, 1809], [2026, 8, 9, 1822]]}, {"name": "rapid", "points": [[2025, 5, 29, 1877], [2025, 6, 15, 1905], [2025, 7, 2, 1921], [2025, 7, 10, 1937], [2025, 10, 2, 1930], [2025, 10, 6, 1927], [2025, 10, 29, 1945], [2026, 2, 28, 1939], [2026, 3, 8, 1921], [2026, 3, 16, 1903], [2026, 3, 23, 1908], [2026, 7, 28, 1903]]}, {"name": "classical", "points": [[2017, 11, 5, 1761], [2017, 11, 6, 1750], [2017, 11, 9, 1738], [2017, 11, 20, 1755], [2018, 0, 15, 1746], [2018, 1, 3, 1754], [2018, 5, 17, 1752], [2018, 11, 9, 1760], [2018, 11, 25, 1775], [2019, 6, 7, 1762], [2019, 7, 4, 1746], [2020, 2, 14, 1773]]}, {"name": "correspondence", "points": [[2017, 1, 11, 1566], [2017, 1, 19, 1418], [2017, 1, 25, 1551], [2017, 2, 21, 1448]]}, {"name": "puzzle", "points": [[2026, 7, 27, 2179], [2026, 7, 28, 2203], [2026, 7, 30, 2256], [2026, 7, 31, 2326], [2026, 8, 1, 2332], [2026, 8, 2, 2287], [2026, 8, 3, 2238], [2026, 8, 4, 2250], [2026, 8, 5, 2269], [2026, 8, 7, 2301], [2026, 8, 8, 2331], [2026, 8, 9, 2306]]}];

  it('is read with its lower-case names', () => {
    // Rapid: last game 2026-08-28 at 1903; classical: last in 2020, too old; correspondence: 2017
    expect(reliableRatingsAt(drake097, '2026-09-09')).toEqual({ rapid: 1903, blitz: 1822 });
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
    expect(computeSeed('Dario', date, regulars, histories)).toEqual({
      handle: 'Dario', rating: 1550, date, perf: 'rapid', lichess: 1850, offset: -300,
      // What it came from, kept to check it
      ratings: { rapid: 1850 },
      regulars: [
        { handle: 'anna', elo: 1600, ratings: { rapid: 1900 } },
        { handle: 'bruno', elo: 1500, ratings: { rapid: 1800 } },
        { handle: 'carla', elo: 1400, ratings: { rapid: 1700 } },
      ],
    });
  });

  it('falls back on blitz, set on the blitz of the regulars', () => {
    const histories = new Map<string, unknown>([
      ['anna', [kind('Blitz', 1800)]],
      ['bruno', [kind('Blitz', 1700)]],
      ['carla', [kind('Blitz', 1600)]],
      ['dario', [kind('Rapid', 1880, 12, '2018-03-01'), kind('Blitz', 1803), kind('Bullet', 1782)]],
    ]);
    expect(computeSeed('dario', date, regulars, histories)).toMatchObject({ perf: 'blitz', lichess: 1803, offset: -200, rating: 1603 });
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
    // Says why, for the organizer: each kind of the player's that was skipped, and how many regulars had it
    expect(computeSeed('dario', date, regulars, histories)).toMatchObject({
      handle: 'dario',
      rating: null,
      date,
      reason:
        "Elo rapid 1850 affidabile, ma solo 2 veterani con l'Elo rapid affidabile a quella data (ne servono 3); " +
        "Elo blitz 1700 affidabile, ma nessun veterano con l'Elo blitz affidabile a quella data (ne servono 3)",
    });
    const none = "nessun Elo Lichess affidabile (servono almeno 10 giorni con partite valutate dello stesso tipo, l'ultima entro un anno; il bullet non conta); ";
    // ...and what the history held, to see why
    expect(computeSeed('elena', date, regulars, histories)).toMatchObject({ handle: 'elena', rating: null, date, reason: none + 'nello storico: rapid 5 giorni, ultimo 2026-09-01', ratings: {} });
    expect(computeSeed('nobody', date, regulars, histories)).toMatchObject({ handle: 'nobody', rating: null, date, reason: none + 'storico Lichess non leggibile (undefined)' });
  });

  it('says what a history held when it has none of the kinds, or is not one', () => {
    expect(historySummary([{ name: 'Bullet', points: [] }, { name: 'Puzzles', points: [] }], date)).toBe('nello storico solo: Bullet, Puzzles');
    expect(historySummary([], date)).toBe('storico Lichess vuoto');
    expect(historySummary({ error: 'x' }, date)).toBe('storico Lichess non leggibile (object)');
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
      { handle: 'dario', date: '2026-09-08', retry: false },
      { handle: 'elena', date: '2026-09-22', retry: false },
    ]);
    // A seed with a rating is fixed once
    const fixed = { handle: 'Dario', rating: 1600, date: '2026-09-08', regulars: [] };
    expect(seedsToFix(firstSeason, [fixed], first)).toEqual([{ handle: 'elena', date: '2026-09-22', retry: false }]);
    // ...but computed once more when saved before its regulars were kept, to keep them
    expect(seedsToFix(firstSeason, [{ ...fixed, regulars: undefined }], first)).toEqual([
      { handle: 'dario', date: '2026-09-08', retry: true },
      { handle: 'elena', date: '2026-09-22', retry: false },
    ]);
  });

  it('tries a seed without a rating again, on the day it was dated', () => {
    const first = firstGames(history, states, players);
    const seeds = [{ handle: 'Dario', rating: null, date: '2026-09-01' }];
    expect(seedsToFix(new Set(['dario']), seeds, first)).toEqual([{ handle: 'dario', date: '2026-09-01', retry: true }]);
  });
});
