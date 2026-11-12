import { describe, expect, it } from 'vitest';
import { autoScudettoColor, currentScudetto, SCUDETTO_CHILL_COLOR, SCUDETTO_COLORS, scudettoOf, scudettoTwins } from '../scudetto';
import { SeasonArchive } from '../../types';

const C = SCUDETTO_COLORS.map((c) => c.color);
const archive = (season: string, archivedAt: string, masterName?: string, masterColor?: string): SeasonArchive =>
  ({ id: season, season, title: 'Scacchi & Chill', masterName, masterColor, archivedAt, standings: [], gamesPlayed: 0 }) as SeasonArchive;

describe('scudettoOf', () => {
  const seasons = [
    archive('Stagione 3 - Tal', '2027-09-01T00:00:00Z', 'Mikhail Tal'),
    archive('Stagione 2 - Capablanca', '2027-04-01T00:00:00Z', 'José Raúl Capablanca'),
  ];

  it('gives the initial of the surname and, with no colour chosen, a new colour for each master', () => {
    expect(scudettoOf('Stagione 2 - Capablanca', seasons)).toEqual({ title: 'Scudetto Capablanca', letter: 'C', color: C[0] });
    expect(scudettoOf('Stagione 3 - Tal', seasons)).toEqual({ title: 'Scudetto Tal', letter: 'T', color: C[1] });
  });

  it('keeps the colour chosen by the organizer, and picks the others around it', () => {
    const chosen = [archive('S2', '2027-04-01T00:00:00Z', 'Capablanca', C[1]), archive('S3', '2027-09-01T00:00:00Z', 'Tal')];
    expect(scudettoOf('S2', chosen).color).toBe(C[1]);
    expect(scudettoOf('S3', chosen).color).toBe(C[0]);
  });

  it('ignores a colour that is not in the palette', () => {
    expect(scudettoOf('S2', [archive('S2', '2027-04-01T00:00:00Z', 'Capablanca', '#ff00ff')]).color).toBe(C[0]);
  });

  it('is the Scudetto Chill for a season never archived, as the first one', () => {
    expect(scudettoOf('Stagione 1', seasons)).toEqual({ title: 'Scudetto Chill', color: SCUDETTO_CHILL_COLOR });
    expect(scudettoOf('Stagione 1', undefined)).toEqual({ title: 'Scudetto Chill', color: SCUDETTO_CHILL_COLOR });
  });

  it('is the Scudetto Chill for an archived season without a master, which takes no colour', () => {
    const withBlank = [archive('Stagione 2', '2027-04-01T00:00:00Z', '  '), archive('Stagione 3 - Tal', '2027-09-01T00:00:00Z', 'Mikhail Tal')];
    expect(scudettoOf('Stagione 2', withBlank).title).toBe('Scudetto Chill');
    expect(scudettoOf('Stagione 3 - Tal', withBlank).color).toBe(C[0]);
  });

  it('never gives a master the colour of an earlier one with the same initial, after the eighth too', () => {
    const many = ['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Capablanca', 'Carlsen'].map((m, i) =>
      archive(`S${i + 1}`, `2030-${String(i + 1).padStart(2, '0')}-01T00:00:00Z`, m)
    );
    expect(scudettoOf('S9', many).color).toBe(C[0]); // the ninth starts the palette again
    expect(scudettoOf('S10', many).color).not.toBe(C[0]); // Carlsen: not Capablanca's colour
  });
});

describe('autoScudettoColor', () => {
  it('skips the colours of the same initial even when that leaves a more used one', () => {
    const earlier = C.slice(0, 7).map((color, i) => ({ letter: i === 0 ? 'K' : 'X', color }));
    expect(autoScudettoColor('K', earlier)).toBe(C[7]);
    expect(autoScudettoColor('K', [...earlier, { letter: 'Y', color: C[7] }])).not.toBe(C[0]);
  });
});

describe('currentScudetto and scudettoTwins', () => {
  const seasons = [archive('S2', '2027-04-01T00:00:00Z', 'José Raúl Capablanca', C[2])];

  it('shows the chosen colour, or the one the site would pick', () => {
    expect(currentScudetto('S3', 'Magnus Carlsen', C[4], seasons)).toEqual({ title: 'Scudetto Carlsen', letter: 'C', color: C[4], auto: false });
    expect(currentScudetto('S3', 'Magnus Carlsen', '', seasons)).toMatchObject({ color: C[0], auto: true });
  });

  it('is the Scudetto Chill without a master', () => {
    expect(currentScudetto('S3', '', C[4], seasons)).toEqual({ title: 'Scudetto Chill', color: SCUDETTO_CHILL_COLOR, auto: false });
  });

  it('finds the past scudetto with the same initial and colour, not the season itself', () => {
    expect(scudettoTwins('S3', 'Magnus Carlsen', C[2], seasons).map((s) => s.title)).toEqual(['Scudetto Capablanca']);
    expect(scudettoTwins('S3', 'Magnus Carlsen', C[3], seasons)).toEqual([]);
    expect(scudettoTwins('S3', 'Mikhail Tal', C[2], seasons)).toEqual([]);
    expect(scudettoTwins('S2', 'José Raúl Capablanca', C[2], seasons)).toEqual([]);
  });
});
