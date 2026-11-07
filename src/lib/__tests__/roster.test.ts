import { describe, expect, it } from 'vitest';
import { duplicateNames, fullRoster, hasSeasonGames, newPlayerError, renamePlayer, rosterNameOf, storedRoster } from '../roster';
import { SeasonArchive } from '../../types';

const row = (handle: string, name: string) => ({ handle, name, points: 0, played: 1, won: 0, drawn: 0, lost: 1, sb: 0 });
const s1: SeasonArchive = {
  id: 's1',
  season: 'Stagione 1',
  title: 'T',
  archivedAt: '2026-01-01T00:00:00Z',
  gamesPlayed: 1,
  standings: [row('fsgach', 'Fabio'), row('battimat', 'Matteo'), row('ma_pi', 'Matteo "Piero"'), row('matepaco', 'Francesco')],
  departures: [{ handle: 'gredip', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'matepaco', name: 'Francesco' } }],
};
const s2: SeasonArchive = { ...s1, id: 's2', season: 'Stagione 2', archivedAt: '2026-06-01T00:00:00Z', standings: [row('matepaco', 'Francesco Spa')], departures: [] };
const players = [
  { handle: 'fsgach', name: 'Fabio' },
  { handle: 'frasal', name: 'Francesco Sal' },
];

describe('fullRoster', () => {
  const roster = fullRoster({ roster: [{ handle: 'Battimat', name: 'Matteo B.' }], players, seasons: [s2, s1], winners: [{ season: 'Stagione 1', handle: 'fsgach', name: 'Fabio', podium: [{ handle: 'oldie', name: 'Vecchio', place: 2 }] }] });
  const by = (h: string) => roster.find((e) => e.handle.toLowerCase() === h)!;

  it('has everyone once: register, current players, archives, who left, hall of fame', () => {
    expect(roster.map((e) => e.handle.toLowerCase()).sort()).toEqual(['battimat', 'frasal', 'fsgach', 'gredip', 'ma_pi', 'matepaco', 'oldie']);
  });

  it('takes the name from the register, then the current season, then the newest archive', () => {
    expect(by('battimat').name).toBe('Matteo B.');
    expect(by('frasal').name).toBe('Francesco Sal');
    expect(by('matepaco').name).toBe('Francesco Spa');
    expect(by('gredip').name).toBe('Greta');
  });

  it('knows who plays now, who is in the history and their seasons', () => {
    expect(by('fsgach')).toMatchObject({ active: true, inHistory: true, seasons: ['Stagione 1'] });
    expect(by('frasal')).toMatchObject({ active: true, inHistory: false, seasons: [] });
    expect(by('matepaco').seasons).toEqual(['Stagione 1', 'Stagione 2']);
    expect(by('gredip')).toMatchObject({ active: false, inHistory: true, seasons: ['Stagione 1'] });
    expect(by('oldie')).toMatchObject({ inHistory: true, seasons: [] });
  });

  it('keeps a registered player who never played, removable', () => {
    const r = fullRoster({ roster: [{ handle: 'nuovo', name: 'Nuovo' }], players: [] });
    expect(r).toEqual([{ handle: 'nuovo', name: 'Nuovo', active: false, seasons: [], inHistory: false }]);
  });
});

describe('rosterNameOf', () => {
  it('reads the register, whatever the case, with a fallback', () => {
    const nameOf = rosterNameOf([{ handle: 'battimat', name: 'Matteo B.' }]);
    expect(nameOf('BattiMat')).toBe('Matteo B.');
    expect(nameOf('zeno', 'Zeno')).toBe('Zeno');
    expect(nameOf('zeno')).toBe('zeno');
  });
});

describe('duplicateNames', () => {
  it('flags the players sharing a name', () => {
    const dup = duplicateNames([
      { handle: 'a', name: 'Matteo' },
      { handle: 'b', name: 'matteo ' },
      { handle: 'c', name: 'Matteo P.' },
    ]);
    expect([...dup].sort()).toEqual(['a', 'b']);
  });
});

describe('newPlayerError', () => {
  const roster = fullRoster({ players });
  it('wants a name and a valid Lichess username, not registered yet', () => {
    expect(newPlayerError(roster, '', 'X')).toMatch(/Scrivi/);
    expect(newPlayerError(roster, 'con spazio', 'X')).toMatch(/lettere/);
    expect(newPlayerError(roster, 'FSGACH', 'Fabio 2')).toBe('@fsgach è già registrato, come Fabio.');
    expect(newPlayerError(roster, 'new_one-2', 'Nuovo')).toBeNull();
  });
});

describe('renamePlayer', () => {
  it('renames in the register and in the current season', () => {
    const roster = fullRoster({ players, seasons: [s1] });
    const out = renamePlayer(roster, players, 'FSGACH', ' Fabio G. ');
    expect(out.roster.find((p) => p.handle === 'fsgach')?.name).toBe('Fabio G.');
    expect(out.players[0]).toEqual({ handle: 'fsgach', name: 'Fabio G.' });
    expect(out.roster).toHaveLength(storedRoster(roster).length);
  });
});

describe('hasSeasonGames', () => {
  it('looks at the created games and the calendar', () => {
    const g = { round: '1', white: 'Anna', black: 'bruno', url: '' };
    expect(hasSeasonGames('anna', [g])).toBe(true);
    expect(hasSeasonGames('carla', [g], [{ round: '2', white: 'carla', black: 'anna' }])).toBe(true);
    expect(hasSeasonGames('dario', [g])).toBe(false);
  });
});
