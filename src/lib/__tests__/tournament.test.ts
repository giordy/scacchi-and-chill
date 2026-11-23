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

  it('reads the Turni con scadenza: off without a length, the ends only when well formed', () => {
    expect(tournamentFromDoc({ title: 'T', season: 'S' })).not.toHaveProperty('roundDays');
    expect(tournamentFromDoc({ title: 'T', season: 'S', roundDays: 0 })).not.toHaveProperty('roundDays');
    const meta = tournamentFromDoc({ title: 'T', season: 'S', roundDays: 14, roundEnds: [{ round: '1', at: 5 }, { round: '2' } as any] });
    expect(meta).toMatchObject({ roundDays: 14, roundEnds: [{ round: '1', at: 5 }] });
  });

  it('keeps the Turni con scadenza when another field changes, and switches them off with 0', () => {
    const current = mergeTournamentMeta(undefined, { title: 'T', season: 'S', roundDays: 14, roundEnds: [{ round: '1', at: 5 }] });
    expect(mergeTournamentMeta(current, { season: 'S2' })).toMatchObject({ roundDays: 14, roundEnds: [{ round: '1', at: 5 }] });
    // 0 stays, so that the write switches them off on Firestore too; the ends stay for a later switch on
    expect(mergeTournamentMeta(current, { roundDays: 0 })).toMatchObject({ roundDays: 0, roundEnds: [{ round: '1', at: 5 }] });
    expect(mergeTournamentMeta(undefined, { title: 'T', season: 'S' })).not.toHaveProperty('roundDays');
    // the last rounds without overlap, apart
    expect(tournamentFromDoc({ title: 'T', season: 'S', finalRoundsWait: 3 })).toMatchObject({ finalRoundsWait: 3 });
    expect(mergeTournamentMeta(mergeTournamentMeta(current, { finalRoundsWait: 3 }), { finalRoundsWait: 0 })).toMatchObject({ finalRoundsWait: 0 });
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
