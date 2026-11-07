import { describe, expect, it } from 'vitest';
import { mergeTournamentMeta, tournamentFromDoc } from '../tournament';

describe('tournament meta', () => {
  it('reads days per move and rated from the Firestore document', () => {
    const meta = tournamentFromDoc({ title: 'T', season: 'S', daysPerMove: 3, rated: false });
    expect(meta?.daysPerMove).toBe(3);
    expect(meta?.rated).toBe(false);
  });

  it('ignores invalid Lichess parameters', () => {
    const meta = tournamentFromDoc({ title: 'T', season: 'S', daysPerMove: 0 });
    expect(meta?.daysPerMove).toBeUndefined();
    expect(meta?.rated).toBeUndefined();
  });

  it('keeps the Lichess parameters when another field changes', () => {
    const current = mergeTournamentMeta(undefined, { title: 'T', season: 'S', daysPerMove: 4, rated: true });
    const next = mergeTournamentMeta(current, { season: 'S2' });
    expect(next).toMatchObject({ season: 'S2', daysPerMove: 4, rated: true });
  });
});

describe('players register in the tournament document', () => {
  it('is read from Firestore and kept by later changes', async () => {
    const { tournamentFromDoc, mergeTournamentMeta } = await import('../tournament');
    const roster = [{ handle: 'anna', name: 'Anna R.' }];
    const meta = tournamentFromDoc({ title: 'T', season: 'S', roster })!;
    expect(meta.roster).toEqual(roster);
    expect(mergeTournamentMeta(meta, { season: 'S2' }).roster).toEqual(roster);
    expect(mergeTournamentMeta(meta, { roster: [] }).roster).toEqual([]);
    expect(tournamentFromDoc({ title: 'T', season: 'S' })).not.toHaveProperty('roster');
  });
});
