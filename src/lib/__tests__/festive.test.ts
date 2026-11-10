import { describe, expect, it } from 'vitest';
import { festivityOn } from '../festive';

describe('festivityOn', () => {
  it('is Christmas from 1 December to 6 January, Italian time', () => {
    expect(festivityOn(new Date('2026-11-30T22:59:00Z'))).toBeNull();
    expect(festivityOn(new Date('2026-11-30T23:00:00Z'))).toBe('natale');
    expect(festivityOn(new Date('2026-12-25T12:00:00Z'))).toBe('natale');
    expect(festivityOn(new Date('2027-01-06T22:59:00Z'))).toBe('natale');
    expect(festivityOn(new Date('2027-01-06T23:00:00Z'))).toBeNull();
    expect(festivityOn(new Date('2026-07-15T12:00:00Z'))).toBeNull();
  });

  it('can be forced with ?natale for a preview', () => {
    expect(festivityOn(new Date('2026-07-15T12:00:00Z'), '?natale')).toBe('natale');
    expect(festivityOn(new Date('2026-07-15T12:00:00Z'), '?x=1&natale')).toBe('natale');
  });
});
