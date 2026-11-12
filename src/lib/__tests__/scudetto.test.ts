import { describe, expect, it } from 'vitest';
import { SCUDETTO_CHILL_COLOR, SCUDETTO_COLORS, scudettoOf } from '../scudetto';
import { SeasonArchive } from '../../types';

const archive = (season: string, archivedAt: string, masterName?: string): SeasonArchive =>
  ({ id: season, season, title: 'Scacchi & Chill', masterName, archivedAt, standings: [], gamesPlayed: 0 }) as SeasonArchive;

describe('scudettoOf', () => {
  const seasons = [
    archive('Stagione 3 - Tal', '2027-09-01T00:00:00Z', 'Mikhail Tal'),
    archive('Stagione 2 - Capablanca', '2027-04-01T00:00:00Z', 'José Raúl Capablanca'),
  ];

  it('gives the initial of the surname and a colour by archive order', () => {
    expect(scudettoOf('Stagione 2 - Capablanca', seasons)).toEqual({ title: 'Scudetto Capablanca', letter: 'C', color: SCUDETTO_COLORS[0] });
    expect(scudettoOf('Stagione 3 - Tal', seasons)).toEqual({ title: 'Scudetto Tal', letter: 'T', color: SCUDETTO_COLORS[1] });
  });

  it('is the Scudetto Chill for a season never archived, as the first one', () => {
    expect(scudettoOf('Stagione 1', seasons)).toEqual({ title: 'Scudetto Chill', color: SCUDETTO_CHILL_COLOR });
    expect(scudettoOf('Stagione 1', undefined)).toEqual({ title: 'Scudetto Chill', color: SCUDETTO_CHILL_COLOR });
  });

  it('is the Scudetto Chill for an archived season without a master, which takes no colour', () => {
    const withBlank = [archive('Stagione 2', '2027-04-01T00:00:00Z', '  '), archive('Stagione 3 - Tal', '2027-09-01T00:00:00Z', 'Mikhail Tal')];
    expect(scudettoOf('Stagione 2', withBlank).title).toBe('Scudetto Chill');
    expect(scudettoOf('Stagione 3 - Tal', withBlank).color).toBe(SCUDETTO_COLORS[0]);
  });

  it('starts the colours again after the eighth master', () => {
    const many = Array.from({ length: 9 }, (_, i) => archive(`S${i + 1}`, `2030-0${i + 1}-01T00:00:00Z`, `Maestro ${String.fromCharCode(65 + i)}`));
    expect(scudettoOf('S9', many).color).toBe(SCUDETTO_COLORS[0]);
  });
});
