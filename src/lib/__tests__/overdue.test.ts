import { describe, expect, it } from 'vitest';
import { overdueDaysOf, overdueGames } from '../overdue';
import { roundEndFrom } from '../roundDeadline';
import { HistoryGame, LichessExportGame } from '../../types';
// @ts-expect-error a Node script without types
import { overdueNotification, overdueOf, roundEndFrom as scriptRoundEndFrom } from '../../../scripts/push.mjs';
// @ts-expect-error a Node script without types
import { syncTargets } from '../../../scripts/sync-results.mjs';
import { extractGameId } from '../utils';

const url = (id: string) => `https://lichess.org/${id}`;
// Round 3 started on Monday 23 November 2026, 21:00 in Italy; with 21 days the limit is the end of
// Monday 14 December
const START = Date.UTC(2026, 10, 23, 20);
const LIMIT = Date.UTC(2026, 11, 14, 23);
const game = (white: string, black: string, id: string, status?: string, extra: Partial<HistoryGame> = {}): HistoryGame => ({
  round: '3',
  white,
  black,
  url: url(id),
  createdAt: START + (id === 'aaaaaaaa' ? 0 : 3600e3), // the round starts with its first challenge
  ...(status ? { lichess: { id, status } as LichessExportGame } : {}),
  ...extra,
});
const history = [
  game('anna', 'bruno', 'aaaaaaaa', 'started'),
  game('carla', 'dario', 'bbbbbbbb'), // never accepted
  game('elena', 'fabio', 'cccccccc', 'mate'),
  game('gino', 'ugo', 'dddddddd', 'started', { decision: { result: '0-0', at: 1 } }),
];
const on = { overdueDays: 21 };

describe('games past the days allowed', () => {
  it('is off until a number of days is set', () => {
    expect(overdueDaysOf(undefined)).toBe(0);
    expect(overdueDaysOf({ overdueDays: 0 })).toBe(0);
    expect(overdueGames({}, history, {}, LIMIT + 1)).toEqual([]);
  });

  it('lists the games not over, from the end of the last day allowed', () => {
    expect(overdueGames(on, history, {}, LIMIT - 1)).toEqual([]);
    const late = overdueGames(on, history, {}, LIMIT);
    // the finished game and the one decided by the organizer are not; the challenge never accepted is
    expect(late.map((o) => o.game.url)).toEqual([url('aaaaaaaa'), url('bbbbbbbb')]);
    expect(late.every((o) => o.limit === LIMIT)).toBe(true);
    expect(roundEndFrom(START, 21)).toBe(LIMIT);
  });

  it('follows the fresh state from Lichess, and needs a challenge created', () => {
    const ended = { aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'white' } as LichessExportGame };
    expect(overdueGames(on, history, ended, LIMIT).map((o) => o.game.url)).toEqual([url('bbbbbbbb')]);
    expect(overdueGames(on, [{ round: '4', white: 'anna', black: 'carla', url: '' }], {}, LIMIT * 2)).toEqual([]);
  });
});

describe('the GitHub Action, for the games past the days allowed', () => {
  it('finds the same games as the organizer area', () => {
    const script = overdueOf({ season: 'S', ...on }, history, {}, LIMIT, extractGameId);
    const site = overdueGames(on, history, {}, LIMIT);
    expect(script.map((o: { white: string; black: string; limit: number }) => [o.white, o.black, o.limit])).toEqual(site.map((o) => [o.game.white, o.game.black, o.limit]));
    expect(script[0].key).toBe(`ritardo|S|3|anna|bruno|${LIMIT}`);
    expect(overdueOf({ season: 'S' }, history, {}, LIMIT, extractGameId)).toEqual([]);
    expect(overdueOf({ season: 'S', ...on }, history, {}, LIMIT - 1, extractGameId)).toEqual([]);
  });

  it('counts the days in Italy as the site, across the change of the clocks', () => {
    for (const [start, days] of [[START, 21], [Date.UTC(2026, 2, 20, 12), 9], [Date.UTC(2026, 9, 20, 12), 5], [Date.UTC(2026, 10, 22, 23, 30), 14]]) {
      expect(scriptRoundEndFrom(start, days)).toBe(roundEndFrom(start, days));
    }
  });

  it('tells them in one notification, with the names, opening the organizer area', () => {
    const items = overdueOf({ season: 'S', ...on }, history, {}, LIMIT, extractGameId);
    const names: Record<string, string> = { anna: 'Anna', bruno: 'Bruno', carla: 'Carla', dario: 'Dario' };
    expect(overdueNotification(items, 21, (h: string) => names[h] ?? h)).toEqual({
      title: '2 partite oltre i 21 giorni',
      body: "Anna – Bruno (Turno 3), Carla – Dario (Turno 3). Senza un accordo, puoi registrare il risultato dall'area organizzatore.",
      hash: '#admin',
      tag: 'ritardi',
    });
    expect(overdueNotification(items.slice(0, 1), 21, (h: string) => h).title).toBe('Partita oltre i 21 giorni');
  });

  it('does not read again from Lichess a game decided by the organizer', () => {
    expect(syncTargets(history).map((g: HistoryGame) => g.url)).toEqual([url('aaaaaaaa'), url('bbbbbbbb')]);
  });
});
