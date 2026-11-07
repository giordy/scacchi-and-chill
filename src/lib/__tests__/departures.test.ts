import { describe, expect, it } from 'vitest';
import { departuresOf, departureText, replacedIn } from '../departures';
import { buildSeasonArchive } from '../seasons';
import { careerOf } from '../allTime';
import { Withdrawal } from '../../types';

const replaced: Withdrawal = {
  handle: 'gredip',
  name: 'Greta',
  at: '2025-10-01',
  played: 2,
  total: 10,
  mode: 'replaced',
  replacedBy: { handle: 'matepaco', name: 'Paco' },
  undo: { players: [], schedule: [] },
};
const annulled: Withdrawal = { handle: 'luca', name: 'Luca', at: '', played: 1, total: 10, mode: 'annulled' };

describe('departures', () => {
  it('keeps only what the archive needs', () => {
    expect(departuresOf([replaced, annulled])).toEqual([
      { handle: 'gredip', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'matepaco', name: 'Paco' } },
      { handle: 'luca', name: 'Luca', mode: 'annulled' },
    ]);
    expect(departuresOf(undefined)).toEqual([]);
  });

  it('writes the note under the table', () => {
    const [r, a] = departuresOf([replaced, annulled]);
    expect(departureText(r)).toBe('Greta ha lasciato il torneo; al suo posto ha giocato Paco.');
    expect(departureText(a)).toBe('Luca ha lasciato il torneo: le sue partite sono state annullate.');
    expect(departureText({ handle: 'x', name: 'X', mode: 'forfeit' })).toBe('X ha lasciato il torneo: le partite rimaste sono andate agli avversari.');
    // With the register's names: renamed players show the new name
    const names = (h: string, f?: string) => ({ gredip: 'Greta D.', matepaco: 'Francesco S.' } as Record<string, string>)[h] ?? f ?? h;
    expect(departureText(r, names)).toBe('Greta D. ha lasciato il torneo; al suo posto ha giocato Francesco S.');
  });

  it('tells whom a player replaced', () => {
    expect(replacedIn(departuresOf([replaced]), 'MatePaco')).toEqual({ handle: 'gredip', name: 'Greta' });
    expect(replacedIn(departuresOf([replaced]), 'gredip')).toBeUndefined();
  });

  it('is saved with the archive and shown in the career of the substitute', () => {
    const meta = { title: 'Scacchi & Chill', season: 'Stagione 1', description: '', withdrawals: [replaced] };
    const players = [
      { handle: 'fsgach', name: 'Fabio' },
      { handle: 'matepaco', name: 'Paco' },
    ];
    const archive = buildSeasonArchive(meta, players, [], {}, new Date('2026-01-01T00:00:00Z'));
    expect(archive.departures).toHaveLength(1);
    expect(careerOf('matepaco', [archive])[0].replacing).toEqual({ handle: 'gredip', name: 'Greta' });
    expect(careerOf('fsgach', [archive])[0]).not.toHaveProperty('replacing');
    expect(buildSeasonArchive({ ...meta, withdrawals: [] }, players, [], {})).not.toHaveProperty('departures');
  });
});
