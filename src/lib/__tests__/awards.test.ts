import { describe, expect, it } from 'vitest';
import { awardsMessage, computeSeasonAwards } from '../awards';
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
    expect(byId.fastest.detail).toBe('in 15 mosse contro Anna');
    expect(winners('longest')).toEqual(['bruno', 'carla']);
    expect(byId.longest.detail).toBe('Bruno – Carla, 60 mosse');
    expect(winners('slowest')).toEqual(['bruno']);
    expect(byId.slowest.detail).toBe('4 h a mossa');
    expect(winners('draws')).toEqual(['bruno', 'carla']);
    expect(byId.draws.detail).toBe('1 patta');
  });

  it('leaves out awards nobody earned', () => {
    const only = computeSeasonAwards(players, [g('anna', 'bruno', 'aaaaaaaa')], {
      aaaaaaaa: st('aaaaaaaa', 'resign', 20, 10, 'white'),
    });
    expect(only.map((a) => a.id)).toEqual(['fastest', 'longest']);
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
