// Seasonal look: the Christmas touch from 1 December to 6 January (Epiphany), Italian time.
// "?natale" in the address forces it on, to preview it in any month.
export type Festivity = 'natale' | null;

export function festivityOn(now: Date, search = ''): Festivity {
  if (/[?&]natale\b/.test(search)) return 'natale';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return month === 12 || (month === 1 && day <= 6) ? 'natale' : null;
}

export const festivity: Festivity =
  typeof window === 'undefined' ? null : festivityOn(new Date(), window.location.search);
