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

export async function fetchGameStates(ids: string[]): Promise<Record<string, LichessExportGame>> {
  if (ids.length === 0) return {};
  const res = await fetch("https://lichess.org/api/games/export/_ids?pgnInJson=false&lastFen=true&opening=true", {
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
