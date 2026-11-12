import { SeasonArchive } from '../types';
import { masterSurname, scudettoTitle } from './masterOpening';

// The scudetto of a season, as drawn on the trophy shelf: a gold shield with the initial of the
// master's surname on a colour of his own. A season without a master (the first one, or one never
// archived) is the Scudetto Chill: the site's green, with a Staunty knight instead of the initial.

// Deep colours that hold the gold initial and stay apart from the site's green (the Scudetto Chill's)
export const SCUDETTO_COLORS = ['#24578a', '#a3302a', '#5b3f86', '#8a4a1c', '#1d6a74', '#7a2848', '#4a5a1f', '#2f3f5c'] as const;
export const SCUDETTO_CHILL_COLOR = '#1f3a34';

export interface Scudetto {
  title: string; // "Scudetto Capablanca", "Scudetto Chill"
  letter?: string; // "C"; none for the Scudetto Chill, which has the knight
  color: string;
}

// The scudetto of a season, from its archive. Colours follow the order in which the seasons with a
// master were archived, so the masters of the first eight seasons all have a different one.
export function scudettoOf(season: string, seasons: SeasonArchive[] | undefined): Scudetto {
  const withMaster = (seasons ?? [])
    .filter((s) => masterSurname(s.masterName))
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt));
  const index = withMaster.findIndex((s) => s.season === season);
  if (index < 0) return { title: scudettoTitle(undefined), color: SCUDETTO_CHILL_COLOR };
  const master = withMaster[index].masterName;
  return {
    title: scudettoTitle(master),
    letter: masterSurname(master).charAt(0).toLocaleUpperCase('it'),
    color: SCUDETTO_COLORS[index % SCUDETTO_COLORS.length],
  };
}
