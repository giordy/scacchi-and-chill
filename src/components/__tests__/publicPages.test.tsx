// Smoke tests of the public pages: they render with realistic data (current season, archived seasons
// with games and a replacement, former players) and show the sections across seasons.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicTournamentView } from '../../PublicTournamentView';
import { PlayerPage } from '../../views/PlayerPage';
import { defaultConfig } from '../../lib/config';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const players = [
  { handle: 'anna', name: 'Anna' },
  { handle: 'bruno', name: 'Bruno' },
  { handle: 'carla', name: 'Carla' },
];
const config: AppConfig = {
  ...defaultConfig,
  players,
  schedule: [],
  tournament: {
    title: 'Scacchi & Chill',
    season: 'Stagione 2',
    description: '',
    winners: [{ season: 'Stagione 1', handle: 'anna', name: 'Anna', podium: [{ handle: 'greta', name: 'Greta', place: 2 }] }],
  },
};
const history: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa' },
  { round: '1', white: 'carla', black: 'anna', url: 'https://lichess.org/bbbbbbbb' },
];
const gameStates: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white', moves: 'e4 e5', createdAt: 1, lastMoveAt: 2 },
  bbbbbbbb: { id: 'bbbbbbbb', status: 'started', createdAt: 1 },
};
const row = (handle: string, name: string, points: number, won: number, drawn: number, lost: number) => ({
  handle,
  name,
  points,
  played: won + drawn + lost,
  won,
  drawn,
  lost,
  sb: 0,
});
const season1: SeasonArchive = {
  id: 'stagione-1',
  season: 'Stagione 1',
  title: 'Scacchi & Chill',
  archivedAt: '2026-10-31T00:00:00Z',
  standings: [row('anna', 'Anna', 3, 3, 0, 0), row('bruno', 'Bruno', 1, 1, 0, 2), row('dario', 'Dario', 1, 1, 0, 2)],
  gamesPlayed: 4,
  departures: [{ handle: 'gredip', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'dario', name: 'Dario' } }],
  games: [
    { round: '1', white: 'anna', black: 'bruno', result: '1-0', status: 'resign', plies: 30, id: 'cccccccc' },
    { round: '1', white: 'dario', black: 'anna', result: '0-1', status: 'mate', plies: 20 },
    { round: '2', white: 'anna', black: 'dario', result: '1-0', status: 'resign', plies: 90 },
    { round: '2', white: 'bruno', black: 'dario', result: '0-1', status: 'resign', plies: 50 },
  ],
};
const nameOf = (h: string, fallback?: string) => players.find((p) => p.handle === h)?.name ?? fallback ?? h;

const at = (hash: string) => vi.stubGlobal('window', { location: { hash } });
afterEach(() => vi.unstubAllGlobals());

const publicPage = (hash: string, seasons: SeasonArchive[] = [season1]) => {
  at(hash);
  return renderToStaticMarkup(
    <PublicTournamentView config={config} tournamentMeta={config.tournament!} history={history} gameStates={gameStates} nameOf={nameOf} seasons={seasons} />
  );
};
const playerPage = (handle: string, seasons: SeasonArchive[] = [season1]) =>
  renderToStaticMarkup(<PlayerPage handle={handle} config={config} history={history} gameStates={gameStates} nameOf={nameOf} seasons={seasons} />);

describe('public tournament page', () => {
  it('renders every section of a new tournament, with no players and no games yet', () => {
    const empty: AppConfig = { ...defaultConfig, players: [], schedule: [], tournament: { title: 'Nuovo torneo', season: 'Stagione 1', description: '' } };
    for (const hash of ['', '#/partite', '#/tabellone', '#/pillsbury', '#/stagione', '#/albo', '#/regolamento']) {
      at(hash);
      const html = renderToStaticMarkup(
        <PublicTournamentView config={empty} tournamentMeta={empty.tournament!} history={[]} gameStates={{}} nameOf={(h) => h} seasons={[]} />
      );
      expect(html).toContain('Nuovo torneo');
    }
    expect(renderToStaticMarkup(<PlayerPage handle="anna" config={empty} history={[]} gameStates={{}} nameOf={(h) => h} seasons={[]} />)).toBeTruthy();
  });

  it('renders every section', () => {
    for (const hash of ['', '#/partite', '#/tabellone', '#/pillsbury', '#/stagione', '#/albo', '#/regolamento']) {
      expect(publicPage(hash)).toContain('Scacchi &amp; Chill');
    }
  });

  it('shows the all-time table, the records and who left in the hall of fame', () => {
    const html = publicPage('#/albo');
    expect(html).toContain('Classifica di sempre');
    expect(html).toContain('Record');
    expect(html).toContain('Greta ha lasciato il torneo; al suo posto ha giocato Dario.');
    expect(html).toContain('4 vittorie consecutive di Anna');
  });

  it('has no all-time sections before the first archived season', () => {
    const html = publicPage('#/albo', []);
    expect(html).not.toContain('Classifica di sempre');
    expect(html).not.toContain('Record');
  });
});

describe('player page', () => {
  it('shows the career and the all-time head-to-heads of a current player', () => {
    const html = playerPage('anna');
    expect(html).toContain('Carriera');
    expect(html).toContain('2 stagioni');
    expect(html).toContain('in corso');
    expect(html).toContain('Scontri diretti di sempre');
  });

  it('gives a page to a former player found in an archived table', () => {
    const html = playerPage('dario');
    expect(html).toContain('Dario');
    expect(html).toContain('Non partecipa alla stagione in corso.');
    expect(html).toContain('al posto di Greta');
    expect(html).toContain('Scontri diretti di sempre');
  });

  it('gives a page to a former player known only from the hall of fame', () => {
    const html = playerPage('greta');
    expect(html).toContain('Greta');
    expect(html).not.toContain('Carriera');
  });

  it('says when a player is unknown', () => {
    expect(playerPage('zeno')).toContain('Giocatore «zeno» non trovato.');
  });

  it('shows the highest Elo and the best colpaccio, from the second season on', () => {
    // Bruno, far below Anna after the first season, beats her
    const upsetHistory: HistoryGame[] = [{ round: '1', white: 'bruno', black: 'anna', url: 'https://lichess.org/dddddddd' }];
    const states = { dddddddd: { id: 'dddddddd', status: 'resign', winner: 'white' as const, createdAt: 1, lastMoveAt: 2 } };
    const html = renderToStaticMarkup(<PlayerPage handle="bruno" config={config} history={upsetHistory} gameStates={states} nameOf={nameOf} seasons={[season1]} />);
    expect(html).toContain('Elo massimo');
    expect(html).toContain('Colpaccio migliore');
    expect(html).toContain('href="https://lichess.org/dddddddd"');
    // In the Carriera, under its summary
    expect(html.indexOf('Elo massimo')).toBeGreaterThan(html.indexOf('Carriera'));
    expect(playerPage('anna')).not.toContain('Colpaccio migliore');
    // In the first season no level is known yet
    const first = playerPage('anna', []);
    expect(first).not.toContain('Elo massimo');
    expect(first).not.toContain('Colpaccio migliore');
  });

  it('has no sections across seasons without an archive', () => {
    const html = playerPage('anna', []);
    expect(html).not.toContain('Carriera');
    expect(html).not.toContain('Scontri diretti di sempre');
  });
});

describe('names from the players register', () => {
  it('shows a renamed player with the new name in past seasons and in the hall of fame', async () => {
    const { NamesContext } = await import('../Names');
    const { rosterNameOf } = await import('../../lib/roster');
    const renamed = rosterNameOf([{ handle: 'anna', name: 'Anna R.' }, { handle: 'gredip', name: 'Greta D.' }]);
    at('#/albo');
    const html = renderToStaticMarkup(
      <NamesContext.Provider value={renamed}>
        <PublicTournamentView config={config} tournamentMeta={config.tournament!} history={history} gameStates={gameStates} nameOf={renamed} seasons={[season1]} />
      </NamesContext.Provider>
    );
    // Albo d'Oro, past season's table and the note on who left
    expect(html.match(/Anna R\./g)!.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('Greta D. ha lasciato il torneo');
  });
});

describe('awards of a past season', () => {
  it('link the game of the award, found in the archived games', () => {
    const withAwards = {
      ...season1,
      awards: [{ id: 'fastest', emoji: '⚡', title: 'Fulmine', description: '', winners: [{ handle: 'anna', name: 'Anna' }], detail: 'in 10 mosse' }],
      games: [{ round: '1', white: 'anna', black: 'bruno', result: '1-0' as const, status: 'mate', plies: 19, id: 'cccccccc' }],
    };
    const html = publicPage('#/albo', [withAwards]);
    expect(html).toContain('in 10 mosse');
    expect(html).toContain('href="https://lichess.org/cccccccc"');
    expect(html).toContain('vedi su Lichess');
  });

  it('leave out Re del matto, no longer given', () => {
    const award = (id: string, title: string) => ({ id, emoji: '', title, description: '', winners: [{ handle: 'anna', name: 'Anna' }], detail: '' });
    const html = publicPage('#/albo', [{ ...season1, awards: [award('mate', 'Re del matto'), award('fastest', 'Fulmine')] }]);
    expect(html).not.toContain('Re del matto');
    expect(html).toContain('Fulmine');
    expect(html).toContain('>Premi<');
    // A season with only Re del matto has no Premi at all
    expect(publicPage('#/albo', [{ ...season1, awards: [award('mate', 'Re del matto')] }])).not.toContain('>Premi<');
  });
});

describe('the all-time table', () => {
  it('has a Trofeo Pillsbury column once one has been given', () => {
    const header = 'title="Trofeo Pillsbury vinti"';
    expect(publicPage('#/albo')).not.toContain(header);
    const award = { id: 'pillsbury', emoji: '', title: '', description: '', winners: [{ handle: 'bruno', name: 'Bruno' }], detail: '' };
    expect(publicPage('#/albo', [{ ...season1, awards: [award] }])).toContain(header);
  });
});

describe('the reigning Trofeo Pillsbury', () => {
  const won: SeasonArchive = {
    ...season1,
    awards: [{ id: 'pillsbury', emoji: '🌱', title: 'Trofeo Pillsbury', description: '', winners: [{ handle: 'bruno', name: 'Bruno' }], detail: '' }],
  };
  it('has its medal next to the name in the standings and on the shelf of the player page', () => {
    const html = publicPage('', [won]);
    expect(html).toContain('Trofeo Pillsbury in carica · Stagione 1');
    expect(html).toContain('class="pillsbury-icon"');
    expect(html).not.toContain('🌱'); // archived with the sprout, shown with the medal
    expect(publicPage('', [season1])).not.toContain('Trofeo Pillsbury in carica');
    expect(playerPage('bruno', [won])).toContain('Trofeo Pillsbury · Stagione 1');
    expect(playerPage('bruno', [won])).toContain('class="pillsbury-icon"');
  });
});

describe('the objective on the player page', () => {
  it('is not shown while the Trofeo Pillsbury is suspended (fewer than 4 in the race)', () => {
    // Three players, all in the race after Stagione 1: too few for the award
    expect(playerPage('anna', [season1])).not.toContain('Obiettivo');
  });
});

describe('the Elo di partenza from Lichess', () => {
  const seeded: AppConfig = {
    ...config,
    tournament: { ...config.tournament!, seeds: [{ handle: 'carla', rating: 1620, date: '2026-09-08', perf: 'rapid', lichess: 1900, offset: -280 }] },
  };
  const page = (cfg: AppConfig, handle: string) =>
    renderToStaticMarkup(<PlayerPage handle={handle} config={cfg} history={history} gameStates={gameStates} nameOf={nameOf} seasons={[season1]} />);

  it('says where a player in their first season started', () => {
    const html = page(seeded, 'carla');
    expect(html).toContain('Al primo anno: parte da 1620, il suo Elo Lichess rapid del 8 set 2026 (1900) riportato sulla scala del torneo.');
    expect(html).not.toContain('Esordiente: nelle sue partite');
  });

  it('leaves a player without one an esordiente', () => {
    const html = page(config, 'carla');
    expect(html).not.toContain('Al primo anno');
    expect(html).toContain('Esordiente: nelle sue partite si muove solo il suo Elo.');
  });
});
