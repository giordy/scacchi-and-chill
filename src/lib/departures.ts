import { SeasonDeparture, Withdrawal } from '../types';
import type { NameOf } from './roster';

// The withdrawals of a season as the archive keeps them: no dates, no undo data
export const departuresOf = (withdrawals: Withdrawal[] | undefined): SeasonDeparture[] =>
  (withdrawals ?? []).map((w) => ({
    handle: w.handle,
    name: w.name,
    mode: w.mode,
    ...(w.mode === 'replaced' && w.replacedBy ? { replacedBy: { handle: w.replacedBy.handle, name: w.replacedBy.name } } : {}),
  }));

// The note under a past season's table
export function departureText(d: SeasonDeparture, nameOf: NameOf = (_h, f) => f ?? _h): string {
  const name = nameOf(d.handle, d.name);
  // A name may end with an initial ("Francesco S."): no second full stop
  if (d.mode === 'replaced' && d.replacedBy) return `${name} ha lasciato il torneo; al suo posto ha giocato ${nameOf(d.replacedBy.handle, d.replacedBy.name)}.`.replace(/\.\.$/, '.');
  if (d.mode === 'forfeit') return `${name} ha lasciato il torneo: le partite rimaste sono andate agli avversari.`;
  return `${name} ha lasciato il torneo: le sue partite sono state annullate.`;
}

// Whom a player replaced in a season, if anyone
export function replacedIn(departures: SeasonDeparture[] | undefined, handle: string): { handle: string; name: string } | undefined {
  const d = departures?.find((x) => x.replacedBy && x.replacedBy.handle.toLowerCase() === handle.toLowerCase());
  return d ? { handle: d.handle, name: d.name } : undefined;
}
