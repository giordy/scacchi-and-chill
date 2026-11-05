import { describe, expect, it } from 'vitest';
import { awardsMessage, computeSeasonAwards, estimateMoveTimes } from '../awards';
import { buildSeasonArchive } from '../seasons';
import { HistoryGame, LichessExportGame, Player } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
  { name: 'Carla', handle: 'carla' },
];
const H = 3600 * 1000;
const g = (white: string, black: string, id: string): HistoryGame => ({ round: '1', white, black, url: `https://lichess.org/${id}` });
// plies half-moves played over `hours`
const st = (id: string, status: string, plies: number, hours: number, winner?: 'white' | 'black'): LichessExportGame => ({
  id,
  status,
  winner,
  moves: Array(plies).fill('e4').join(' '),
  createdAt: 1000,
  lastMoveAt: 1000 + hours * H,
});

describe('computeSeasonAwards', () => {
  const history = [
    g('anna', 'bruno', 'aaaaaaaa'),
    g('bruno', 'carla', 'bbbbbbbb'),
    g('carla', 'anna', 'cccccccc'),
    g('anna', 'carla', 'dddddddd'),
    g('bruno', 'anna', 'eeeeeeee'),
  ];
  const gs = {
    aaaaaaaa: st('aaaaaaaa', 'mate', 40, 20, 'white'), // Anna mates in 20
    bbbbbbbb: st('bbbbbbbb', 'draw', 120, 600), // longest, slowest
    cccccccc: st('cccccccc', 'mate', 51, 25, 'black'), // Anna mates in 26
    dddddddd: st('dddddddd', 'resign', 30, 15, 'black'), // Carla wins in 15
    eeeeeeee: st('eeeeeeee', 'started', 10, 5), // ongoing: ignored
  };
  const awards = computeSeasonAwards(players, history, gs);
  const byId = Object.fromEntries(awards.map((a) => [a.id, a]));
  const winners = (id: string) => byId[id].winners.map((w) => w.handle);

  it('gives each award to the right players with a readable detail', () => {
    expect(winners('mate')).toEqual(['anna']);
    expect(byId.mate.detail).toBe('2 vittorie col matto');
    expect(winners('fastest')).toEqual(['carla']);
    expect(byId.fastest.detail).toBe('in 15 mosse'); // the loser is not named
    expect(winners('longest')).toEqual(['anna']); // the draw is longer, but only wins count
    expect(byId.longest.detail).toBe('in 26 mosse contro Carla');
    expect(winners('draws')).toEqual(['bruno', 'carla']);
    expect(byId.draws.detail).toBe('1 patta');
  });

  it('leaves out awards nobody earned', () => {
    const only = computeSeasonAwards(players, [g('anna', 'bruno', 'aaaaaaaa')], {
      aaaaaaaa: st('aaaaaaaa', 'resign', 20, 10, 'white'),
    });
    expect(only.map((a) => a.id)).toEqual(['fastest', 'longest']); // one game: no bradipo
    expect(computeSeasonAwards(players, [], {})).toEqual([]);
  });

  it('writes the WhatsApp message and is saved in the season archive', () => {
    expect(awardsMessage('Stagione 2', awards).split('\n').slice(0, 3)).toEqual([
      '🏆 *I premi di Stagione 2*',
      '',
      '👑 *Re del matto*: Anna (2 vittorie col matto)',
    ]);
    expect(awardsMessage('S', [byId.draws])).toContain('Bruno e Carla (1 patta)');
    const archive = buildSeasonArchive({ title: 'T', season: 'S', description: '' }, players, history, gs);
    expect(archive.awards).toEqual(awards);
  });
});

describe('il bradipo', () => {
  const players4: Player[] = [...players, { name: 'Dario', handle: 'dario' }];
  // True time per own move, in hours: Anna is the slowest, Dario a bit less
  const own: Record<string, number> = { anna: 3, bruno: 1, carla: 1, dario: 2.4 };
  // Anna mostly meets the quick Bruno and Carla, Dario meets Anna twice: Dario's games are the slowest
  const pairs = [
    ['anna', 'bruno'], ['anna', 'carla'], ['bruno', 'anna'], ['carla', 'anna'],
    ['dario', 'anna'], ['anna', 'dario'], ['dario', 'bruno'], ['bruno', 'carla'],
  ];
  const history = pairs.map(([w, b], i) => g(w, b, `game000${i}`));
  const gs = Object.fromEntries(
    pairs.map(([w, b], i) => [`game000${i}`, st(`game000${i}`, 'resign', 40, 20 * (own[w] + own[b]), 'white')])
  );

  it("finds the slowest player even when another one's games are slower", () => {
    const sloth = computeSeasonAwards(players4, history, gs).find((a) => a.id === 'slowest')!;
    expect(sloth.winners.map((w) => w.handle)).toEqual(['anna']);
    expect(sloth.detail).toBe('circa 3 h per ogni sua mossa');
  });

  it('recovers each own time per move', () => {
    const t = estimateMoveTimes(
      pairs.map(([w, b]) => ({ white: w, black: b, plies: 40, ms: 20 * (own[w] + own[b]) * H }))
    )!;
    Object.entries(own).forEach(([h, hours]) => expect(t.get(h)! / H).toBeCloseTo(hours, 6));
  });

  it('counts the turn a player let run out when losing on time', () => {
    // Carla let a 7-day turn run out twice: (60 moves × 1 h + 2 × 168 h) / 62 moves ≈ 6.4 h
    const withTimeouts = {
      ...gs,
      game0001: { ...gs.game0001, status: 'outoftime', daysPerTurn: 7 }, // Anna – Carla, 1-0
      game0007: { ...gs.game0007, status: 'outoftime', daysPerTurn: 7 }, // Bruno – Carla, 1-0
    };
    const sloth = computeSeasonAwards(players4, history, withTimeouts).find((a) => a.id === 'slowest')!;
    expect(sloth.winners.map((w) => w.handle)).toEqual(['carla']);
    expect(sloth.detail).toBe('circa 6 h per ogni sua mossa');
  });

  it('gives no award when the games cannot tell the players apart', () => {
    // Two groups that only met across (Anna, Carla vs Bruno, Dario): only sums of times are known
    const square = [['anna', 'bruno'], ['carla', 'bruno'], ['carla', 'dario'], ['anna', 'dario']];
    expect(estimateMoveTimes(square.map(([w, b]) => ({ white: w, black: b, plies: 40, ms: 40 * H })))).toBeNull();
    const h = square.map(([w, b], i) => g(w, b, `sq00000${i}`));
    const s = Object.fromEntries(square.map((_, i) => [`sq00000${i}`, st(`sq00000${i}`, 'resign', 40, 40, 'white')]));
    expect(computeSeasonAwards(players4, [...h, ...h], s).some((a) => a.id === 'slowest')).toBe(false);
  });
});
