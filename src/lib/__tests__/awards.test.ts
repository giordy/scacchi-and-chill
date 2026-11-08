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
    expect(byId.mate).toBeUndefined(); // Re del matto is no longer given
    expect(winners('fastest')).toEqual(['carla']);
    expect(byId.fastest.detail).toBe('in 15 mosse'); // the loser is not named
    expect(winners('longest')).toEqual(['anna']); // the draw is longer, but only wins count
    expect(byId.longest.detail).toBe('in 26 mosse contro Carla');
    expect(byId.draws).toBeUndefined(); // a single draw is no wall
  });

  it('needs at least two draws for Il muro', () => {
    const draws = computeSeasonAwards(players, [g('bruno', 'carla', 'bbbbbbbb'), g('carla', 'bruno', 'ffffffff')], {
      bbbbbbbb: st('bbbbbbbb', 'draw', 60, 30),
      ffffffff: st('ffffffff', 'draw', 60, 30),
    });
    const wall = draws.find((a) => a.id === 'draws')!;
    expect(wall.winners.map((w) => w.handle)).toEqual(['bruno', 'carla']);
    expect(wall.detail).toBe('2 patte');
    expect(awardsMessage('S', [wall])).toContain('Bruno e Carla (2 patte)');
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
      '⚡ *Fulmine*: Carla (in 15 mosse)',
    ]);
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

describe('games linked from the awards', () => {
  it('links the fastest and the longest win', async () => {
    const { computeSeasonAwards } = await import('../awards');
    const players = [{ handle: 'anna', name: 'Anna' }, { handle: 'bruno', name: 'Bruno' }];
    const h = (id: string) => ({ round: '1', white: 'anna', black: 'bruno', url: `https://lichess.org/${id}` });
    const st = (id: string, moves: number, status = 'resign', extra = {}) => ({
      id, status, winner: 'white' as const, moves: Array.from({ length: moves * 2 }, () => 'e4').join(' '), ...extra,
    });
    const states = {
      quick001: st('quick001', 10, 'mate'),
      mate0002: st('mate0002', 40, 'mate'),
      long0001: st('long0001', 60),
      upset001: st('upset001', 30, 'resign', { players: { white: { rating: 1400 }, black: { rating: 1700 } } }),
    };
    const awards = computeSeasonAwards(players, [h('quick001'), h('mate0002'), h('long0001'), h('upset001')], states);
    const by = (id: string) => awards.find((a) => a.id === id)!;
    expect(by('fastest').games).toEqual(['quick001']);
    expect(by('longest').games).toEqual(['long0001']);
    expect(awards.some((a) => a.id === 'upsets')).toBe(false); // replaced by the Trofeo Pillsbury
  });

  it('finds them again in the games of a season archived before', async () => {
    const { withAwardGames } = await import('../awards');
    const g = (id: string, plies: number, extra = {}) => ({ round: '1', white: 'anna', black: 'bruno', result: '1-0' as const, status: 'resign', plies, id, ...extra });
    const games = [g('quick001', 19, { status: 'mate' }), g('long0001', 120), g('upset001', 60, { whiteRating: 1400, blackRating: 1700 }), g('draw0001', 200, { result: '½-½' })];
    const w = [{ handle: 'anna', name: 'Anna' }];
    const old = [
      { id: 'fastest', emoji: '', title: '', description: '', winners: w, detail: '' },
      { id: 'longest', emoji: '', title: '', description: '', winners: w, detail: '' },
      { id: 'mate', emoji: '', title: '', description: '', winners: w, detail: '' },
      { id: 'upsets', emoji: '', title: '', description: '', winners: w, detail: '' },
      { id: 'draws', emoji: '', title: '', description: '', winners: w, detail: '' },
    ];
    const out = withAwardGames(old, games);
    expect(out.map((a) => a.games)).toEqual([['quick001'], ['long0001'], ['quick001'], ['upset001'], undefined]);
    // Without archived games, or with games already linked, nothing changes
    expect(withAwardGames(old, undefined)).toBe(old);
    expect(withAwardGames([{ ...old[0], games: ['x'] }], games)[0].games).toEqual(['x']);
  });
});

describe('Trofeo Pillsbury', () => {
  const players = ['anna', 'bruno', 'carla', 'elena', 'dario'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
  const row = (handle: string) => ({ handle, name: handle, played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 });
  // Last season Anna beat Carla twice: Anna starts ahead
  const past = {
    id: 'stagione-1', season: 'Stagione 1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: 2,
    standings: ['anna', 'bruno', 'carla', 'elena'].map(row),
    games: [1, 2].map((n) => ({ round: String(n), white: 'anna', black: 'carla', result: '1-0' as const, end: n })),
  };
  const game = (id: string, white: string, black: string, winner: 'white' | 'black', end: number) => ({
    h: { round: '1', white, black, url: `https://lichess.org/${id}` },
    s: { id, status: 'resign', winner, lastMoveAt: end },
  });

  it('goes to who beat their objective by most, esordienti and the games against them left out', async () => {
    const { computeSeasonAwards } = await import('../awards');
    const games = [
      game('aaaaaaaa', 'carla', 'anna', 'white', 10), // Carla, behind, beats Anna
      game('bbbbbbbb', 'bruno', 'anna', 'white', 11),
      game('cccccccc', 'dario', 'anna', 'white', 12), // Dario is new: wins, but is an esordiente
      game('dddddddd', 'dario', 'carla', 'white', 13),
    ];
    const history = games.map((g) => g.h);
    const states = Object.fromEntries(games.map((g) => [g.s.id, g.s]));
    const award = computeSeasonAwards(players, history, states, [past]).find((a) => a.id === 'pillsbury');
    expect(award).toMatchObject({ title: 'Trofeo Pillsbury', emoji: '🏅', winners: [{ handle: 'carla', name: 'Carla' }] });
    expect(award!.detail).toBe('1 punto su 1 partita, obiettivo 0'); // her one game counted: the win over Anna
    // With no archived season everyone is an esordiente: no award yet
    expect(computeSeasonAwards(players, history, states).some((a) => a.id === 'pillsbury')).toBe(false);
  });

  it('goes to nobody when the best is only in line with their objective (= in the table, not ▲)', async () => {
    const { computeSeasonAwards } = await import('../awards');
    const { pillsburyRace } = await import('../pillsbury');
    const { tournamentElo } = await import('../tournamentElo');
    // Anna, far ahead of Carla, beats her again: a few tenths above the objective
    const g1 = game('aaaaaaaa', 'anna', 'carla', 'white', 10);
    const states = { aaaaaaaa: g1.s };
    const race = pillsburyRace(players, tournamentElo([past], players.map((p) => p.handle), [g1.h], states), [g1.h], [g1.h], states);
    expect(race.rows[0].handle).toBe('anna');
    expect(race.rows[0].over).toBeGreaterThan(0);
    expect(race.rows[0].trend).toBe('same');
    expect(computeSeasonAwards(players, [g1.h], states, [past]).some((a) => a.id === 'pillsbury')).toBe(false);
  });

  it('is suspended with fewer than 4 players in the race', async () => {
    const { computeSeasonAwards } = await import('../awards');
    const { pillsburyRace } = await import('../pillsbury');
    const { tournamentElo } = await import('../tournamentElo');
    const g1 = game('aaaaaaaa', 'carla', 'anna', 'white', 10);
    const states = { aaaaaaaa: g1.s };
    // Elena is not playing this season: Anna, Bruno and Carla are in the race, Dario is an esordiente
    const three = players.filter((p) => p.handle !== 'elena');
    expect(computeSeasonAwards(three, [g1.h], states, [past]).some((a) => a.id === 'pillsbury')).toBe(false);
    const race = pillsburyRace(three, tournamentElo([past], three.map((p) => p.handle), [g1.h], states), [g1.h], [g1.h], states);
    expect(race.suspended).toBe(true);
    const four = pillsburyRace(players, tournamentElo([past], players.map((p) => p.handle), [g1.h], states), [g1.h], [g1.h], states);
    expect(four.suspended).toBe(false);
  });
});

describe('Re del matto of past seasons', () => {
  it('shows ⚔️, also for a season archived with the crown', async () => {
    const { awardEmoji } = await import('../awards');
    expect(awardEmoji({ id: 'mate', emoji: '👑', title: '', description: '', winners: [], detail: '' })).toBe('⚔️');
    expect(awardEmoji({ id: 'draws', emoji: '🧱', title: '', description: '', winners: [], detail: '' })).toBe('🧱');
  });
});

describe('Trofeo Pillsbury', () => {
  it('has its name and emoji from the code, also for a season archived as "Premio Pillsbury" with 🌱', async () => {
    const { awardEmoji, awardTitle } = await import('../awards');
    expect(awardEmoji({ id: 'pillsbury', emoji: '🌱', title: 'Premio Pillsbury', description: '', winners: [], detail: '' })).toBe('🏅');
    expect(awardTitle({ id: 'pillsbury', emoji: '🌱', title: 'Premio Pillsbury', description: '', winners: [], detail: '' })).toBe('Trofeo Pillsbury');
    expect(awardTitle({ id: 'draws', emoji: '🧱', title: 'Il muro', description: '', winners: [], detail: '' })).toBe('Il muro');
  });
});
