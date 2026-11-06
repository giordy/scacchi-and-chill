// When each player was last on Lichess (the profile's seenAt), shown as a coloured dot. It comes
// from the profile, not from the games, so the delay Lichess puts on ongoing games does not touch it.
// It tells that the player was on Lichess, not that they moved in the tournament game.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Presence = 'online' | 'recent' | 'away';

// What the public page reads from the players' Lichess profiles, by lower-case handle: when each
// was last on Lichess and their flair; now is when it was read
export interface PresenceInfo {
  seenAt: Record<string, number>;
  flair: Record<string, string>;
  now: number;
}

export const seenAtOf = (presence: PresenceInfo | undefined, handle: string) => presence?.seenAt[handle.toLowerCase()];
export const profileFlairOf = (presence: PresenceInfo | undefined, handle: string) => presence?.flair[handle.toLowerCase()];

// Green within the hour, yellow within the day, grey beyond: the tournament moves in days
export function presenceOf(seenAt: number, now = Date.now()): Presence {
  const ago = now - seenAt;
  if (ago < HOUR) return 'online';
  if (ago < DAY) return 'recent';
  return 'away';
}

// "poco fa", "20 minuti fa", "un'ora fa", "5 ore fa", "ieri", "3 giorni fa", "più di un mese fa"
export function agoLabel(seenAt: number, now = Date.now()): string {
  const ago = Math.max(0, now - seenAt);
  if (ago < 5 * MINUTE) return 'poco fa';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} minuti fa`;
  if (ago < 2 * HOUR) return "un'ora fa";
  if (ago < DAY) return `${Math.floor(ago / HOUR)} ore fa`;
  if (ago < 2 * DAY) return 'ieri';
  if (ago < 31 * DAY) return `${Math.floor(ago / DAY)} giorni fa`;
  return 'più di un mese fa';
}

// Lower-case handle of a profile in the /api/users answer
export const userKey = (u: any): string =>
  typeof u?.id === 'string' ? u.id.toLowerCase() : typeof u?.username === 'string' ? u.username.toLowerCase() : '';

// From the /api/users answer: seenAt and flair by lower-case handle, players without them left out
export function presenceFrom(users: unknown[]): Omit<PresenceInfo, 'now'> {
  const seenAt: Record<string, number> = {};
  const flair: Record<string, string> = {};
  for (const u of users as any[]) {
    const id = userKey(u);
    if (!id) continue;
    if (typeof u.seenAt === 'number' && u.seenAt > 0) seenAt[id] = u.seenAt;
    if (typeof u.flair === 'string' && u.flair) flair[id] = u.flair;
  }
  return { seenAt, flair };
}
