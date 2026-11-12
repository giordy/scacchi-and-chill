import { SeasonArchive } from '../types';
import { masterSurname, scudettoTitle } from './masterOpening';

// The scudetto of a season, as drawn on the trophy shelf: a gold shield with the initial of the
// master's surname on a colour of his own. A season without a master (the first one, or one never
// archived) is the Scudetto Chill: the site's green, with a Staunty knight instead of the initial.

// Deep colours that hold the gold initial and stay apart from the site's green (the Scudetto Chill's)
export const SCUDETTO_COLORS = [
  { color: '#24578a', name: 'blu' },
  { color: '#a3302a', name: 'rosso' },
  { color: '#5b3f86', name: 'viola' },
  { color: '#8a4a1c', name: 'ruggine' },
  { color: '#1d6a74', name: 'ottanio' },
  { color: '#7a2848', name: 'bordeaux' },
  { color: '#4a5a1f', name: 'oliva' },
  { color: '#2f3f5c', name: 'ardesia' },
] as const;
export const SCUDETTO_CHILL_COLOR = '#1f3a34';

const isPaletteColor = (color: string | undefined): color is string => !!color && SCUDETTO_COLORS.some((c) => c.color === color);

export const scudettoColorName = (color: string) => SCUDETTO_COLORS.find((c) => c.color === color)?.name ?? color;

export interface Scudetto {
  title: string; // "Scudetto Capablanca", "Scudetto Chill"
  letter?: string; // "C"; none for the Scudetto Chill, which has the knight
  color: string;
}

export interface PastScudetto extends Scudetto {
  season: string;
  letter: string;
}

export const scudettoLetter = (masterName: string | undefined) => masterSurname(masterName).charAt(0).toLocaleUpperCase('it');

// The colour the site picks for a master when the organizer chose none: never one an earlier
// scudetto with the same initial already has, and among the others the least used so far, in the
// order of the palette. So the first eight masters all have a different colour.
export function autoScudettoColor(letter: string, earlier: Array<{ letter: string; color: string }>): string {
  const taken = new Set(earlier.filter((s) => s.letter === letter).map((s) => s.color));
  const free = SCUDETTO_COLORS.map((c) => c.color).filter((c) => !taken.has(c));
  const pool = free.length > 0 ? free : SCUDETTO_COLORS.map((c) => c.color);
  const uses = (color: string) => earlier.filter((s) => s.color === color).length;
  return pool.reduce((best, c) => (uses(c) < uses(best) ? c : best));
}

// The scudetti of the archived seasons with a master, in the order they were archived. Each takes
// the colour chosen by the organizer, or one picked from those before it, so it never changes later.
export function pastScudetti(seasons: SeasonArchive[] | undefined): PastScudetto[] {
  const list: PastScudetto[] = [];
  (seasons ?? [])
    .filter((s) => masterSurname(s.masterName))
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
    .forEach((s) => {
      const letter = scudettoLetter(s.masterName);
      const color = isPaletteColor(s.masterColor) ? s.masterColor : autoScudettoColor(letter, list);
      list.push({ season: s.season, title: scudettoTitle(s.masterName), letter, color });
    });
  return list;
}

// The scudetto of a season, from its archive
export function scudettoOf(season: string, seasons: SeasonArchive[] | undefined): Scudetto {
  const found = pastScudetti(seasons).find((s) => s.season === season);
  if (!found) return { title: scudettoTitle(undefined), color: SCUDETTO_CHILL_COLOR };
  return { title: found.title, letter: found.letter, color: found.color };
}

// The scudetto of the season being played, as it will be once archived: with the colour chosen in
// the organizer area, or the one the site would pick. The season's own archive, if there is one
// already, is left out of the comparison.
export function currentScudetto(
  season: string,
  masterName: string | undefined,
  masterColor: string | undefined,
  seasons: SeasonArchive[] | undefined
): Scudetto & { auto: boolean } {
  const letter = scudettoLetter(masterName);
  if (!letter) return { title: scudettoTitle(undefined), color: SCUDETTO_CHILL_COLOR, auto: false };
  const earlier = pastScudetti((seasons ?? []).filter((s) => s.season !== season));
  const chosen = isPaletteColor(masterColor);
  return { title: scudettoTitle(masterName), letter, color: chosen ? masterColor! : autoScudettoColor(letter, earlier), auto: !chosen };
}

// The past scudetti that would look the same as this one: same initial, same colour
export function scudettoTwins(season: string, masterName: string | undefined, color: string, seasons: SeasonArchive[] | undefined): PastScudetto[] {
  const letter = scudettoLetter(masterName);
  if (!letter) return [];
  return pastScudetti((seasons ?? []).filter((s) => s.season !== season)).filter((s) => s.letter === letter && s.color === color);
}
