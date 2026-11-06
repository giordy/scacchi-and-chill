// When each player was last on Lichess (the profile's seenAt), shown as a coloured dot. It comes
// from the profile, not from the games, so the delay Lichess puts on ongoing games does not touch it.
// It tells that the player was on Lichess, not that they moved in the tournament game.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Presence = 'online' | 'recent' | 'away';

// What the public page knows: seenAt by lower-case handle, and when it was read
export interface PresenceInfo {
  seenAt: Record<string, number>;
  now: number;
}

export const seenAtOf = (presence: PresenceInfo | undefined, handle: string) => presence?.seenAt[handle.toLowerCase()];

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

// Lichess answers /api/users with the profiles it found, each with its seenAt: the map is keyed by
// lower-case handle, players without a profile or a seenAt are left out
export function seenAtFrom(users: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(users)) return out;
  for (const u of users) {
    const id = typeof u?.id === 'string' ? u.id : typeof u?.username === 'string' ? u.username.toLowerCase() : '';
    if (id && typeof u.seenAt === 'number' && u.seenAt > 0) out[id.toLowerCase()] = u.seenAt;
  }
  return out;
}

// Lichess takes up to 300 names per call
const MAX_USERS = 300;

export async function fetchSeenAt(handles: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < handles.length; i += MAX_USERS) {
    const res = await fetch('https://lichess.org/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
      body: handles.slice(i, i + MAX_USERS).join(','),
    });
    if (!res.ok) throw new Error(`Lichess ha risposto ${res.status}`);
    Object.assign(out, seenAtFrom(await res.json()));
  }
  return out;
}
