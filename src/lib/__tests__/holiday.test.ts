import { describe, expect, it } from 'vitest';
import { easterSunday, holidayOn } from '../holiday';

describe('holidayOn', () => {
  it('is Christmas from 1 December to 6 January, Italian time', () => {
    expect(holidayOn(new Date('2026-11-30T22:59:00Z'))).toBeNull();
    expect(holidayOn(new Date('2026-11-30T23:00:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2026-12-25T12:00:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2027-01-06T22:59:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2027-01-06T23:00:00Z'))).toBeNull();
    expect(holidayOn(new Date('2026-07-15T12:00:00Z'))).toBeNull();
  });

  it('is Halloween from 20 October to 1 November', () => {
    expect(holidayOn(new Date('2026-10-19T12:00:00Z'))).toBeNull();
    expect(holidayOn(new Date('2026-10-19T22:00:00Z'))).toBe('halloween'); // 20 October in Italy
    expect(holidayOn(new Date('2026-10-31T12:00:00Z'))).toBe('halloween');
    expect(holidayOn(new Date('2026-11-01T12:00:00Z'))).toBe('halloween');
    expect(holidayOn(new Date('2026-11-02T12:00:00Z'))).toBeNull();
  });

  it('is Easter from Palm Sunday to Easter Monday', () => {
    // Easter 2027 is on 28 March: from 21 to 29 March
    expect(holidayOn(new Date('2027-03-20T12:00:00Z'))).toBeNull();
    expect(holidayOn(new Date('2027-03-21T12:00:00Z'))).toBe('easter');
    expect(holidayOn(new Date('2027-03-28T12:00:00Z'))).toBe('easter');
    expect(holidayOn(new Date('2027-03-29T12:00:00Z'))).toBe('easter');
    expect(holidayOn(new Date('2027-03-30T12:00:00Z'))).toBeNull();
  });

  it('can be forced from the address for a preview', () => {
    const july = new Date('2026-07-15T12:00:00Z');
    expect(holidayOn(july, '?christmas')).toBe('christmas');
    expect(holidayOn(july, '?x=1&halloween')).toBe('halloween');
    expect(holidayOn(july, '?easter')).toBe('easter');
  });
});

describe('easterSunday', () => {
  it.each([
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'],
  ])('%i: %s', (year, date) => {
    expect(easterSunday(year).toISOString().slice(0, 10)).toBe(date);
  });
});
