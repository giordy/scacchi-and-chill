// A substitute replaced by another substitute, and someone who left coming back: every game stays
// with who played it on Lichess, in the archive (Elo del torneo, all-time table, head-to-heads) as in
// the half rule of a later withdrawal.
import { describe, expect, it } from 'vitest';
import { applyWithdrawals, planWithdrawal } from '../withdrawals';
import { buildSeasonArchive } from '../seasons';
import { eloSeasonFromArchive } from '../tournamentElo';
import { gamesByWhoPlayed, ownRows, playedBy } from '../departures';
import { HistoryGame, LichessExportGame, Player, Withdrawal } from '../../types';

const P = (h: string): Player => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) });
const on = (white: string, black: string) => ({ white: { user: { id: white } }, black: { user: { id: black } } });
const replaced = (from: string, to: string): Withdrawal => ({ handle: from, name: P(from).name, at: '2026-01-01', played: 1, total: 3, mode: 'replaced', replacedBy: P(to) });
const meta = (withdrawals: Withdrawal[]) => ({ title: 'T', season: 'S', description: '', withdrawals });

// The place of Bruno: round 1 Bruno, round 2 Zeno (for Bruno), round 3 Yuri (for Zeno)
const raw: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa' },
  { round: '1', white: 'carla', black: 'dario', url: 'https://lichess.org/dddddddd' },
  { round: '2', white: 'zeno', black: 'carla', url: 'https://lichess.org/bbbbbbbb' },
  { round: '3', white: 'anna', black: 'yuri', url: 'https://lichess.org/cccccccc' },
];
const states: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'black', players: on('anna', 'bruno'), lastMoveAt: 1 },
  dddddddd: { id: 'dddddddd', status: 'draw', players: on('carla', 'dario'), lastMoveAt: 1 },
  bbbbbbbb: { id: 'bbbbbbbb', status: 'resign', winner: 'white', players: on('zeno', 'carla'), lastMoveAt: 2 },
  cccccccc: { id: 'cccccccc', status: 'draw', players: on('anna', 'yuri'), lastMoveAt: 3 },
};
const chain = [replaced('bruno', 'zeno'), replaced('zeno', 'yuri')];
const players = ['anna', 'yuri', 'carla', 'dario'].map(P);

describe('a substitute replaced by another substitute', () => {
  const archive = buildSeasonArchive(meta(chain), players, applyWithdrawals(raw, chain), states);
  const pairs = (games: { round?: string; white: string; black: string }[]) => games.map((g) => `${g.round}:${g.white}-${g.black}`);

  it('the standings give the whole place to who holds it at the end', () => {
    expect(archive.standings.find((s) => s.handle === 'yuri')).toMatchObject({ played: 3, points: 2.5 });
    expect(archive.departures?.map((d) => [d.handle, d.fromRound])).toEqual([['bruno', '2'], ['zeno', '3']]);
  });

  it('the Elo del torneo and the head-to-heads give each game to who played it', () => {
    const expected = ['1:anna-bruno', '1:carla-dario', '2:zeno-carla', '3:anna-yuri'];
    expect(pairs(eloSeasonFromArchive(archive).games)).toEqual(expected);
    expect(pairs(gamesByWhoPlayed(archive.games!, archive.departures))).toEqual(expected);
  });

  it('the all-time table has a row for each of the three', () => {
    const rows = ownRows(archive.standings, archive.departures, archive.games);
    const of = (h: string) => rows.find((r) => r.handle === h);
    expect([of('bruno'), of('zeno'), of('yuri')].map((r) => r && [r.played, r.points])).toEqual([[1, 1], [1, 1], [1, 0.5]]);
    // Nothing lost or counted twice
    expect(rows.reduce((n, r) => n + r.played, 0)).toBe(archive.standings.reduce((n, r) => n + r.played, 0));
  });

  it('someone who left and came back as a substitute gets back only their own games', () => {
    const back = [replaced('bruno', 'zeno'), { ...replaced('zeno', 'bruno') }];
    const history = raw.map((g) => (g.round === '3' ? { ...g, black: 'bruno' } : g));
    const st = { ...states, cccccccc: { ...states.cccccccc, players: on('anna', 'bruno') } };
    const a = buildSeasonArchive(meta(back), ['anna', 'bruno', 'carla', 'dario'].map(P), applyWithdrawals(history, back), st);
    // Bruno is on the board in round 1 too: his return counts from round 3, after Zeno's start
    expect(a.departures?.map((d) => [d.handle, d.fromRound])).toEqual([['bruno', '2'], ['zeno', '3']]);
    expect(pairs(eloSeasonFromArchive(a).games)).toEqual(['1:anna-bruno', '1:carla-dario', '2:zeno-carla', '3:anna-bruno']);
    expect(playedBy(a.departures, 'bruno', '2')).toBe('zeno');
  });
});

describe('the half rule for a substitute who leaves', () => {
  // Yuri leaves with three games still to play: the place has played 3 of 6, half
  const schedule = [{ round: '4', white: 'yuri', black: 'dario' }, { round: '5', white: 'carla', black: 'yuri' }, { round: '6', white: 'yuri', black: 'anna' }];
  it('counts the games of the place, those of who held it before included', () => {
    const plan = planWithdrawal('yuri', raw, schedule, states, chain);
    expect([plan.played, plan.total, plan.mode]).toEqual([3, 6, 'forfeit']);
    expect(plan.open).toEqual(schedule);
    // Counting only Yuri's own game, he would be under half and the whole place annulled
    expect(planWithdrawal('yuri', raw, schedule, states).mode).toBe('annulled');
  });
  it('still deletes only the games created on Lichess for the player who leaves', () => {
    const open = { round: '4', white: 'yuri', black: 'dario', url: 'https://lichess.org/eeeeeeee' };
    const plan = planWithdrawal('yuri', [...raw, open], schedule, states, chain);
    expect(plan.created).toEqual([open]);
  });
});
