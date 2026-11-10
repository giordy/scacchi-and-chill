import { describe, expect, it } from 'vitest';
import { isSeasonColor } from '../seasonColor';
import { mergeTournamentMeta, tournamentFromDoc } from '../tournament';

describe('season color', () => {
  it('accepts only the colors on offer', () => {
    expect(isSeasonColor('navy')).toBe(true);
    expect(isSeasonColor('slate')).toBe(false);
    expect(isSeasonColor(undefined)).toBe(false);
  });

  it('is read from the tournament document, ignoring unknown values', () => {
    expect(tournamentFromDoc({ title: 'T', season: 'S', color: 'bordeaux' })?.color).toBe('bordeaux');
    expect(tournamentFromDoc({ title: 'T', season: 'S', color: 'pink' as never })?.color).toBeUndefined();
    expect(tournamentFromDoc({ title: 'T', season: 'S' })?.color).toBeUndefined();
  });

  it('is kept by an update that does not change it', () => {
    const meta = mergeTournamentMeta(undefined, { color: 'walnut' });
    expect(mergeTournamentMeta(meta, { title: 'Nuovo' }).color).toBe('walnut');
    expect(mergeTournamentMeta(meta, { color: 'green' }).color).toBe('green');
  });
});
