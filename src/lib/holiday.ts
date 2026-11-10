// Seasonal look, by the date in Italy. "?christmas", "?halloween" or "?easter" in the address
// forces one on, to preview it in any month.
//   christmas: 1 December - 6 January (Epiphany)
//   halloween: 20 October - 1 November
//   easter:    Palm Sunday - Easter Monday
export type Holiday = 'christmas' | 'halloween' | 'easter' | null;

const HOLIDAYS = ['christmas', 'halloween', 'easter'] as const;
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
  const today = Date.UTC(year, month - 1, day);
  const easter = easterSunday(year).getTime();
  if (today >= easter - 7 * DAY_MS && today <= easter + DAY_MS) return 'easter';
  return null;
}

export const holiday: Holiday =
  typeof window === 'undefined' ? null : holidayOn(new Date(), window.location.search);
