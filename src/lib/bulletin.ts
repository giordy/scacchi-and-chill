import { PlayerStanding } from './standings';

const DAY_MS = 86400000;

// When the round's Lichess links expire: the challenges were created with an expiry counted from
// their creation, so the deadline comes from the oldest created game, not from when the message is
// written. Without a creation time it falls back to now (the links are about to be created).
export function roundDeadline(games: { createdAt?: number }[], expiryDays: number, now = Date.now()): number {
  const created = games.map((g) => g.createdAt).filter((t): t is number => typeof t === 'number' && t > 0);
  const start = created.length > 0 ? Math.min(...created) : now;
  return start + expiryDays * DAY_MS;
}

// "3 finite · 1 in corso": only the non-zero parts, with the right singular
export function roundSummary(count: { finished: number; ongoing: number; pending: number }): string {
  const parts: string[] = [];
  if (count.finished > 0) parts.push(`${count.finished} ${count.finished === 1 ? 'finita' : 'finite'}`);
  if (count.ongoing > 0) parts.push(`${count.ongoing} in corso`);
  if (count.pending > 0) parts.push(`${count.pending} da avviare`);
  return parts.join(' · ');
}

const pts = (n: number) => {
  const s = String(n).replace('.5', '½').replace(/^0½/, '½');
  return `${s} ${n === 1 ? 'punto' : 'punti'}`;
};

// Who leads, as on the site's hero; ties on points are named together instead of picking one
export function leaderLine(standings: PlayerStanding[]): string {
  const top = standings[0];
  if (!top || top.points <= 0) return '';
  const tied = standings.filter((s) => s.points === top.points);
  if (tied.length === 1) return `🥇 In testa ${top.name} con ${pts(top.points)}.`;
  if (tied.length > 3) return '';
  const names = tied.map((s) => s.name);
  const list = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `🥇 In testa a pari punti ${list}, con ${pts(top.points)}.`;
}
