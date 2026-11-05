export const fill = (template: string, vars: Record<string, unknown>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

export const clampDays = (value: string | number, fallback: number) => {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(14, Math.max(1, n)) : fallback;
};

// Extracts 8-character game ID supporting lichess.org/ID, lichess.org/game/ID, lichess.org/challenge/ID, etc.
export function extractGameId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:(?:game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})/i);
  return match?.[1];
}

export function formatDeadline(ms: number) {
  // Round to nearest 10 minutes for natural readability (e.g. 15:40 instead of 15:37)
  const roundedMs = Math.round(ms / (10 * 60 * 1000)) * (10 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(roundedMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("weekday")} ${get("day")}/${get("month")} alle ${get("hour")}:${get("minute")}`;
}

export const HOW_WIN: Record<string, string> = {
  mate: "con il matto",
  resign: "per abbandono",
  outoftime: "per tempo scaduto",
  timeout: "per tempo scaduto",
  forfeit: "a tavolino",
};
export const HOW_DRAW: Record<string, string> = {
  stalemate: "per stallo",
};

export const tidy = (t: string) =>
  t.replace(/\(\s*\)/g, "").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n+/g, "\n").trim();

// Estimates the moves threshold for ongoing games (single thresholds: meno di 10, più di 10/20/30/40)
export function getApproxMoves(plies: number): { approxMoves: string; movesBand: string; phase: string } {
  const estimatedMoves = Math.max(1, Math.floor(plies / 2) + 1);
  if (estimatedMoves < 10) {
    return {
      approxMoves: "meno di 10 mosse",
      movesBand: "< 10 mosse",
      phase: "in apertura",
    };
  }
  if (estimatedMoves < 20) {
    return {
      approxMoves: "più di 10 mosse",
      movesBand: "> 10 mosse",
      phase: "nel mediogioco",
    };
  }
  if (estimatedMoves < 30) {
    return {
      approxMoves: "più di 20 mosse",
      movesBand: "> 20 mosse",
      phase: "nel vivo del gioco",
    };
  }
  if (estimatedMoves < 40) {
    return {
      approxMoves: "più di 30 mosse",
      movesBand: "> 30 mosse",
      phase: "fase avanzata",
    };
  }
  return {
    approxMoves: "più di 40 mosse",
    movesBand: "> 40 mosse",
    phase: "in pieno finale",
  };
}

// Readable message from anything thrown in a catch block
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : String(e);
}
