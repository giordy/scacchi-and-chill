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

// Cleans a filled phrase: empty brackets, double spaces, blank lines, and the space an empty
// variable leaves before a colon or comma ("Patta {details}: …" without details)
export const tidy = (t: string) =>
  t
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([:,])/g, "$1")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();

// Lichess hides up to this many of the latest half-moves of an ongoing game (anti-cheat)
export const HIDDEN_PLIES = 3;

const MOVE_THRESHOLDS = [10, 20, 30, 40];
const AROUND = ["una decina", "una ventina", "una trentina", "una quarantina"];
const PHASES = ["in apertura", "nel mediogioco", "nel vivo del gioco", "fase avanzata", "in pieno finale"];

// Moves band of an ongoing game from the half-moves Lichess shows. The real moves (as players count
// them) are between the visible ones and the visible ones plus the hidden half-moves, so the band
// only says what holds for all of them: "meno di 10", "più di 10/20/30/40", or "una decina/
// ventina/..." when the real count may sit on either side of a threshold.
export function getApproxMoves(plies: number): { approxMoves: string; movesBand: string; phase: string } {
  const fewest = Math.ceil(plies / 2);
  const most = Math.ceil((plies + HIDDEN_PLIES) / 2);
  const passed = MOVE_THRESHOLDS.filter((n) => fewest > n).length; // thresholds surely passed
  const phase = PHASES[passed];
  const around = MOVE_THRESHOLDS.findIndex((n) => fewest <= n && n <= most);
  if (around >= 0) {
    const n = MOVE_THRESHOLDS[around];
    return { approxMoves: `${AROUND[around]} di mosse`, movesBand: `~${n} mosse`, phase };
  }
  if (passed === 0) return { approxMoves: "meno di 10 mosse", movesBand: "< 10 mosse", phase };
  const n = MOVE_THRESHOLDS[passed - 1];
  return { approxMoves: `più di ${n} mosse`, movesBand: `> ${n} mosse`, phase };
}

// Readable message from anything thrown in a catch block
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : String(e);
}
