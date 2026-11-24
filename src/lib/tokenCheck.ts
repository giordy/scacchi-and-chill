// Whether the organizer's Lichess token still works (Impostazioni → Token Lichess), asked to Lichess
// when the organizer area opens and when the token changes: a token wrong, revoked, expired or
// without the Challenge permission is seen before creating a round, not when its challenges fail.

// The permission the open challenges need ("Create, accept, decline challenges" on Lichess)
export const CHALLENGE_SCOPE = 'challenge:write';
// A token that expires within these days is said ahead
export const EXPIRING_DAYS = 14;
const DAY_MS = 86400000;

// What Lichess says of a token (POST /api/token/test); null when it does not know it
export interface TokenInfo {
  userId?: string;
  scopes: string[];
  expires?: number; // ms; none for a token without expiry
}

export type TokenCheck =
  | { kind: 'invalid' } // wrong, revoked or expired
  | { kind: 'noChallenge'; userId?: string }
  | { kind: 'expiring'; userId?: string; expires: number }
  | { kind: 'ok'; userId?: string; expires?: number };

// The answer of /api/token/test for one token: { "<token>": { scopes, userId, expires } | null }
export function tokenInfoOf(body: unknown, token: string): TokenInfo | null {
  const entry = body && typeof body === 'object' ? (body as Record<string, unknown>)[token] : undefined;
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as { scopes?: unknown; userId?: unknown; expires?: unknown };
  return {
    ...(typeof e.userId === 'string' ? { userId: e.userId } : {}),
    scopes: typeof e.scopes === 'string' ? e.scopes.split(',').map((s) => s.trim()).filter(Boolean) : [],
    ...(typeof e.expires === 'number' && e.expires > 0 ? { expires: e.expires } : {}),
  };
}

export function tokenCheck(info: TokenInfo | null, now: number): TokenCheck {
  if (!info) return { kind: 'invalid' };
  const user = info.userId ? { userId: info.userId } : {};
  if (info.expires !== undefined && info.expires <= now) return { kind: 'invalid' };
  if (!info.scopes.includes(CHALLENGE_SCOPE)) return { kind: 'noChallenge', ...user };
  if (info.expires !== undefined && info.expires - now < EXPIRING_DAYS * DAY_MS) return { kind: 'expiring', ...user, expires: info.expires };
  return { kind: 'ok', ...user, ...(info.expires !== undefined ? { expires: info.expires } : {}) };
}

// "lunedì 7 dicembre"
export const formatDay = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms));

// The warning at the top of the organizer area; null when the token is fine
export function tokenWarning(check: TokenCheck | null): string | null {
  if (!check) return null;
  switch (check.kind) {
    case 'invalid':
      return 'Il token Lichess non vale più (sbagliato, revocato o scaduto): per creare le sfide ne serve uno nuovo.';
    case 'noChallenge':
      return 'Il token Lichess non ha il permesso Challenge: senza, le sfide non si creano. Creane uno nuovo con quel permesso.';
    case 'expiring':
      return `Il token Lichess scade ${formatDay(check.expires)}: creane uno nuovo prima del prossimo turno.`;
    default:
      return null;
  }
}
