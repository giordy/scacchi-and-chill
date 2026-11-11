import { describe, expect, it } from 'vitest';
import { ActivityEvent, archivedSeasonActivity, currentSeasonActivity, isNewSince, sortEvents } from '../activity';
import { HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const players = [
  { handle: 'anna', name: 'Anna' },
  { handle: 'bruno', name: 'Bruno' },
  { handle: 'carla', name: 'Carla' },
];
const DAY = 24 * 3600 * 1000;
const T0 = Date.UTC(2026, 10, 2, 9);

// The sentence of an event, players as their handles
const sentence = (e: ActivityEvent) => e.parts.map((p) => (typeof p === 'string' ? p : `@${p.handle}`)).join('');

const history: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', createdAt: T0 },
  { round: '1', white: 'carla', black: 'anna', url: 'https://lichess.org/bbbbbbbb', createdAt: T0 + 1000 },
  { round: '2', white: 'bruno', black: 'carla', url: 'https://lichess.org/cccccccc', createdAt: T0 + 10 * DAY },
];
const states: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white', moves: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7', createdAt: T0, lastMoveAt: T0 + 2 * DAY, opening: { name: 'Italian Game' } },
  bbbbbbbb: { id: 'bbbbbbbb', status: 'draw', moves: 'd4 d5', createdAt: T0, lastMoveAt: T0 + 5 * DAY },
  cccccccc: { id: 'cccccccc', status: 'started', moves: 'e4', createdAt: T0 + 10 * DAY },
};

describe('currentSeasonActivity', () => {
  const events = currentSeasonActivity({ season: 'Stagione 2', masterName: 'José Raúl Capablanca', players, history, gameStates: states });

  it('lists the season start, rounds, results and leaders, newest first', () => {
    expect(events.map((e) => [e.kind, sentence(e)])).toEqual([
      ['round', 'Inizia il turno 2'],
      ['result', '@carla e @anna fanno patta'],
      ['leader', '@anna passa in testa alla classifica'],
      ['result', '@anna batte @bruno con il matto'],
      ['season', 'Comincia la Stagione 2'],
    ]);
  });

  it('describes the game and the start of the season', () => {
    const win = events.find((e) => e.kind === 'result' && e.gameId === 'aaaaaaaa')!;
    expect(win.detail).toBe('Turno 1 · 4 mosse · Italian Game');
    expect(win.at).toBe(T0 + 2 * DAY);
    expect(events.find((e) => e.kind === 'season')!.detail).toBe('Turno 1 · 2 partite · dedicata a José Raúl Capablanca');
    expect(events.find((e) => e.kind === 'leader')!.detail).toBe('con 1 punto');
  });

  it('gives no event for an ongoing game, nor a new leader when the first place is only shared', () => {
    expect(events.some((e) => e.gameId === 'cccccccc')).toBe(false);
    // After the draw Anna still leads alone (1½): no second leader event
    expect(events.filter((e) => e.kind === 'leader')).toHaveLength(1);
  });

  it('tags the master opening and tells who won once the last game is over', () => {
    const done = {
      ...states,
      cccccccc: { id: 'cccccccc', status: 'resign', winner: 'black' as const, moves: 'e4 e5', lastMoveAt: T0 + 12 * DAY },
    };
    const all = currentSeasonActivity({ season: 'Stagione 2', masterName: 'Capablanca', masterOpening: 'italian', players, history, gameStates: done });
    // Carla beat Bruno: Carla and Anna level on points, Sonneborn-Berger and wins
    expect(sentence(all[0])).toBe('@anna e @carla chiudono la Stagione 2 a pari merito in testa');
    expect(all[0].kind).toBe('end');
    expect(all[0].detail).toBe('con 1½ punti');
    // A shared first place is no new leader
    expect(all.filter((e) => e.kind === 'leader')).toHaveLength(1);
    expect(all.find((e) => e.gameId === 'aaaaaaaa')!.tags).toEqual(["♞ L'apertura di Capablanca"]);
  });

  it('tells withdrawals and replacements, and counts forfeits from their date without an event each', () => {
    const at = new Date(T0 + 3 * DAY).toISOString();
    const forfeit: HistoryGame = {
      round: '2',
      white: 'bruno',
      black: 'carla',
      url: '',
      lichess: { id: '', status: 'forfeit', winner: 'black' },
    };
    const out = currentSeasonActivity({
      season: 'Stagione 2',
      players,
      history: [...history.slice(0, 2), forfeit],
      gameStates: states,
      withdrawals: [
        { handle: 'bruno', name: 'Bruno', at, played: 1, total: 2, mode: 'forfeit', forfeits: [{ round: '2', white: 'bruno', black: 'carla' }] },
      ],
    });
    const w = out.find((e) => e.kind === 'withdrawal')!;
    expect(sentence(w)).toBe('@bruno si ritira');
    expect(w.detail).toBe('Le partite che restavano vanno agli avversari');
    expect(out.filter((e) => e.kind === 'result')).toHaveLength(2);
    // Carla's forfeit win (on the day of the withdrawal) catches Anna up: no leader alone any more
    expect(out.filter((e) => e.kind === 'leader').map(sentence)).toEqual(['@anna passa in testa alla classifica']);
    expect(out.some((e) => e.kind === 'result' && sentence(e).includes('@bruno') && sentence(e).includes('@carla'))).toBe(false);

    const sub = currentSeasonActivity({
      season: 'Stagione 2',
      players,
      history: [],
      gameStates: {},
      withdrawals: [{ handle: 'bruno', name: 'Bruno', at, played: 0, total: 2, mode: 'replaced', replacedBy: { handle: 'dario', name: 'Dario' } }],
    });
    expect(sentence(sub[0])).toBe('@dario prende il posto di @bruno');
  });

  it('names who sat at the board, not the handle of the calendar', () => {
    const replaced: HistoryGame[] = [{ round: '1', white: 'dario', black: 'anna', url: 'https://lichess.org/dddddddd', createdAt: T0 }];
    const s = {
      dddddddd: { id: 'dddddddd', status: 'resign', winner: 'black' as const, lastMoveAt: T0 + DAY, players: { white: { user: { id: 'bruno' } }, black: { user: { id: 'anna' } } } },
    };
    const out = currentSeasonActivity({ season: 'S', players: [...players, { handle: 'dario', name: 'Dario' }], history: replaced, gameStates: s });
    expect(out.filter((e) => e.kind === 'result').map(sentence)).toEqual(['@anna batte @bruno per abbandono']);
  });

  it('is empty before the first round', () => {
    expect(currentSeasonActivity({ season: 'S', players, history: [], gameStates: {} })).toEqual([]);
  });
});

describe('archivedSeasonActivity', () => {
  const archive: SeasonArchive = {
    id: 'stagione-1',
    season: 'Stagione 1',
    title: 'Scacchi & Chill',
    archivedAt: '2026-10-31T00:00:00Z',
    standings: [
      { handle: 'anna', name: 'Anna', played: 2, won: 2, drawn: 0, lost: 0, points: 2, sb: 1 },
      { handle: 'bruno', name: 'Bruno', played: 2, won: 1, drawn: 0, lost: 1, points: 1, sb: 0 },
    ],
    gamesPlayed: 2,
    games: [
      { round: '1', white: 'anna', black: 'bruno', result: '1-0', status: 'resign', plies: 30, id: 'eeeeeeee', end: T0 },
      { round: '2', white: 'bruno', black: 'anna', result: '0-1', status: 'outoftime', plies: 41, end: T0 + DAY },
      { round: '3', white: 'bruno', black: 'carla', result: '1-0', status: 'mate' }, // no time: left out
    ],
  };

  it('lists the results with a time, the leaders and the champion', () => {
    const events = archivedSeasonActivity(archive);
    expect(events.map(sentence)).toEqual([
      '@anna vince la Stagione 1',
      '@anna batte @bruno per tempo scaduto',
      '@anna passa in testa alla classifica',
      '@anna batte @bruno per abbandono',
    ]);
    expect(events[1].detail).toBe('Turno 2 · 21 mosse');
  });

  it('names co-champions together', () => {
    const tied = { ...archive, standings: archive.standings.map((s) => ({ ...s, points: 2, sb: 1, won: 2 })) };
    expect(sentence(archivedSeasonActivity(tied)[0])).toBe('@anna e @bruno chiudono la Stagione 1 a pari merito in testa');
  });
});

describe('helpers', () => {
  it('orders newest first, the leader above the result that made them', () => {
    const e = (kind: ActivityEvent['kind'], at: number): ActivityEvent => ({ key: `${kind}${at}`, kind, at, emoji: '', parts: [] });
    expect(sortEvents([e('result', 1), e('leader', 1), e('round', 2)]).map((x) => x.key)).toEqual(['round2', 'leader1', 'result1']);
  });

  it('marks what is new since the last visit, nothing on a first one', () => {
    const e: ActivityEvent = { key: 'x', kind: 'result', at: 100, emoji: '', parts: [] };
    expect(isNewSince(e, 50)).toBe(true);
    expect(isNewSince(e, 150)).toBe(false);
    expect(isNewSince(e, undefined)).toBe(false);
  });
});
