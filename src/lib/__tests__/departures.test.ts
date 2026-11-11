import { describe, expect, it } from 'vitest';
import { departuresOf, departureText, ownRows, replacedIn } from '../departures';
import { buildSeasonArchive } from '../seasons';
import { allTimeTable, careerOf } from '../allTime';
import { ArchivedGame, SeasonArchive, SeasonDeparture, Withdrawal } from '../../types';

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

describe('games of a replaced place, by who played them', () => {
  const standings = [
    { handle: 'fsgach', name: 'Fabio', played: 3, won: 2, drawn: 1, lost: 0, points: 2.5, sb: 0 },
    { handle: 'matepaco', name: 'Francesco', played: 3, won: 1, drawn: 0, lost: 2, points: 1, sb: 0 },
  ];
  const games: ArchivedGame[] = [
    { round: '1', white: 'matepaco', black: 'fsgach', result: '0-1', end: Date.parse('2026-01-10') },
    { round: '2', white: 'fsgach', black: 'matepaco', result: '1-0', end: Date.parse('2026-02-10') },
    { round: '3', white: 'matepaco', black: 'fsgach', result: '1-0', end: Date.parse('2026-04-10') },
  ];
  const departure = (d: Partial<SeasonDeparture>): SeasonDeparture[] => [
    { handle: 'gredip', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'matepaco', name: 'Francesco' }, ...d },
  ];
  const own = (d: SeasonDeparture[], g: ArchivedGame[] = games) =>
    Object.fromEntries(ownRows(standings, d, g).map((r) => [r.handle, [r.played, r.won, r.drawn, r.lost, r.points]]));

  it('gives the games before the substitute took over back to who left, by round', () => {
    expect(own(departure({ fromRound: '3' }))).toEqual({ fsgach: [3, 2, 1, 0, 2.5], matepaco: [1, 1, 0, 0, 1], gredip: [2, 0, 0, 2, 0] });
  });

  it('by day, for seasons archived without the rounds', () => {
    const noRounds = games.map((g) => ({ ...g, round: '–' }));
    expect(own(departure({ fromDate: '2026-03-20' }), noRounds)).toEqual({ fsgach: [3, 2, 1, 0, 2.5], matepaco: [1, 1, 0, 0, 1], gredip: [2, 0, 0, 2, 0] });
  });

  it('leaves the table as it is without the start, or without the games', () => {
    expect(ownRows(standings, departure({}), games)).toBe(standings);
    expect(ownRows(standings, departure({ fromRound: '3' }), undefined)).toBe(standings);
  });

  it('counts in the all-time table and in both careers', () => {
    const archive: SeasonArchive = {
      id: 'stagione-1', season: 'Stagione 1', title: '', archivedAt: '2026-05-01', gamesPlayed: 3,
      standings, games, departures: departure({ fromRound: '3' }),
    };
    const rows = Object.fromEntries(allTimeTable([archive], []).map((r) => [r.handle, [r.played, r.points]]));
    expect(rows).toEqual({ fsgach: [3, 2.5], matepaco: [1, 1], gredip: [2, 0] });
    expect(careerOf('matepaco', [archive])[0]).toMatchObject({ place: 2, played: 1, points: 1, replacing: { handle: 'gredip' } });
    expect(careerOf('gredip', [archive])[0]).toMatchObject({ place: null, played: 2, points: 0, replacedBy: { handle: 'matepaco' } });
  });
});
