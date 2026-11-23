import { describe, expect, it } from 'vitest';
import {
  carriedOver,
  cleanRoundEnds,
  daysLeft,
  endOnCreate,
  expiredRound,
  finalRoundsOf,
  formatRoundEnd,
  roundDeadlinesOn,
  roundEndFrom,
  roundEndFromInput,
  roundEndInputValue,
  roundEndOf,
  romeMidnight,
  roundExpired,
  roundStart,
  timeLeftText,
  waitsForEarlier,
  withRoundEnd,
} from '../roundDeadline';
import { HistoryGame, LichessExportGame } from '../../types';

const HOUR = 3_600_000;
// Monday 23 November 2026, 21:00 in Italy (winter time, UTC+1)
const MONDAY_EVENING = Date.UTC(2026, 10, 23, 20);
// The end of Monday 7 December in Italy: midnight of the 8th, 23:00 UTC of the 7th
const END_7_DEC = Date.UTC(2026, 11, 7, 23);

describe('the end of a round', () => {
  it('is midnight in Italy after its last day', () => {
    expect(romeMidnight(2026, 12, 8)).toBe(END_7_DEC);
    // summer time: UTC+2
    expect(romeMidnight(2026, 7, 1)).toBe(Date.UTC(2026, 5, 30, 22));
    expect(roundEndFrom(MONDAY_EVENING, 14)).toBe(END_7_DEC);
    // created just after midnight in Italy: still that day (23:30 UTC of the 22nd is the 23rd in Italy)
    expect(roundEndFrom(Date.UTC(2026, 10, 22, 23, 30), 14)).toBe(END_7_DEC);
    expect(formatRoundEnd(END_7_DEC)).toBe('lunedì 7 dicembre');
  });

  it('keeps the right day across the change of the clocks', () => {
    // From 20 March (winter time) for 9 days: until the end of Sunday 29 March, the night of the change
    const end = roundEndFrom(Date.UTC(2026, 2, 20, 12), 9);
    expect(end).toBe(Date.UTC(2026, 2, 29, 22)); // midnight of the 30th, already summer time
    expect(formatRoundEnd(end)).toBe('domenica 29 marzo');
    const autumn = roundEndFrom(Date.UTC(2026, 9, 20, 12), 5);
    expect(autumn).toBe(Date.UTC(2026, 9, 25, 23)); // midnight of the 26th, back to winter time
    expect(formatRoundEnd(autumn)).toBe('domenica 25 ottobre');
  });

  it('says how long is left, by days in Italy', () => {
    expect(daysLeft(END_7_DEC, MONDAY_EVENING)).toBe(14);
    expect(timeLeftText(END_7_DEC, Date.UTC(2026, 11, 4, 12))).toBe('mancano 3 giorni');
    expect(timeLeftText(END_7_DEC, Date.UTC(2026, 11, 6, 12))).toBe('manca 1 giorno');
    expect(timeLeftText(END_7_DEC, Date.UTC(2026, 11, 7, 22, 59))).toBe('ultimo giorno');
    expect(roundExpired(END_7_DEC, END_7_DEC - 1)).toBe(false);
    expect(roundExpired(END_7_DEC, END_7_DEC)).toBe(true);
    expect(timeLeftText(END_7_DEC, END_7_DEC + HOUR)).toBe('tempo scaduto');
  });

  it('goes to and from the date field as its last day', () => {
    expect(roundEndInputValue(END_7_DEC)).toBe('2026-12-07');
    expect(roundEndFromInput('2026-12-07')).toBe(END_7_DEC);
    expect(roundEndFromInput('2026-12-31')).toBe(Date.UTC(2026, 11, 31, 23));
    expect(roundEndFromInput('')).toBeUndefined();
    expect(roundEndFromInput('7/12/2026')).toBeUndefined();
    // days that do not exist
    expect(roundEndFromInput('2026-02-31')).toBeUndefined();
    expect(roundEndFromInput('2026-13-01')).toBeUndefined();
    expect(roundEndFromInput('2026-00-10')).toBeUndefined();
    expect(roundEndFromInput('2028-02-29')).toBe(Date.UTC(2028, 1, 29, 23)); // a leap year
  });
});

describe('the option', () => {
  const ends = [{ round: '3', at: END_7_DEC }];
  it('is off without a length, and then no round has an end', () => {
    expect(roundDeadlinesOn(undefined)).toBe(false);
    expect(roundDeadlinesOn({ roundDays: 0 })).toBe(false);
    expect(roundDeadlinesOn({ roundDays: 14 })).toBe(true);
    expect(roundEndOf({ roundEnds: ends }, '3')).toBeUndefined();
    expect(roundEndOf({ roundDays: 0, roundEnds: ends }, '3')).toBeUndefined();
    expect(roundEndOf({ roundDays: 14, roundEnds: ends }, '3')).toBe(END_7_DEC);
    expect(roundEndOf({ roundDays: 14, roundEnds: ends }, '4')).toBeUndefined();
  });

  it('sets, moves and removes the end of one round, in round order', () => {
    const two = withRoundEnd(withRoundEnd(ends, '10', 5), '2', 1);
    expect(two.map((e) => e.round)).toEqual(['2', '3', '10']);
    expect(withRoundEnd(two, '3', 9).find((e) => e.round === '3')?.at).toBe(9);
    expect(withRoundEnd(two, '3').map((e) => e.round)).toEqual(['2', '10']);
    expect(withRoundEnd(undefined, '1', 7)).toEqual([{ round: '1', at: 7 }]);
  });

  it('reads only well formed ends from Firestore', () => {
    expect(cleanRoundEnds(undefined)).toBeUndefined();
    expect(cleanRoundEnds([{ round: '1', at: 5 }, { round: '', at: 3 }, { round: '2' }, null, { round: '3', at: 'x' }])).toEqual([{ round: '1', at: 5 }]);
  });
});

const url = (id: string) => `https://lichess.org/${id}`;
const game = (round: string, white: string, black: string, id: string, status?: string): HistoryGame => ({
  round,
  white,
  black,
  url: url(id),
  createdAt: MONDAY_EVENING,
  ...(status ? { lichess: { id, status } as LichessExportGame } : {}),
});

describe('rounds side by side', () => {
  const history = [
    game('2', 'anna', 'bruno', 'aaaaaaaa', 'mate'),
    game('2', 'carla', 'dario', 'bbbbbbbb', 'started'),
    game('3', 'anna', 'carla', 'cccccccc', 'started'),
    game('3', 'bruno', 'dario', 'dddddddd', 'resign'),
  ];
  const rounds = [
    { round: '2', created: 2 },
    { round: '3', created: 2 },
    { round: '4', created: 0 },
  ];
  const meta = { roundDays: 14, roundEnds: [{ round: '3', at: END_7_DEC }] };

  it('starts a round from its first challenge', () => {
    expect(roundStart([{ url: url('x'), createdAt: 5 }, { url: url('y'), createdAt: 3 }, { url: '', createdAt: 1 }])).toBe(3);
    expect(roundStart([{ url: '' }])).toBeUndefined();
  });

  it('lists the games of earlier rounds still being played', () => {
    expect(carriedOver('4', history, {}).map((g) => g.url)).toEqual([url('bbbbbbbb'), url('cccccccc')]);
    // a fresh state from Lichess wins: finished meanwhile
    const states = { bbbbbbbb: { id: 'bbbbbbbb', status: 'draw' } as LichessExportGame };
    expect(carriedOver('4', history, states).map((g) => g.url)).toEqual([url('cccccccc')]);
    expect(carriedOver('2', history, {})).toEqual([]);
  });

  it('tells the organizer when the round in progress is over and the next can start', () => {
    expect(expiredRound(meta, rounds, history, {}, END_7_DEC - 1)).toBeUndefined();
    const over = expiredRound(meta, rounds, history, {}, END_7_DEC);
    expect(over).toMatchObject({ round: '3', end: END_7_DEC, next: '4' });
    expect(over?.open.map((g) => g.url)).toEqual([url('cccccccc')]);
    // off, without an end, or with no round after it: nothing to say
    expect(expiredRound({ ...meta, roundDays: 0 }, rounds, history, {}, END_7_DEC)).toBeUndefined();
    expect(expiredRound({ roundDays: 14 }, rounds, history, {}, END_7_DEC)).toBeUndefined();
    expect(expiredRound(meta, rounds.slice(0, 2), history, {}, END_7_DEC)).toBeUndefined();
    // once the next round has its challenges, it is the one in progress
    expect(expiredRound(meta, [...rounds.slice(0, 2), { round: '4', created: 1 }], history, {}, END_7_DEC)).toBeUndefined();
  });
});

describe('the last rounds, without overlap (Ultime giornate)', () => {
  const names = Array.from({ length: 14 }, (_, i) => String(i + 1));
  it('is off unless set, and only with the deadlines on', () => {
    expect(finalRoundsOf({ roundDays: 14 })).toBe(0);
    expect(finalRoundsOf({ roundDays: 14, finalRoundsWait: 0 })).toBe(0);
    expect(finalRoundsOf({ roundDays: 0, finalRoundsWait: 3 })).toBe(0);
    expect(finalRoundsOf({ roundDays: 14, finalRoundsWait: 3 })).toBe(3);
  });

  it('holds the last rounds of the calendar, by round number', () => {
    const meta = { roundDays: 14, finalRoundsWait: 3 };
    expect(names.filter((r) => waitsForEarlier(meta, names, r))).toEqual(['12', '13', '14']);
    expect(waitsForEarlier({ roundDays: 14 }, names, '14')).toBe(false);
  });

  const history = [
    game('10', 'anna', 'bruno', 'aaaaaaaa', 'started'),
    game('11', 'carla', 'dario', 'bbbbbbbb', 'started'),
    game('11', 'anna', 'carla', 'cccccccc', 'mate'),
  ];
  const rounds = names.map((round) => ({ round, created: Number(round) <= 11 ? 1 : 0 }));
  const meta = { roundDays: 14, roundEnds: [{ round: '11', at: END_7_DEC }], finalRoundsWait: 3 };

  it('waits, at the end of the round before them, for every game still open', () => {
    const over = expiredRound(meta, rounds, history, {}, END_7_DEC);
    expect(over).toMatchObject({ round: '11', next: '12' });
    expect(over?.waitFor.map((g) => g.url)).toEqual([url('aaaaaaaa'), url('bbbbbbbb')]);
    // once they are over, the next round can start
    const done = { aaaaaaaa: { id: 'aaaaaaaa', status: 'draw' }, bbbbbbbb: { id: 'bbbbbbbb', status: 'resign' } } as Record<string, LichessExportGame>;
    expect(expiredRound(meta, rounds, history, done, END_7_DEC)?.waitFor).toEqual([]);
    // off: as before
    expect(expiredRound({ ...meta, finalRoundsWait: 0 }, rounds, history, {}, END_7_DEC)?.waitFor).toEqual([]);
  });
});

describe('the end a round gets when its challenges are created', () => {
  const on = { roundDays: 14 };
  it('counts from the first challenge created, with the deadlines on', () => {
    expect(endOnCreate(on, '4', 0, [MONDAY_EVENING + HOUR, MONDAY_EVENING])).toBe(END_7_DEC);
  });

  it('sets nothing with the option off, for a round already started, or when no challenge was created', () => {
    expect(endOnCreate(undefined, '4', 0, [MONDAY_EVENING])).toBeUndefined();
    expect(endOnCreate({ roundDays: 0 }, '4', 0, [MONDAY_EVENING])).toBeUndefined();
    // the second batch of a round started before the option was on: still no end
    expect(endOnCreate(on, '4', 2, [MONDAY_EVENING])).toBeUndefined();
    // every challenge failed on Lichess
    expect(endOnCreate(on, '4', 0, [])).toBeUndefined();
  });

  it('keeps an end the round already has (moved by the organizer)', () => {
    expect(endOnCreate({ ...on, roundEnds: [{ round: '4', at: 123 }] }, '4', 0, [MONDAY_EVENING])).toBeUndefined();
    // the end of another round does not count
    expect(endOnCreate({ ...on, roundEnds: [{ round: '3', at: 123 }] }, '4', 0, [MONDAY_EVENING])).toBe(END_7_DEC);
  });
});

describe('corner cases of a round past its end', () => {
  const rounds = [
    { round: '9', created: 1 },
    { round: '10', created: 1 },
    { round: '11', created: 0 },
  ];
  it('orders the rounds by number, not as text (10 after 9)', () => {
    const history = [game('9', 'anna', 'bruno', 'aaaaaaaa', 'mate'), game('10', 'carla', 'dario', 'bbbbbbbb', 'mate')];
    const over = expiredRound({ roundDays: 14, roundEnds: [{ round: '10', at: END_7_DEC }] }, rounds, history, {}, END_7_DEC);
    expect(over).toMatchObject({ round: '10', next: '11' });
    // every game over: the next round can start, nothing goes on
    expect(over?.open).toEqual([]);
    expect(over?.waitFor).toEqual([]);
  });

  it('with more waiting rounds than the calendar has, every round waits for the ones before', () => {
    const meta = { roundDays: 14, finalRoundsWait: 10 };
    expect(['1', '2', '3'].every((r) => waitsForEarlier(meta, ['1', '2', '3'], r))).toBe(true);
    // the first one has nothing to wait for
    expect(carriedOver('1', [game('1', 'anna', 'bruno', 'aaaaaaaa', 'started')], {})).toEqual([]);
  });

  it('a game with no link is not still being played (a forfeit, a pairing not created)', () => {
    const forfeit = { round: '1', white: 'anna', black: 'bruno', url: '', lichess: { id: '', status: 'forfeit' } as LichessExportGame };
    expect(carriedOver('2', [forfeit], {})).toEqual([]);
  });
});
