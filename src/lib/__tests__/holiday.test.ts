import { describe, expect, it } from 'vitest';
import { holidayOn } from '../holiday';

describe('holidayOn', () => {
  it('is Christmas from 1 December to 6 January, Italian time', () => {
    expect(holidayOn(new Date('2026-11-30T22:59:00Z'))).toBeNull();
    expect(holidayOn(new Date('2026-11-30T23:00:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2026-12-25T12:00:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2027-01-06T22:59:00Z'))).toBe('christmas');
    expect(holidayOn(new Date('2027-01-06T23:00:00Z'))).toBeNull();
    expect(holidayOn(new Date('2026-07-15T12:00:00Z'))).toBeNull();
  });

  it('can be forced with ?christmas for a preview', () => {
    expect(holidayOn(new Date('2026-07-15T12:00:00Z'), '?christmas')).toBe('christmas');
    expect(holidayOn(new Date('2026-07-15T12:00:00Z'), '?x=1&christmas')).toBe('christmas');
  });
});
