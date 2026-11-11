import { describe, expect, it } from 'vitest';
import { computePlayerProfile, formatPace } from '../playerProfile';
import { parsePlayerHash, playerHref, isAdminLocation, parsePublicView, publicViewHref, tabOfView } from '../routes';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
  { name: 'Carla', handle: 'carla' },
  { name: 'Dario', handle: 'dario' },
];
const g = (round: string, white: string, black: string, id: string): HistoryGame => ({
  round,
  white,
  black,
  url: `https://lichess.org/${id}`,
});
const st = (id: string, status: string, winner?: 'white' | 'black'): LichessExportGame => ({ id, status, winner });

describe('computePlayerProfile', () => {
  it('has no place before the first game', () => {
    const p = computePlayerProfile('anna', players, [], {})!;
    expect(p.rank).toBeNull();
    expect(p.tied).toBe(false);
  });

  it('shares the place on a full tie and says so', () => {
    // Anna and Carla each beat a player with no points: same points, SB and wins
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('1', 'carla', 'dario', 'bbbbbbbb')];
    const gs = { aaaaaaaa: st('aaaaaaaa', 'mate', 'white'), bbbbbbbb: st('bbbbbbbb', 'mate', 'white') };
    const anna = computePlayerProfile('anna', players, history, gs)!;
    const carla = computePlayerProfile('carla', players, history, gs)!;
    const bruno = computePlayerProfile('bruno', players, history, gs)!;
    expect([anna.rank, anna.tied]).toEqual([1, true]);
    expect([carla.rank, carla.tied]).toEqual([1, true]);
    expect([bruno.rank, bruno.tied]).toEqual([3, true]);
  });

  it('gives a place of its own when nobody is level', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('1', 'carla', 'dario', 'bbbbbbbb')];
    const gs = { aaaaaaaa: st('aaaaaaaa', 'mate', 'white'), bbbbbbbb: st('bbbbbbbb', 'draw') };
    expect(computePlayerProfile('anna', players, history, gs)).toMatchObject({ rank: 1, tied: false });
    expect(computePlayerProfile('bruno', players, history, gs)).toMatchObject({ rank: 4, tied: false });
  });

  it('returns null for an unknown handle and matches case-insensitively', () => {
    expect(computePlayerProfile('nobody', players, [], {})).toBeNull();
    expect(computePlayerProfile('ANNA', players, [], {})?.player.handle).toBe('anna');
  });

  it('describes games from the player point of view', () => {
    const history = [
      g('2', 'bruno', 'anna', 'bbbbbbbb'),
      g('1', 'anna', 'carla', 'aaaaaaaa'),
      g('3', 'anna', 'dario', 'cccccccc'),
    ];
    const gs = {
      aaaaaaaa: st('aaaaaaaa', 'mate', 'white'),
      bbbbbbbb: st('bbbbbbbb', 'resign', 'white'),
      cccccccc: st('cccccccc', 'started'),
    };
    const p = computePlayerProfile('anna', players, history, gs)!;
    expect(p.games.map((x) => [x.round, x.opponent, x.color, x.outcome])).toEqual([
      ['1', 'carla', 'white', 'win'],
      ['2', 'bruno', 'black', 'loss'],
      ['3', 'dario', 'white', 'ongoing'],
    ]);
    expect(p.standing).toMatchObject({ points: 1, won: 1, lost: 1 });
    expect(p.rank).toBeGreaterThanOrEqual(1);
  });

  it('marks a draw and a game without Lichess state', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'anna', 'carla', 'bbbbbbbb')];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'draw') })!;
    expect(p.games.map((x) => x.outcome)).toEqual(['draw', 'pending']);
  });

  it('lists opponents not met yet, scheduled ones first with round and color', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa')];
    const schedule: ScheduledMatch[] = [
      { round: '3', white: 'dario', black: 'anna' },
      { round: '2', white: 'anna', black: 'carla' },
      { round: '1', white: 'anna', black: 'bruno' },
    ];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'mate', 'white') }, schedule)!;
    expect(p.remaining).toEqual([
      { opponent: 'carla', round: '2', color: 'white' },
      { opponent: 'dario', round: '3', color: 'black' },
    ]);
  });

  it('includes unscheduled opponents and counts aborted games as still to play', () => {
    const history = [g('1', 'anna', 'bruno', 'aaaaaaaa')];
    const p = computePlayerProfile('anna', players, history, { aaaaaaaa: st('aaaaaaaa', 'aborted') })!;
    expect(p.games).toEqual([]);
    expect(p.remaining.map((r) => r.opponent)).toEqual(['bruno', 'carla', 'dario']);
  });
});

describe('routes', () => {
  it('builds and parses player hashes', () => {
    expect(playerHref('marco_chess')).toBe('#/giocatore/marco_chess');
    expect(parsePlayerHash('#/giocatore/marco_chess')).toBe('marco_chess');
    expect(parsePlayerHash(playerHref('a b'))).toBe('a b');
  });

  it('ignores other hashes and malformed input', () => {
    expect(parsePlayerHash('')).toBeNull();
    expect(parsePlayerHash('#admin')).toBeNull();
    expect(parsePlayerHash('#/giocatore/')).toBeNull();
    expect(parsePlayerHash('#/giocatore/%E0%A4%A')).toBeNull();
  });

  it('does not treat a player page of an "admin" handle as the admin area', () => {
    expect(isAdminLocation('#admin', '')).toBe(true);
    expect(isAdminLocation('', '?admin')).toBe(true);
    expect(isAdminLocation('#/giocatore/administrator', '')).toBe(false);
  });
});

describe('game pace', () => {
  const H = 3600 * 1000;
  const timed = (id: string, status: string, moves: string, hours: number): LichessExportGame => ({
    id,
    status,
    moves,
    createdAt: 1000,
    lastMoveAt: 1000 + hours * H,
  });

  // Own times: Anna 1 h, Bruno 3 h, Carla 5 h per move; each game's pace is the average of its two players
  const ten = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7';
  const season = [g('1', 'anna', 'bruno', 'aaaaaaaa'), g('2', 'bruno', 'carla', 'bbbbbbbb'), g('3', 'carla', 'anna', 'cccccccc')];
  const seasonStates = {
    aaaaaaaa: timed('aaaaaaaa', 'mate', ten, 20), // (1 + 3) / 2 · 10
    bbbbbbbb: timed('bbbbbbbb', 'resign', ten, 40), // (3 + 5) / 2 · 10
    cccccccc: timed('cccccccc', 'draw', ten, 30), // (5 + 1) / 2 · 10
  };

  it("is the player's own time per move, told apart from the opponents'", () => {
    const anna = computePlayerProfile('anna', players, season, seasonStates)!;
    expect(anna.pace?.games).toBe(2);
    expect(anna.pace!.msPerMove / H).toBeCloseTo(1);
    expect(computePlayerProfile('carla', players, season, seasonStates)!.pace!.msPerMove / H).toBeCloseTo(5);
  });

  it('is null until the games pin it down', () => {
    // A single game cannot tell its two players apart
    expect(computePlayerProfile('anna', players, season.slice(0, 1), seasonStates)!.pace).toBeNull();
    expect(computePlayerProfile('anna', players, [], {})!.pace).toBeNull();
  });

  it('formats minutes, hours and days', () => {
    expect(formatPace(10 * 1000)).toBe('1 min');
    expect(formatPace(25 * 60 * 1000)).toBe('25 min');
    expect(formatPace(9.4 * 3600 * 1000)).toBe('9 h');
    expect(formatPace(36 * 3600 * 1000)).toBe('36 h');
    expect(formatPace(60 * 3600 * 1000)).toBe('2,5 giorni');
    expect(formatPace(48 * 3600 * 1000)).toBe('2 giorni');
  });
});

describe('color record, endings and openings', () => {
  it('splits points by color, counts how games ended and keeps the opening', () => {
    const history = [
      g('1', 'anna', 'bruno', 'aaaaaaaa'),
      g('2', 'carla', 'anna', 'bbbbbbbb'),
      g('3', 'anna', 'dario', 'cccccccc'),
      g('4', 'bruno', 'anna', 'dddddddd'),
      g('5', 'anna', 'carla', 'eeeeeeee'),
      g('6', 'dario', 'anna', 'ffffffff'),
    ];
    const gs: Record<string, LichessExportGame> = {
      aaaaaaaa: { ...st('aaaaaaaa', 'mate', 'white'), opening: { name: 'Italian Game' } },
      bbbbbbbb: st('bbbbbbbb', 'outoftime', 'black'), // Anna wins on time with Black
      cccccccc: st('cccccccc', 'resign', 'black'), // Anna resigns with White
      dddddddd: st('dddddddd', 'stalemate'),
      eeeeeeee: st('eeeeeeee', 'started'), // ongoing: not counted
      ffffffff: st('ffffffff', 'aborted'), // void: not counted
    };
    const p = computePlayerProfile('anna', players, history, gs)!;
    expect(p.byColor).toEqual({ white: { played: 2, points: 1 }, black: { played: 2, points: 1.5 } });
    expect(p.endings).toEqual({
      wins: { mate: 1, resign: 0, timeout: 1, other: 0 },
      losses: { mate: 0, resign: 1, timeout: 0, other: 0 },
      draws: 1,
    });
    expect(p.games.map((x) => x.opening)).toEqual(['Italian Game', undefined, undefined, undefined, undefined]);
  });
});

describe('public views in the hash', () => {
  it('round-trips every view and falls back to the standings', () => {
    (['standings', 'crosstable', 'matches', 'timeline', 'season', 'hall', 'rules'] as const).forEach((v) =>
      expect(parsePublicView(publicViewHref(v))).toBe(v)
    );
    expect(publicViewHref('hall')).toBe('#/albo');
    expect(parsePublicView('')).toBe('standings');
    expect(parsePublicView('#')).toBe('standings');
    expect(parsePublicView('#/qualcosa')).toBe('standings');
    expect(parsePublicView('#/Partite')).toBe('matches');
  });
  it('keeps the addresses shared before the tabs changed', () => {
    expect(parsePublicView('#/torneo')).toBe('season');
    expect(parsePublicView('#/torneo/albo')).toBe('hall');
    expect(parsePublicView('#/tabellone')).toBe('crosstable');
  });
  it('maps each view to its tab', () => {
    expect(tabOfView('crosstable')).toBe('standings');
    expect(tabOfView('timeline')).toBe('matches');
    expect(tabOfView('season')).toBe('season');
    expect(tabOfView('rules')).toBeUndefined();
  });
});
