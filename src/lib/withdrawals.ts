import { HistoryGame, LichessExportGame, Player, ScheduledMatch, Withdrawal } from '../types';
import { gameProgress } from './progress';
import { isVoid, stateOf } from './games';

const same = (a: ScheduledMatch, b: ScheduledMatch) => a.round === b.round && a.white === b.white && a.black === b.black;
const involves = (g: { white: string; black: string }, handle: string) => g.white === handle || g.black === handle;

export interface WithdrawalPlan {
  played: number; // finished games that count
  total: number; // all the games of the player this season (calendar plus games created outside it)
  mode: 'annulled' | 'forfeit'; // the half rule: under half annulled, from half on forfeits
  open: ScheduledMatch[]; // games not finished yet: forfeits, or to hand to a substitute
  created: HistoryGame[]; // the open games already created on Lichess
}

// What the half rule gives for a player leaving now. The half is of the place in the standings: a
// substitute who leaves counts the games played before them by who they replaced (all of them,
// along a chain of substitutes), as the standings and an annulment do.
export function planWithdrawal(
  handle: string,
  history: HistoryGame[], // the games as stored
  schedule: ScheduledMatch[],
  gameStates: Record<string, LichessExportGame>,
  withdrawals?: Withdrawal[] // the season's earlier withdrawals
): WithdrawalPlan {
  // The games still on Lichess are those stored under the player's own name
  const created = history.filter((g) => involves(g, handle)).filter((g) => {
    const s = stateOf(g, gameStates);
    return !(gameProgress(s) === 'finished' && !isVoid(s));
  });
  const mine = applyWithdrawals(history, withdrawals).filter((g) => involves(g, handle));
  // Aborted games did not happen: they stay open like the ones never started
  const done = mine.filter((g) => {
    const s = stateOf(g, gameStates);
    return gameProgress(s) === 'finished' && !isVoid(s);
  });
  const all: ScheduledMatch[] = [
    ...schedule.filter((m) => involves(m, handle)),
    ...mine.filter((g) => !schedule.some((m) => same(m, g))).map(({ round, white, black }) => ({ round, white, black })),
  ];
  const played = done.length;
  const total = all.length;
  const open = all.filter((m) => !done.some((g) => same(m, g)));
  return { played, total, mode: played * 2 < total ? 'annulled' : 'forfeit', open, created };
}

// The season as the standings must see it, from the stored games and the withdrawals:
// - annulled: every game of the player is dropped;
// - forfeit: the games left become wins for the opponents (no Lichess link);
// - replaced: the substitute takes over the games already played by the player who left.
export function applyWithdrawals(history: HistoryGame[], withdrawals: Withdrawal[] | undefined): HistoryGame[] {
  let out = history;
  (withdrawals ?? []).forEach((w) => {
    if (w.mode === 'annulled') {
      out = out.filter((g) => !involves(g, w.handle));
    } else if (w.mode === 'forfeit') {
      const forfeits = w.forfeits ?? [];
      out = [
        ...out.filter((g) => !forfeits.some((f) => same(f, g))),
        ...forfeits.map((f) => ({
          ...f,
          url: '',
          lichess: { id: '', status: 'forfeit', winner: f.white === w.handle ? ('black' as const) : ('white' as const) },
        })),
      ];
    } else if (w.replacedBy) {
      const to = w.replacedBy.handle;
      out = out.map((g) =>
        involves(g, w.handle)
          ? { ...g, white: g.white === w.handle ? to : g.white, black: g.black === w.handle ? to : g.black }
          : g
      );
    }
  });
  return out;
}

// Label next to a name in the standings
export function withdrawalNote(handle: string, withdrawals: Withdrawal[] | undefined): string | undefined {
  const list = withdrawals ?? [];
  if (list.some((w) => w.mode === 'forfeit' && w.handle === handle)) return 'ritirato';
  const sub = list.find((w) => w.mode === 'replaced' && w.replacedBy?.handle === handle);
  return sub ? `subentrato a ${sub.name}` : undefined;
}

const rename = (m: ScheduledMatch, from: string, to: string): ScheduledMatch => ({
  ...m,
  white: m.white === from ? to : m.white,
  black: m.black === from ? to : m.black,
});

export interface WithdrawalChanges {
  withdrawal: Withdrawal;
  players: Player[];
  schedule: ScheduledMatch[];
  deleteGames: HistoryGame[]; // open games on Lichess that leave the tournament
}

// The data changes of a withdrawal, as one pure step: the caller saves them
export function withdrawPlayer(
  player: Player,
  plan: WithdrawalPlan,
  players: Player[],
  schedule: ScheduledMatch[],
  substitute?: Player,
  now: Date = new Date()
): WithdrawalChanges {
  const base = { handle: player.handle, name: player.name, played: plan.played, total: plan.total, at: now.toISOString() };
  const undo = { players, schedule };
  if (substitute) {
    // The substitute takes the place: same position in the list, the open games renamed;
    // games already created on Lichess must be created again for the substitute
    const renamed = plan.open.map((m) => rename(m, player.handle, substitute.handle));
    const kept = schedule.filter((m) => !plan.open.some((o) => same(o, m)));
    return {
      withdrawal: { ...base, mode: 'replaced', replacedBy: substitute },
      players: players.map((p) => (p.handle === player.handle ? substitute : p)),
      schedule: [...kept, ...renamed],
      deleteGames: plan.created,
    };
  }
  const leftSchedule = schedule.filter((m) => !plan.open.some((o) => same(o, m)));
  if (plan.mode === 'annulled') {
    return {
      withdrawal: { ...base, mode: 'annulled', undo },
      players: players.filter((p) => p.handle !== player.handle),
      // Every game of the player leaves the calendar, played ones too: they no longer count
      schedule: schedule.filter((m) => !involves(m, player.handle)),
      deleteGames: [],
    };
  }
  return {
    withdrawal: { ...base, mode: 'forfeit', forfeits: plan.open, undo },
    players,
    schedule: leftSchedule,
    deleteGames: [],
  };
}
