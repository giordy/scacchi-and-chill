import { ArchivedGame, SeasonDeparture, Withdrawal } from '../types';
import type { NameOf } from './roster';
import { byRound } from './games';

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

// After a replacement the standings give the substitute the games already played by who left.
// With the substitute's first round (or, for older archives, the day they started) those games can
// go back to who played them; without it they stay with the substitute.
export const startKnown = (d: SeasonDeparture) => !!d.replacedBy && (!!d.fromRound || !!d.fromDate);

// Whether a game of the substitute's place was played by who left. Rounds are known only for
// seasons archived since they were kept ("–" before): the day, then.
export function beforeSubstitute(d: SeasonDeparture, round: string, end?: number): boolean {
  if (d.fromRound && /\d/.test(round)) return byRound(round, d.fromRound) < 0;
  return !!d.fromDate && end !== undefined && end < Date.parse(d.fromDate);
}

// Who actually played a game of a place: the standings give every game of a place to who holds it
// at the end, through any chain of substitutes (Bruno, then Zeno for him, then Yuri for Zeno). Going
// back from the latest replacement to the first, each one gives back the games before its start; once
// is enough, also when someone who left comes back as a substitute later.
export function playedBy(departures: SeasonDeparture[] | undefined, handle: string, round: string, end?: number): string {
  const replaced = (departures ?? []).filter((d) => d.mode === 'replaced' && startKnown(d));
  let who = handle;
  for (let i = replaced.length - 1; i >= 0; i--) {
    const d = replaced[i];
    if (d.replacedBy!.handle.toLowerCase() === who.toLowerCase() && beforeSubstitute(d, round, end)) who = d.handle;
  }
  return who;
}

export interface OwnRow {
  handle: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

// The rows of a season's table by who actually played: the games of a substitute's place played
// before they took over move to a row of their own for who left (each one, along a chain of
// substitutes). The official table (places, tie-breaks) stays as it is; this is for figures summed
// per player, as the all-time table.
export function ownRows<T extends OwnRow>(standings: T[], departures: SeasonDeparture[] | undefined, games: ArchivedGame[] | undefined): OwnRow[] {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const replaced = (departures ?? []).filter((d) => d.mode === 'replaced' && startKnown(d));
  if (replaced.length === 0 || !games || games.length === 0) return standings;
  const rows: OwnRow[] = standings.map((s) => ({ ...s }));
  const added: OwnRow[] = [];
  games.forEach((g) => {
    ([true, false] as const).forEach((white) => {
      const place = white ? g.white : g.black;
      const who = playedBy(replaced, place, g.round, g.end);
      if (same(who, place)) return;
      const from = rows.find((r) => same(r.handle, place));
      if (!from) return;
      let to = [...rows, ...added].find((r) => same(r.handle, who));
      if (!to) {
        const d = replaced.find((x) => same(x.handle, who));
        to = { handle: d?.handle ?? who, name: d?.name ?? who, played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
        added.push(to);
      }
      const score = g.result === '½-½' ? 0.5 : (g.result === '1-0') === white ? 1 : 0;
      const key = score === 1 ? 'won' : score === 0 ? 'lost' : 'drawn';
      [to, from].forEach((r, i) => {
        const sign = i === 0 ? 1 : -1;
        r.played += sign;
        r[key] += sign;
        r.points += sign * score;
      });
    });
  });
  // Who left, in the order they left
  const order = (r: OwnRow) => replaced.findIndex((d) => same(d.handle, r.handle));
  return [...rows, ...added.sort((x, y) => order(x) - order(y))];
}

// The games of a season with who actually played them: those of a substitute's place before they
// took over go to who left (head-to-heads and records across seasons)
export function gamesByWhoPlayed(games: ArchivedGame[], departures: SeasonDeparture[] | undefined): ArchivedGame[] {
  if (!(departures ?? []).some((d) => d.mode === 'replaced' && startKnown(d))) return games;
  return games.map((g) => ({ ...g, white: playedBy(departures, g.white, g.round, g.end), black: playedBy(departures, g.black, g.round, g.end) }));
}
