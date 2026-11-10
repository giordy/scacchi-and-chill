// Seasonal look: the Christmas touch from 1 December to 6 January (Epiphany), Italian time.
// "?christmas" in the address forces it on, to preview it in any month.
export type Holiday = 'christmas' | null;

export function holidayOn(now: Date, search = ''): Holiday {
  if (/[?&]christmas\b/.test(search)) return 'christmas';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return month === 12 || (month === 1 && day <= 6) ? 'christmas' : null;
}

export const holiday: Holiday =
  typeof window === 'undefined' ? null : holidayOn(new Date(), window.location.search);
