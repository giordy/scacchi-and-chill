// Seasonal look, by the date in Italy. "?christmas", "?halloween", "?easter", "?chess-day",
// "?carnival" or "?season-end" in the address forces one on, to preview it in any month.
//   christmas:  1 December - 6 January (Epiphany)
//   carnival:   Fat Thursday - Shrove Tuesday (52 to 47 days before Easter)
//   easter:     Palm Sunday - Easter Monday
//   chess-day:  18 - 21 July (World Chess Day is 20 July, when FIDE was founded in 1924)
//   halloween:  20 October - 1 November
//   season-end: not from the calendar, the public page turns it on when the season is over
export type Holiday = 'christmas' | 'carnival' | 'easter' | 'chess-day' | 'halloween' | 'season-end' | null;

const HOLIDAYS = ['christmas', 'carnival', 'easter', 'chess-day', 'halloween', 'season-end'] as const;
const DAY_MS = 86_400_000;

// Gregorian Easter Sunday (anonymous Gregorian algorithm), as a UTC midnight
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function holidayOn(now: Date, search = ''): Holiday {
  const forced = HOLIDAYS.find((h) => new RegExp(`[?&]${h}\\b`).test(search));
  if (forced) return forced;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const [year, month, day] = [part('year'), part('month'), part('day')];

  if (month === 12 || (month === 1 && day <= 6)) return 'christmas';
  if ((month === 10 && day >= 20) || (month === 11 && day === 1)) return 'halloween';
  if (month === 7 && day >= 18 && day <= 21) return 'chess-day';
  const today = Date.UTC(year, month - 1, day);
  const easter = easterSunday(year).getTime();
  const fromEaster = (today - easter) / DAY_MS;
  if (fromEaster >= -7 && fromEaster <= 1) return 'easter';
  if (fromEaster >= -52 && fromEaster <= -47) return 'carnival';
  return null;
}

export const holiday: Holiday =
  typeof window === 'undefined' ? null : holidayOn(new Date(), window.location.search);

// Days the season-end celebration lasts after the organizer closes the season
export const SEASON_END_DAYS = 14;

// The season is over: every game played, or closed less than SEASON_END_DAYS ago with the new
// season not yet under way
export function seasonEndOn(
  now: Date,
  progress: { finished: number; ongoing: number; total: number },
  lastArchivedAt?: string
): boolean {
  if (progress.total > 0 && progress.finished === progress.total) return true;
  if (!lastArchivedAt || progress.finished > 0 || progress.ongoing > 0) return false;
  const since = now.getTime() - Date.parse(lastArchivedAt);
  return since >= 0 && since <= SEASON_END_DAYS * DAY_MS;
}

// The holiday whose decorations are on the page: CSS reads it from <html data-holiday>
export function showHoliday(h: Holiday) {
  if (typeof document === 'undefined') return;
  if (h) document.documentElement.dataset.holiday = h;
  else delete document.documentElement.dataset.holiday;
}
