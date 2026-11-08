import {
  GamePair,
  Settings,
  LichessExportGame,
} from '../types';
import { RULES } from './config';
import { fill } from './utils';

export async function createChallenge(
  pair: GamePair,
  {
    round,
    settings,
    challengeName,
  }: { round: string; settings: Settings; challengeName: string }
): Promise<string> {
  const body = new URLSearchParams({
    users: `${pair.white},${pair.black}`,
    rated: String(settings.rated),
    days: String(settings.days),
    name: fill(challengeName, { round }),
    expiresAt: String(Date.now() + settings.expiry * 86400000),
  });

  const rules = RULES.map((r) => r.key).filter((key) => settings.rules?.[key]);
  if (rules.length > 0) body.set("rules", rules.join(","));

  const res = await fetch("https://lichess.org/api/challenge/open", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + settings.token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    const hint =
      res.status === 401
        ? "Token non valido o scaduto."
        : res.status === 429
        ? "Limite richieste Lichess: attendi un minuto e riprova."
        : "";
    throw new Error(`HTTP ${res.status}. ${hint} ${detail}`.trim());
  }

  const data = await res.json();
  const url = (data.challenge ?? data).url;
  if (!url) throw new Error("Lichess non ha restituito un link.");
  return url;
}

// Cancels an open challenge created with the organizer's token (a challenge replaced by a new
// link must not stay acceptable). Best effort: true when Lichess confirmed.
export async function cancelChallenge(id: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://lichess.org/api/challenge/${id}/cancel`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Lichess exports up to 300 games per call
const MAX_GAMES = 300;

export async function fetchGameStates(ids: string[]): Promise<Record<string, LichessExportGame>> {
  if (ids.length === 0) return {};
  if (ids.length > MAX_GAMES) {
    const states: Record<string, LichessExportGame> = {};
    for (let i = 0; i < ids.length; i += MAX_GAMES) Object.assign(states, await fetchGameStates(ids.slice(i, i + MAX_GAMES)));
    return states;
  }
  const res = await fetch("https://lichess.org/api/games/export/_ids?pgnInJson=false&lastFen=true&opening=true&division=true", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/x-ndjson" },
    body: ids.join(","),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const states: Record<string, LichessExportGame> = {};
  const text = await res.text();
  text
    .split("\n")
    .filter((l) => l.trim())
    .forEach((line) => {
      try {
        const g = JSON.parse(line);
        if (g.id) states[g.id] = g;
      } catch {
        // ignore
      }
    });
  return states;
}

// Lichess takes up to 300 names per call
const MAX_USERS = 300;

// The public profiles of many players in one call (flair, seenAt...), instead of one call
// per player; players Lichess does not know are left out
export async function fetchUsers(handles: string[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let i = 0; i < handles.length; i += MAX_USERS) {
    const res = await fetch("https://lichess.org/api/users", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Accept: "application/json" },
      body: handles.slice(i, i + MAX_USERS).join(","),
    });
    if (!res.ok) throw new Error(`Lichess ha risposto ${res.status}`);
    const users = await res.json();
    if (Array.isArray(users)) out.push(...users);
  }
  return out;
}

// A player's Lichess rating history, every kind (see lib/seeds.ts); empty for a player Lichess does
// not know
export async function fetchRatingHistory(handle: string): Promise<unknown> {
  const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(handle)}/rating-history`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Lichess ha risposto ${res.status}`);
  return res.json();
}
