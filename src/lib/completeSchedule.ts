import { ScheduledMatch } from '../types';

// Completes a round robin that is already partly planned or played: the existing games are kept
// as they are (also in rounds that are only partly filled) and the missing pairs are spread over
// the free slots and new rounds, so that everybody plays once per round.
// Not every partial schedule can be completed: in that case it says so instead of producing a
// wrong schedule.

export type CompletionResult =
  | { ok: true; schedule: ScheduledMatch[]; added: ScheduledMatch[]; newRounds: string[] }
  | { ok: false; reason: string };

interface Options {
  double?: boolean;
  random?: () => number;
  maxSteps?: number;
}

const BYE = '\u0000riposo';
const key = (a: string, b: string) => (a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`);
const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

class TooComplex extends Error {}

export function completeSchedule(players: string[], existing: ScheduledMatch[], opts: Options = {}): CompletionResult {
  const { double = false, random = Math.random, maxSteps = 300000 } = opts;
  if (players.length < 2) return { ok: false, reason: 'Servono almeno due giocatori.' };

  // Same game listed twice (e.g. in the schedule and among the created games) counts once
  const seenGame = new Set<string>();
  const games = existing.filter((m) => {
    const k = `${m.round}\u0001${m.white}\u0001${m.black}`;
    if (seenGame.has(k)) return false;
    seenGame.add(k);
    return true;
  });

  const known = new Set(players);
  for (const m of games) {
    for (const p of [m.white, m.black]) {
      if (!known.has(p)) return { ok: false, reason: `«${p}» (turno ${m.round}) non è tra i giocatori del torneo.` };
    }
    if (m.white === m.black) return { ok: false, reason: `Nel turno ${m.round} ${m.white} gioca contro sé stesso.` };
  }
  const roundIds = [...new Set(games.map((m) => m.round))].sort(byRound);
  for (const r of roundIds) {
    const inRound = games.filter((m) => m.round === r).flatMap((m) => [m.white, m.black]);
    const twice = inRound.find((p, i) => inRound.indexOf(p) !== i);
    if (twice) return { ok: false, reason: `Nel turno ${r} ${twice} gioca due volte.` };
  }

  const roundsPerLeg = players.length % 2 === 0 ? players.length - 1 : players.length;

  try {
    if (!double) return solve(players, games, 1, random, maxSteps);

    // Andata: rounds 1..roundsPerLeg; ritorno: the rest
    const andata = games.filter((m) => Number(m.round) <= roundsPerLeg);
    const ritorno = games.filter((m) => !(Number(m.round) <= roundsPerLeg));
    const first = solve(players, andata, 1, random, maxSteps);
    if (!first.ok) return first;
    if (first.schedule.some((m) => Number(m.round) > roundsPerLeg)) {
      return { ok: false, reason: "L'andata ha già più turni di quanti ne servono: controlla la numerazione dei turni." };
    }
    if (ritorno.length === 0) {
      // Return leg not started yet: mirror of the andata with swapped colors
      const mirror = first.schedule.map((m) => ({
        round: String(Number(m.round) + roundsPerLeg),
        white: m.black,
        black: m.white,
      }));
      return {
        ok: true,
        schedule: [...first.schedule, ...mirror],
        added: [...first.added, ...mirror],
        newRounds: [...first.newRounds, ...new Set(mirror.map((m) => m.round))],
      };
    }
    const second = solve(players, [...first.schedule, ...ritorno], 2, random, maxSteps);
    if (!second.ok) return second;
    return { ...second, added: [...first.added, ...second.added], newRounds: [...first.newRounds, ...second.newRounds] };
  } catch (e) {
    if (e instanceof TooComplex) {
      return { ok: false, reason: 'Non ho trovato un completamento in tempi ragionevoli: prova a togliere qualche turno e riprova.' };
    }
    throw e;
  }
}

// legs: how many times each pair must meet in total (1 = andata only, 2 = andata and ritorno)
function solve(
  players: string[],
  games: ScheduledMatch[],
  legs: number,
  random: () => number,
  maxSteps: number
): CompletionResult {
  const odd = players.length % 2 === 1;
  const V = odd ? [...players, BYE] : [...players];
  const perRound = V.length / 2;

  // How many more times each pair (rest included, as a pair with BYE) must still meet
  const need = new Map<string, number>();
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) need.set(key(V[i], V[j]), legs);

  const roundIds = [...new Set(games.map((m) => m.round))].sort(byRound);
  const slots: { round: string; free: Set<string> }[] = [];
  for (const r of roundIds) {
    const inRound = games.filter((m) => m.round === r);
    const covered = new Set(inRound.flatMap((m) => [m.white, m.black]));
    const pairs = inRound.map((m) => key(m.white, m.black));
    // Odd players: a full round leaves exactly one player out, who rests
    if (odd && inRound.length === perRound - 1) {
      const resting = players.find((p) => !covered.has(p))!;
      pairs.push(key(resting, BYE));
      covered.add(resting).add(BYE);
    }
    for (const k of pairs) {
      const left = need.get(k)! - 1;
      if (left < 0) {
        const [a, b] = k.split('\u0001');
        return b === BYE || a === BYE
          ? { ok: false, reason: `${a === BYE ? b : a} riposa più volte del previsto.` }
          : { ok: false, reason: `${a} e ${b} si incontrano più volte del previsto (turno ${r}).` };
      }
      need.set(k, left);
    }
    const free = new Set(V.filter((v) => !covered.has(v)));
    if (free.size > 0) slots.push({ round: r, free });
  }

  // Every player still has to meet everyone left: one game per round, so the number of new rounds
  // must be the same for all of them
  const degree = (v: string) => V.reduce((n, u) => (u === v ? n : n + need.get(key(u, v))!), 0);
  const freeIn = (v: string) => slots.filter((s) => s.free.has(v)).length;
  const counts = new Set(V.map((v) => degree(v) - freeIn(v)));
  if (counts.size !== 1 || [...counts][0] < 0) {
    return {
      ok: false,
      reason:
        'I turni già presenti non si possono completare: qualcuno resterebbe senza avversari mentre altri devono ancora giocare. Controlla i turni incompleti.',
    };
  }
  const newCount = [...counts][0];

  // New rounds take the smallest free numbers
  const used = new Set(roundIds.map(Number));
  const newRounds: string[] = [];
  for (let n = 1; newRounds.length < newCount; n++) if (!used.has(n)) newRounds.push(String(n));
  newRounds.forEach((r) => slots.push({ round: r, free: new Set(V) }));

  // Backtracking: fill each slot with a perfect matching of its free players
  let steps = 0;
  const chosen: { round: string; a: string; b: string }[] = [];
  const shuffle = <T,>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const fill = (slot: number, free: Set<string>): boolean => {
    if (++steps > maxSteps) throw new TooComplex();
    if (free.size === 0) return slot + 1 >= slots.length || fill(slot + 1, new Set(slots[slot + 1].free));
    // Most constrained player first
    let pick = '';
    let options: string[] = [];
    for (const v of free) {
      const opts = [...free].filter((u) => u !== v && need.get(key(u, v))! > 0);
      if (!pick || opts.length < options.length) {
        pick = v;
        options = opts;
        if (opts.length === 0) return false;
      }
    }
    for (const u of shuffle(options)) {
      const k = key(pick, u);
      need.set(k, need.get(k)! - 1);
      chosen.push({ round: slots[slot].round, a: pick, b: u });
      const rest = new Set(free);
      rest.delete(pick);
      rest.delete(u);
      if (fill(slot, rest)) return true;
      chosen.pop();
      need.set(k, need.get(k)! + 1);
    }
    return false;
  };

  const realGames = () => chosen.filter((g) => g.a !== BYE && g.b !== BYE);

  // The search is exhaustive: if the first attempt finds nothing, no completion exists.
  // Further attempts only look for a distribution with better colors.
  const baseline = new Map(need);
  let best: { added: ScheduledMatch[]; cost: number } | null = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    need.clear();
    baseline.forEach((v, k) => need.set(k, v));
    chosen.length = 0;
    steps = 0;
    let found: boolean;
    try {
      found = slots.length === 0 || fill(0, new Set(slots[0].free));
    } catch (e) {
      if (e instanceof TooComplex && best) break;
      throw e;
    }
    if (!found) {
      if (best) break;
      return {
        ok: false,
        reason:
          'Non esiste un modo di completare il girone partendo dai turni già presenti: gli accoppiamenti rimasti non si possono dividere in turni completi. Togli o cambia qualche turno e riprova.',
      };
    }
    const added = assignColors(games, realGames(), random);
    const cost = colorCost([...games, ...added]);
    if (!best || cost < best.cost) best = { added, cost };
    if (cost === 0) break;
  }

  const added = best!.added;
  const schedule = [...games, ...added].sort((x, y) => byRound(x.round, y.round));
  return { ok: true, schedule, added, newRounds };
}

// Penalty of a schedule's colors: three or more equal colors in a row weigh most,
// then whites and blacks differing by more than one
function colorCost(games: ScheduledMatch[]): number {
  const seq = new Map<string, string>();
  [...games]
    .sort((x, y) => byRound(x.round, y.round))
    .forEach((m) => {
      seq.set(m.white, (seq.get(m.white) ?? '') + 'W');
      seq.set(m.black, (seq.get(m.black) ?? '') + 'B');
    });
  let cost = 0;
  seq.forEach((colors) => {
    for (const run of colors.match(/W+|B+/g) ?? []) if (run.length >= 3) cost += (run.length - 2) * 10;
    const whites = colors.split('W').length - 1;
    const diff = Math.abs(whites - (colors.length - whites));
    if (diff > 1) cost += (diff - 1) * 3;
  });
  return cost;
}

// Colors of the new games: a rematch swaps the colors of the first game; the others start from
// a balanced guess and are then flipped one by one while that lowers the color penalty
function assignColors(
  fixed: ScheduledMatch[],
  newGames: { round: string; a: string; b: string }[],
  random: () => number
): ScheduledMatch[] {
  const firstMeeting = new Map<string, ScheduledMatch>();
  [...fixed].sort((x, y) => byRound(x.round, y.round)).forEach((m) => {
    if (!firstMeeting.has(key(m.white, m.black))) firstMeeting.set(key(m.white, m.black), m);
  });

  const sorted = [...newGames].sort((x, y) => byRound(x.round, y.round));
  const out: ScheduledMatch[] = [];
  const locked: boolean[] = [];
  for (const g of sorted) {
    const before = firstMeeting.get(key(g.a, g.b));
    if (before) {
      out.push({ round: g.round, white: before.black, black: before.white });
      locked.push(true);
    } else {
      const m = random() < 0.5 ? { round: g.round, white: g.a, black: g.b } : { round: g.round, white: g.b, black: g.a };
      out.push(m);
      locked.push(false);
      firstMeeting.set(key(g.a, g.b), m);
    }
  }

  let cost = colorCost([...fixed, ...out]);
  for (let pass = 0; pass < 50 && cost > 0; pass++) {
    let improved = false;
    for (let i = 0; i < out.length; i++) {
      if (locked[i]) continue;
      const flipped = { round: out[i].round, white: out[i].black, black: out[i].white };
      const previous = out[i];
      out[i] = flipped;
      const c = colorCost([...fixed, ...out]);
      if (c < cost) {
        cost = c;
        improved = true;
      } else {
        out[i] = previous;
      }
    }
    if (!improved) break;
  }
  return out;
}
