// Color of the felt band at the top of the public page, chosen for each tournament season in the
// organizer area. Green felt is the default (and the color of the logo and the app icon); the
// others are dark and muted like it, so the ivory text, the brass and the holiday decorations
// read the same on all of them.
export const SEASON_COLORS = [
  { key: 'green', label: 'Verde panno' },
  { key: 'navy', label: 'Blu notte' },
  { key: 'bordeaux', label: 'Bordeaux' },
  { key: 'walnut', label: 'Noce' },
] as const;

export type SeasonColor = (typeof SEASON_COLORS)[number]['key'];

export const DEFAULT_SEASON_COLOR: SeasonColor = 'green';

export const isSeasonColor = (value: unknown): value is SeasonColor =>
  SEASON_COLORS.some((c) => c.key === value);
