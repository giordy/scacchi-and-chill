import { describe, expect, it } from 'vitest';
import { ActivityEvent, archivedSeasonActivity, currentSeasonActivity, isNewSince, sortEvents } from '../activity';
import { tournamentElo } from '../tournamentElo';
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
      ['roundEnd', 'Si chiude il turno 1: in testa @anna'],
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
    expect(all.find((e) => e.gameId === 'aaaaaaaa')!.tags).toEqual(["L'apertura di Capablanca"]);
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

describe('more of the season', () => {
  // Four players, one game a day: Anna wins them all
  const four = [...players, { handle: 'dario', name: 'Dario' }];
  const pairs: [string, string, string][] = [
    ['1', 'anna', 'bruno'],
    ['1', 'carla', 'dario'],
    ['2', 'anna', 'carla'],
    ['2', 'bruno', 'dario'],
    ['3', 'dario', 'anna'],
    ['3', 'bruno', 'carla'],
    ['4', 'bruno', 'anna'],
    ['4', 'dario', 'carla'],
  ];
  const games: HistoryGame[] = pairs.map(([round, white, black], i) => ({
    round,
    white,
    black,
    url: `https://lichess.org/g000000${i}`,
    createdAt: T0 + (Number(round) - 1) * 10 * DAY,
  }));
  // Games 0-5 over (Anna wins hers, the others are draws), 6-7 still to play
  const st: Record<string, LichessExportGame> = {};
  pairs.slice(0, 6).forEach(([, white, black], i) => {
    const at = T0 + (i + 1) * DAY + Math.floor(i / 2) * 8 * DAY;
    const id = `g000000${i}`;
    st[id] = [white, black].includes('anna')
      ? { id, status: 'resign', winner: white === 'anna' ? 'white' : 'black', lastMoveAt: at }
      : { id, status: 'draw', lastMoveAt: at };
  });
  const anecdotes = [
    { title: '*Il bambino prodigio*', text: '…' },
    { title: 'Il campione del mondo', text: '…' },
  ];
  const events = currentSeasonActivity({ season: 'S', masterName: 'José Raúl Capablanca', masterAnecdotes: anecdotes, players: four, history: games, gameStates: st });
  const of = (kind: ActivityEvent['kind']) => events.filter((e) => e.kind === kind);

  it('tells a third win in a row and more', () => {
    expect(of('streak').map(sentence)).toEqual(['@anna vince la terza partita di fila']);
  });

  it('tells the campione matematico once, when nobody can reach the leader', () => {
    // Anna's third win (round 3) makes 3 points; nobody else can reach more than 2½, with rounds 3 and 4 still open
    expect(of('champion').map(sentence)).toEqual(['@anna vince matematicamente la stagione: nessuno può più arrivare in testa']);
    expect(of('champion')[0].detail).toBe("con 2 turni d'anticipo");
  });

  it('closes each round with who leads', () => {
    expect(of('roundEnd').map(sentence)).toEqual([
      'Si chiude il turno 3: in testa @anna',
      'Si chiude il turno 2: in testa @anna',
      'Si chiude il turno 1: in testa @anna',
    ]);
    expect(of('roundEnd')[0].detail).toBe('con 3 punti');
  });

  it('publishes the anecdote of each round with its start', () => {
    expect(of('anecdote').map(sentence)).toEqual([
      'Nuovo aneddoto su Capablanca: «Il campione del mondo»',
      'Nuovo aneddoto su Capablanca: «Il bambino prodigio»',
    ]);
    expect(of('anecdote')[0].link).toEqual({ href: '#/stagione', label: 'Leggi' });
  });

  it('tags a scontro al vertice from the fourth round', () => {
    const late = { ...st, g0000006: { id: 'g0000006', status: 'resign', winner: 'black' as const, lastMoveAt: T0 + 40 * DAY } };
    const out = currentSeasonActivity({ season: 'S', players: four, history: games, gameStates: late });
    // Before round 4: Anna 3, the other three 1 each. The top 3 places hold four players: no summit
    expect(out.find((e) => e.gameId === 'g0000006')!.tags).toBeUndefined();
    // With Bruno alone in second place, Bruno – Anna is one
    const second = { ...late, g0000003: { id: 'g0000003', status: 'resign', winner: 'white' as const, lastMoveAt: T0 + 14 * DAY } };
    const out2 = currentSeasonActivity({ season: 'S', players: four, history: games, gameStates: second });
    expect(out2.find((e) => e.gameId === 'g0000006')!.tags).toEqual(['Scontro al vertice']);
  });
});

describe('first wins', () => {
  const g = (i: number, white: string, black: string): HistoryGame => ({ round: String(i + 1), white, black, url: `https://lichess.org/w000000${i}`, createdAt: T0 });
  const games = [g(0, 'anna', 'bruno'), g(1, 'carla', 'bruno'), g(2, 'bruno', 'anna'), g(3, 'carla', 'anna')];
  // Anna wins her first game; Bruno loses twice and then wins; Carla's first win is her first game
  const winners: ('white' | 'black')[] = ['white', 'white', 'white', 'white'];
  const st: Record<string, LichessExportGame> = Object.fromEntries(
    games.map((x, i) => [`w000000${i}`, { id: `w000000${i}`, status: 'resign', winner: winners[i], lastMoveAt: T0 + (i + 1) * DAY }])
  );
  const firsts = (archives?: SeasonArchive[]) =>
    currentSeasonActivity({ season: 'S', players, history: games, gameStates: st, archives }).filter((e) => e.kind === 'firstWin').map(sentence);

  it('tells a first win of the season after games without one, not a win at the first game', () => {
    expect(firsts()).toEqual(['@bruno conquista la sua prima vittoria della stagione']);
  });

  it('tells the first win in the tournament, from the second season on, even at the first game', () => {
    const past: SeasonArchive = {
      id: 's1',
      season: 'Stagione 1',
      title: 'T',
      archivedAt: '2026-06-01T00:00:00Z',
      standings: [],
      gamesPlayed: 1,
      games: [{ round: '1', white: 'anna', black: 'bruno', result: '1-0' }],
    };
    // Newest first: Bruno (third game), then Carla (her first game); Anna had already won
    expect(firsts([past])).toEqual([
      '@bruno conquista la sua prima vittoria nel torneo',
      '@carla conquista la sua prima vittoria nel torneo',
    ]);
    // A season archived without its games: its table says who won
    const old = { ...past, games: undefined, standings: [{ handle: 'Carla', name: 'Carla', played: 1, won: 1, drawn: 0, lost: 0, points: 1, sb: 0 }] };
    expect(firsts([old])).toEqual(['@bruno conquista la sua prima vittoria nel torneo', '@anna conquista la sua prima vittoria nel torneo']);
  });
});

describe('objectives and the Trofeo Pillsbury', () => {
  // A first season makes everyone's level known: Anna far ahead, Dario last
  const four = ['anna', 'bruno', 'carla', 'dario'].map((h) => ({ handle: h, name: h }));
  const first: SeasonArchive = {
    id: 's1',
    season: 'Stagione 1',
    title: 'T',
    archivedAt: '2026-06-01T00:00:00Z',
    standings: [],
    gamesPlayed: 12,
    games: (
      [
        ['anna', 'bruno', '1-0'], ['anna', 'carla', '1-0'], ['anna', 'dario', '1-0'], ['bruno', 'carla', '½-½'], ['bruno', 'dario', '1-0'], ['carla', 'dario', '½-½'],
        ['bruno', 'anna', '0-1'], ['carla', 'anna', '0-1'], ['dario', 'anna', '0-1'], ['carla', 'bruno', '½-½'], ['dario', 'bruno', '0-1'], ['dario', 'carla', '½-½'],
      ] as const
    ).map(([white, black, result], i) => ({ round: String(i + 1), white, black, result, end: Date.UTC(2026, 0, 1) + i * DAY })),
  };
  const pairs: [string, string, string][] = [
    ['1', 'anna', 'bruno'], ['1', 'carla', 'dario'], ['2', 'anna', 'carla'], ['2', 'bruno', 'dario'], ['3', 'dario', 'anna'], ['3', 'bruno', 'carla'],
  ];
  const schedule = pairs.map(([round, white, black]) => ({ round, white, black }));
  const games: HistoryGame[] = pairs.map(([round, white, black], i) => ({ round, white, black, url: `https://lichess.org/p000000${i}`, createdAt: T0 + i * DAY }));
  // Bruno beats Anna, Carla Dario, Anna Carla, Dario Bruno, Dario Anna, Bruno Carla: one a day
  const winners: ('white' | 'black')[] = ['black', 'white', 'white', 'black', 'white', 'white'];
  const st = (upTo: number): Record<string, LichessExportGame> =>
    Object.fromEntries(
      games.slice(0, upTo).map((_, i) => [`p000000${i}`, { id: `p000000${i}`, status: 'resign', winner: winners[i], lastMoveAt: T0 + (i + 1) * DAY }])
    );
  const run = (upTo: number) => {
    const elo = tournamentElo([first], four.map((p) => p.handle), games, st(upTo));
    return currentSeasonActivity({ season: 'Stagione 2', players: four, history: games, gameStates: st(upTo), schedule, archives: [first], elo });
  };

  it('tells when each player reaches their objective, the weaker ones included', () => {
    const objectives = run(6).filter((e) => e.kind === 'objective');
    expect(objectives.map((e) => [sentence(e), e.detail, (e.at - T0) / DAY])).toEqual([
      ['@bruno raggiunge il suo obiettivo della stagione', 'Obiettivo: 1½ punti', 6],
      ['@dario raggiunge il suo obiettivo della stagione', 'Obiettivo: ½ punto', 4],
      ['@carla raggiunge il suo obiettivo della stagione', 'Obiettivo: 1 punto', 2],
    ]);
    expect(objectives[0].link).toEqual({ href: '#/pillsbury', label: 'Pillsbury' });
  });

  it('gives the Trofeo Pillsbury with the end of the season, not before', () => {
    expect(run(5).some((e) => e.kind === 'pillsbury')).toBe(false);
    const events = run(6);
    expect(events[0].kind).toBe('pillsbury');
    expect(sentence(events[0])).toBe('@dario vince il Trofeo Pillsbury');
    expect(events[0].detail).toBe('+1½ punti sul suo obiettivo');
    expect(events[1].kind).toBe('end');
  });

  it('has no objectives in a first season, nor without the Elo del torneo', () => {
    const elo = tournamentElo([], four.map((p) => p.handle), games, st(6));
    expect(currentSeasonActivity({ season: 'S', players: four, history: games, gameStates: st(6), schedule, elo }).some((e) => e.kind === 'objective')).toBe(false);
    expect(currentSeasonActivity({ season: 'S', players: four, history: games, gameStates: st(6), schedule }).some((e) => e.kind === 'objective')).toBe(false);
  });

  it('reads the Trofeo Pillsbury of an archived season from its awards', () => {
    const withAward: SeasonArchive = {
      ...first,
      awards: [{ id: 'pillsbury', emoji: '🏅', title: 'Trofeo Pillsbury', description: '', winners: [{ handle: 'carla', name: 'Carla' }], detail: '3 punti su 6 partite, obiettivo 2' }],
    };
    const p = archivedSeasonActivity(withAward).find((e) => e.kind === 'pillsbury')!;
    expect(sentence(p)).toBe('@carla vince il Trofeo Pillsbury');
    expect(p.detail).toBe('3 punti su 6 partite, obiettivo 2');
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

  it('leaves the tournament title out of the season name', () => {
    const named = { ...archive, season: 'Scacchi & Chill - Stagione 1' };
    expect(sentence(archivedSeasonActivity(named)[0])).toBe('@anna vince la Stagione 1');
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
