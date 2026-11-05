import { ScheduledMatch } from '../types';

// Round robin ("girone all'italiana") with the circle method and Berger-style colors:
// every player meets every other once, whites and blacks differ by at most one
// and nobody gets the same color more than twice in a row.
// With an odd number of players one player rests each round.
// double: second half with the same pairings and swapped colors ("andata e ritorno").
export function roundRobin(handles: string[], { double = false }: { double?: boolean } = {}): ScheduledMatch[] {
  if (handles.length < 2) return [];
  const arr: (string | null)[] = [...handles];
  if (arr.length % 2 === 1) arr.push(null); // null = rest
  const n = arr.length;

  const firstHalf: ScheduledMatch[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      // The last player stays fixed and alternates colors; the others are white when i is odd
      const aWhite = i === 0 ? r % 2 === 0 : i % 2 === 1;
      firstHalf.push({ round: String(r + 1), white: aWhite ? a : b, black: aWhite ? b : a });
    }
    // Rotate everyone except the fixed last player
    arr.splice(0, n - 1, arr[n - 2], ...arr.slice(0, n - 2));
  }

  if (!double) return firstHalf;
  const rounds = n - 1;
  return [
    ...firstHalf,
    ...firstHalf.map((m) => ({ round: String(Number(m.round) + rounds), white: m.black, black: m.white })),
  ];
}

// Fisher-Yates: random order of the players before building the schedule
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
