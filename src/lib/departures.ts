import { SeasonDeparture, Withdrawal } from '../types';

// The withdrawals of a season as the archive keeps them: no dates, no undo data
export const departuresOf = (withdrawals: Withdrawal[] | undefined): SeasonDeparture[] =>
  (withdrawals ?? []).map((w) => ({
    handle: w.handle,
    name: w.name,
    mode: w.mode,
    ...(w.mode === 'replaced' && w.replacedBy ? { replacedBy: { handle: w.replacedBy.handle, name: w.replacedBy.name } } : {}),
  }));

// The note under a past season's table
export function departureText(d: SeasonDeparture): string {
  if (d.mode === 'replaced' && d.replacedBy) return `${d.name} ha lasciato il torneo; al suo posto ha giocato ${d.replacedBy.name}.`;
  if (d.mode === 'forfeit') return `${d.name} ha lasciato il torneo: le partite rimaste sono andate agli avversari.`;
  return `${d.name} ha lasciato il torneo: le sue partite sono state annullate.`;
}

// Whom a player replaced in a season, if anyone
export const replacedIn = (departures: SeasonDeparture[] | undefined, handle: string): string | undefined =>
  departures?.find((d) => d.replacedBy && d.replacedBy.handle.toLowerCase() === handle.toLowerCase())?.name;
