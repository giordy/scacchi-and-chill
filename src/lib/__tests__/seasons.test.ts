import { describe, expect, it } from 'vitest';
import { buildSeasonArchive, seasonId, sortSeasons, standingsCsv, validateNewSeasonName, withChampion } from '../seasons';
import { HistoryGame, LichessExportGame, Player, SeasonArchive, TournamentMeta } from '../../types';

const players: Player[] = [
  { name: 'Anna', handle: 'anna' },
  { name: 'Bruno', handle: 'bruno' },
];
const meta: TournamentMeta = { title: 'Scacchi & Chill', season: 'Stagione 2 - Capablanca', description: '', masterName: 'Capablanca' };
const game = (id: string): HistoryGame => ({ round: '1', white: 'anna', black: 'bruno', url: `https://lichess.org/${id}` });
const st = (id: string, status: string, winner?: 'white' | 'black'): LichessExportGame => ({ id, status, winner });

describe('seasonId', () => {
  it('makes a stable slug', () => {
    expect(seasonId('Stagione 2 - Capablanca')).toBe('stagione-2-capablanca');
    expect(seasonId('Édition ñ 3!')).toBe('edition-n-3');
    expect(seasonId('???')).toBe('stagione');
  });
});

describe('buildSeasonArchive', () => {
  const now = new Date('2026-12-31T10:00:00Z');

  it('captures standings, champion and number of games', () => {
    const a = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'mate', 'black') }, now);
    expect(a.id).toBe('stagione-2-capablanca');
    expect(a.champion).toEqual({ handle: 'bruno', name: 'Bruno', points: 1 });
    expect(a.gamesPlayed).toBe(1);
    expect(a.standings.map((s) => s.handle)).toEqual(['bruno', 'anna']);
    expect(a.masterName).toBe('Capablanca');
    expect(a.archivedAt).toBe(now.toISOString());
    expect(a).not.toHaveProperty('imageUrl');
  });

  it('has no champion when nothing has been scored', () => {
    const a = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'started') }, now);
    expect(a.champion).toBeUndefined();
    expect(a.gamesPlayed).toBe(0);
  });
});

describe('withChampion', () => {
  const archive = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'mate', 'white') }, new Date('2026-12-31T10:00:00Z'));

  it('adds the champion once', () => {
    const once = withChampion([], archive);
    // Without dates in the games, the period ends with the archive date
    expect(once).toEqual([{ season: meta.season, name: 'Anna', handle: 'anna', end: '2026-12' }]);
    expect(withChampion(once, archive)).toBe(once);
  });

  it('replaces the entry of the same season when the champion changed', () => {
    const early = [{ season: meta.season, name: 'Bruno', handle: 'bruno', year: '2026', notes: 'in testa a metà stagione' }];
    expect(withChampion(early, archive)).toEqual([{ season: meta.season, name: 'Anna', handle: 'anna', end: '2026-12' }]);
    const same = [{ season: meta.season, name: 'Anna', handle: 'anna', notes: 'Campionessa', end: '2026-11' }];
    expect(withChampion(same, archive)).toBe(same);
  });

  it('fills in the period of an entry typed by hand, keeping what was typed', () => {
    const typed = [{ season: meta.season, name: 'Anna', handle: 'anna', notes: 'Campionessa' }];
    expect(withChampion(typed, archive)).toEqual([{ ...typed[0], end: '2026-12' }]);
  });

  it('keeps existing winners and handles undefined', () => {
    const prev = [{ season: 'Stagione 1', name: 'Fabio', handle: 'fsgach' }];
    expect(withChampion(prev, archive)).toHaveLength(2);
    expect(withChampion(undefined, archive)).toHaveLength(1);
  });
});

describe('sortSeasons', () => {
  it('orders newest first without mutating the input', () => {
    const a = { id: 'a', archivedAt: '2026-01-01T00:00:00Z' } as SeasonArchive;
    const b = { id: 'b', archivedAt: '2027-01-01T00:00:00Z' } as SeasonArchive;
    const input = [a, b];
    expect(sortSeasons(input).map((s) => s.id)).toEqual(['b', 'a']);
    expect(input[0]).toBe(a);
  });
});

describe('validateNewSeasonName', () => {
  const archived = [{ id: 'stagione-1' }];
  it('accepts a fresh name', () => {
    expect(validateNewSeasonName('Stagione 3 - Fischer', 'Stagione 2', archived)).toBeNull();
  });
  it('rejects empty names, the current season and archived seasons', () => {
    expect(validateNewSeasonName('  ', 'Stagione 2', archived)).toMatch(/Inserisci/);
    expect(validateNewSeasonName('stagione 2', 'Stagione 2', archived)).toMatch(/corrente/);
    expect(validateNewSeasonName('Stagione 1', 'Stagione 2', archived)).toMatch(/archiviata/);
  });
});

describe('standingsCsv', () => {
  it('writes one row per player with Italian number format', () => {
    const named: Player[] = [{ name: 'Anna; "la Rossa"', handle: 'anna' }, { name: 'Bruno', handle: 'bruno' }];
    const a = buildSeasonArchive(meta, named, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'draw') });
    const lines = standingsCsv(a).replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Posizione;Giocatore;Lichess;Punti;Giocate;Vinte;Patte;Perse;Sonneborn-Berger');
    expect(lines[1]).toBe('1;"Anna; ""la Rossa""";anna;0,5;1;0;1;0;0,25');
    expect(lines).toHaveLength(3);
  });

  it('writes the same place for tied players, as on the site', () => {
    // A draw: Anna and Bruno level on points, SB and wins
    const a = buildSeasonArchive(meta, players, [game('aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'draw') });
    const lines = standingsCsv(a).replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines.slice(1).map((l) => l.split(';')[0])).toEqual(['1', '1']);
  });

  it('leaves the place empty before the first game', () => {
    const a = buildSeasonArchive(meta, players, [], {});
    const lines = standingsCsv(a).replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines.slice(1).map((l) => l.split(';')[0])).toEqual(['', '']);
  });
});

describe('season period in the archive', () => {
  const D = 86400e3;
  const at = Date.UTC(2026, 10, 3, 12); // 3 November 2026
  const dated = (id: string, round: string, created: number): HistoryGame => ({ ...game(id), round, createdAt: created });

  it('goes from the first challenge to the last move of the last game', () => {
    const history = [dated('aaaaaaaa', '1', at), dated('bbbbbbbb', '2', at + 40 * D)];
    const states = {
      aaaaaaaa: { ...st('aaaaaaaa', 'mate', 'white'), lastMoveAt: at + 10 * D },
      bbbbbbbb: { ...st('bbbbbbbb', 'draw'), lastMoveAt: at + 120 * D }, // March 2027
    };
    const a = buildSeasonArchive(meta, players, history, states, new Date(at + 130 * D));
    expect([a.start, a.end]).toEqual(['2026-11', '2027-03']);
  });

  it('ends at the archive date when games were left unfinished', () => {
    const history = [dated('aaaaaaaa', '1', at)];
    const a = buildSeasonArchive(meta, players, history, { aaaaaaaa: st('aaaaaaaa', 'started') }, new Date(at + 60 * D));
    expect([a.start, a.end]).toEqual(['2026-11', '2027-01']);
  });
});


describe('closing a season with a substitute', () => {
  it("keeps the substitute's first round, from who played on Lichess", async () => {
    const { buildSeasonArchive } = await import('../seasons');
    const players = [{ handle: 'anna', name: 'Anna' }, { handle: 'sub', name: 'Sub' }];
    const meta = {
      title: 'T', season: 'S', description: '',
      withdrawals: [{ handle: 'greta', name: 'Greta', at: '2026-01-01', played: 1, total: 2, mode: 'replaced' as const, replacedBy: { handle: 'sub', name: 'Sub' } }],
    };
    const on = (id: string, white: string, black: string) => ({ id, status: 'mate', winner: 'white' as const, players: { white: { user: { id: white } }, black: { user: { id: black } } } });
    const history = [
      { round: '1', white: 'sub', black: 'anna', url: 'https://lichess.org/aaaaaaaa' },
      { round: '2', white: 'anna', black: 'sub', url: 'https://lichess.org/bbbbbbbb' },
    ];
    const a = buildSeasonArchive(meta, players, history, { aaaaaaaa: on('aaaaaaaa', 'greta', 'anna'), bbbbbbbb: on('bbbbbbbb', 'anna', 'sub') });
    expect(a.departures?.[0]).toMatchObject({ handle: 'greta', fromRound: '2' });
  });
});
