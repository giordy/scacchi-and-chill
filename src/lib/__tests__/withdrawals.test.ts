import { describe, expect, it } from 'vitest';
import { applyWithdrawals, planWithdrawal, withdrawalNote, withdrawPlayer } from '../withdrawals';
import { computeStandings } from '../standings';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../../types';

const players: Player[] = ['anna', 'bruno', 'carla', 'dario'].map((h) => ({ handle: h, name: h.toUpperCase() }));
// Single round robin of 4: 3 games each
const schedule: ScheduledMatch[] = [
  { round: '1', white: 'anna', black: 'bruno' },
  { round: '1', white: 'carla', black: 'dario' },
  { round: '2', white: 'bruno', black: 'carla' },
  { round: '2', white: 'dario', black: 'anna' },
  { round: '3', white: 'anna', black: 'carla' },
  { round: '3', white: 'bruno', black: 'dario' },
];
const url = (id: string) => `https://lichess.org/${id}`;
const states: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'resign', winner: 'black' }, // Bruno beats Anna
  bbbbbbbb: { id: 'bbbbbbbb', status: 'mate', winner: 'white' }, // Carla beats Dario
  cccccccc: { id: 'cccccccc', status: 'resign', winner: 'white' }, // Bruno beats Carla
  dddddddd: { id: 'dddddddd', status: 'started' }, // Dario – Anna, still on
};
const history: HistoryGame[] = [
  { ...schedule[0], url: url('aaaaaaaa') },
  { ...schedule[1], url: url('bbbbbbbb') },
  { ...schedule[2], url: url('cccccccc') },
  { ...schedule[3], url: url('dddddddd') },
];
const points = (h: HistoryGame[], who = players) =>
  Object.fromEntries(computeStandings(who, h, states).standings.map((s) => [s.handle, s.points]));

describe('half rule', () => {
  it('annuls everything under half', () => {
    // Anna: 1 played (lost to Bruno) of 3
    const plan = planWithdrawal('anna', history, schedule, states);
    expect(plan).toMatchObject({ played: 1, total: 3, mode: 'annulled' });
    const ch = withdrawPlayer(players[0], plan, players, schedule);
    const view = applyWithdrawals(history, [ch.withdrawal]);
    expect(points(view, ch.players)).toEqual({ bruno: 1, carla: 1, dario: 0 }); // Bruno loses the win on Anna
    expect(ch.schedule.some((m) => m.white === 'anna' || m.black === 'anna')).toBe(false);
  });

  it('keeps the results from half on and gives the games left by forfeit', () => {
    // Bruno: 2 played of 3, Bruno – Dario left
    const plan = planWithdrawal('bruno', history, schedule, states);
    expect(plan).toMatchObject({ played: 2, total: 3, mode: 'forfeit' });
    const ch = withdrawPlayer(players[1], plan, players, schedule);
    const view = applyWithdrawals(history, [ch.withdrawal]);
    expect(points(view)).toMatchObject({ bruno: 2, dario: 1 });
    expect(view.find((g) => g.round === '3' && g.white === 'bruno')?.lichess).toMatchObject({ status: 'forfeit', winner: 'black' });
    expect(withdrawalNote('bruno', [ch.withdrawal])).toBe('ritirato');
  });

  it('turns a game still on into a forfeit', () => {
    const plan = planWithdrawal('dario', history, schedule, states);
    expect(plan).toMatchObject({ played: 1, total: 3, mode: 'annulled' });
    const forfeit = withdrawPlayer(players[3], { ...plan, mode: 'forfeit' }, players, schedule);
    const view = applyWithdrawals(history, [forfeit.withdrawal]);
    expect(view.find((g) => g.round === '2' && g.white === 'dario')).toMatchObject({ url: '', lichess: { winner: 'black' } });
  });
});

describe('substitute', () => {
  it('takes the place, the points and the games left', () => {
    const plan = planWithdrawal('anna', history, schedule, states);
    const elena = { handle: 'elena', name: 'ELENA' };
    const ch = withdrawPlayer(players[0], plan, players, schedule, elena);
    expect(ch.players.map((p) => p.handle)).toEqual(['elena', 'bruno', 'carla', 'dario']);
    expect(ch.schedule.filter((m) => m.white === 'elena' || m.black === 'elena').map((m) => m.round).sort()).toEqual(['2', '3']);
    expect(ch.deleteGames.map((g) => g.url)).toEqual([url('dddddddd')]); // to be created again for Elena
    const view = applyWithdrawals(history.filter((g) => !ch.deleteGames.includes(g)), [ch.withdrawal]);
    expect(view.find((g) => g.round === '1' && g.black === 'bruno')?.white).toBe('elena');
    expect(withdrawalNote('elena', [ch.withdrawal])).toBe('subentrato a ANNA');
  });
});
