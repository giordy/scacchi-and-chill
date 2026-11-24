import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_TABS, isAdminTab } from '../../views/AdminConsole';
import { SeasonsTab } from '../../tabs/SeasonsTab';
import { PlayersTab } from '../../tabs/PlayersTab';
import { SettingsTab } from '../../tabs/SettingsTab';
import { ReviewsTab } from '../../ReviewsTab';
import { SeedsSection } from '../../tabs/settings/SeedsSection';
import { defaultConfig } from '../../lib/config';

const noop = () => {};
const settings = { token: '', days: 3, expiry: 2, rated: true, rules: {} } as any;
const config = {
  ...defaultConfig,
  players: [{ handle: 'anna', name: 'Anna' }, { handle: 'bruno', name: 'Bruno' }],
  tournament: { ...(defaultConfig.tournament as any), winners: [] },
} as any;
const organizer = { anecdotes: {}, setAnecdote: noop } as any;
// The alerts behind the 🔔 of the organizer area (lib/adminAlerts.ts), as AdminApp builds them
const alertsOf = async (cfg: any, history: any[]) => {
  const { adminAlerts } = await import('../../lib/adminAlerts');
  const { AlertsPanel } = await import('../AdminAlerts');
  const alerts = adminAlerts({
    meta: cfg.tournament,
    schedule: cfg.schedule ?? [],
    history,
    gameStates: {},
    expiryDays: 2,
    tokenCheck: null,
    syncHealth: null,
    withdrawals: [],
    fairPlaySeen: [],
    now: Date.now(),
  });
  const actions = { openRound: noop, openToken: noop, fairPlaySeen: [], onFairPlaySeen: noop };
  return renderToStaticMarkup(<AlertsPanel alerts={alerts} actions={actions} nameOf={(h) => h} meta={cfg.tournament} />);
};
const summaries = (html: string) => [...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);

describe('admin layout', () => {
  it('has five tabs, settings last', () => {
    expect(ADMIN_TABS.map((t) => t.key)).toEqual(['rounds', 'whatsapp', 'players', 'seasons', 'settings']);
    expect(ADMIN_TABS.map((t) => t.label)).toEqual(['Turni', 'WhatsApp', 'Giocatori', 'Stagioni', 'Impostazioni']);
    expect(isAdminTab('tournament')).toBe(false);
    expect(isAdminTab('reviews')).toBe(false);
    expect(isAdminTab('settings')).toBe(true);
    expect(isAdminTab('options')).toBe(false);
  });

  it('keeps the season in Stagioni, with the challenge settings under the rules', () => {
    const html = renderToStaticMarkup(
      <SeasonsTab config={config} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} onSeasonReset={noop} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Stagione corrente', 'Regolamento', 'Elo di partenza', 'Calendario', 'Fine stagione e storico (0)']);
    expect(html).toContain('Genera');
    expect(html).not.toContain('Ricostruisci');
    const rules = html.slice(html.indexOf('<summary>Regolamento'));
    expect(rules.indexOf('Validità del link di sfida')).toBeLessThan(rules.indexOf('Come funziona il torneo'));
    expect(html).not.toContain('Token API Lichess');
  });

  it('has the register and the withdrawals in Giocatori, current players first', () => {
    const html = renderToStaticMarkup(
      <PlayersTab config={config} history={[]} setHistory={noop as any} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Registro dei giocatori', 'Ritiri']);
    expect(html).toContain(`In questa stagione (${config.players.length})`);
    expect(html).toContain('Togli dalla stagione');
    // Nobody in the history here, but current players cannot be deleted either
    expect(html).not.toContain('>Elimina<');
  });

  it('opens on a new tournament with no players, ready to add the first ones', () => {
    const empty = { ...config, players: [], tournament: { ...config.tournament, roster: [] } };
    const props = { config: empty, history: [], setHistory: noop as any, gameStates: {}, seasons: [], flash: noop, onUpdateTournamentMeta: noop, onUpdateSchedule: noop };
    expect(renderToStaticMarkup(<PlayersTab {...props} onUpdatePlayers={noop} />)).toContain('+ Aggiungi');
    expect(renderToStaticMarkup(<SeasonsTab {...props} settings={settings} setSettings={noop as any} onSeasonReset={noop} />)).toContain('Calendario');
  });

  it('puts the set-and-forget settings in Impostazioni, the token open while missing', () => {
    const html = renderToStaticMarkup(
      <SettingsTab config={config} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} seasons={[]} organizer={organizer} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Token Lichess', 'Avvisi all&#x27;organizzatore', 'Copia dei dati']);
    // the organizer's notices: off, and a browser without notifications here
    expect(html).toMatch(/<input id="overdue-games" type="checkbox"\/>/);
    expect(html).not.toContain('Giorni dall');
    expect(html).toContain('si accendono da un browser che le riceve');
    expect(html).toMatch(/<details class="settings-section" open=""[^>]*>\s*<summary>Token Lichess/);
    expect(html).not.toContain('Frasi del bollettino');
  });

  it('points to Stagioni for the calendar when there are no rounds', async () => {
    const { RoundsTab } = await import('../../tabs/RoundsTab');
    const html = renderToStaticMarkup(
      <RoundsTab openRound="" setOpenRound={noop} config={{ ...config, schedule: [] }} settings={settings} templates={config.messageTemplates} history={[]} setHistory={noop as any} gameStates={{}} onUpdateSchedule={noop} onUpdateTournamentMeta={noop} nameOf={(h) => h} flash={noop} triggerToast={noop} onMissingToken={noop} onOpenCalendar={noop} />
    );
    expect(html).toContain('♛ Stagioni → Calendario');
    expect(html).not.toContain('Genera i turni in automatico');
  });

  it('gathers the review and the awards in WhatsApp', async () => {
    const { WhatsAppTab } = await import('../../tabs/WhatsAppTab');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(
      <WhatsAppTab config={config} history={[]} gameStates={{}} nameOf={(h) => h} organizer={organizer} flash={noop} />
    );
    vi.unstubAllGlobals();
    expect(summaries(html)).toEqual(['✨ Il racconto della stagione', '🏆 Premi della stagione']);
    expect(html).not.toContain('Frasi del bollettino');
    expect(html).toContain('I premi compaiono quando ci sono partite concluse.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the computed standings, the extra sync and the JSON download out of Recensione', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(<ReviewsTab history={[]} gameStates={{}} config={config} nameOf={(h) => h} organizer={organizer} />);
    vi.unstubAllGlobals();
    expect(html).not.toContain('classifica calcolata');
    expect(html).not.toContain('Sincronizza Partite');
    expect(html).not.toContain('Scarica JSON');
    // The Elo is the Elo del torneo: nothing to download from Lichess
    expect(html).not.toContain('Scarica Elo da Lichess');
    expect(html).toContain('Elo del torneo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('master photo field', () => {
  const render = async (imageUrl: string) => {
    const { SeasonInfoSection } = await import('../../tabs/settings/SeasonInfoSection');
    return renderToStaticMarkup(
      <SeasonInfoSection meta={{ title: 'T', season: 'Stagione 3', description: '', imageUrl }} flash={noop} onUpdateTournamentMeta={noop} />
    );
  };

  it('offers a link or an upload when no photo was uploaded', async () => {
    const html = await render('https://example.com/x.jpg');
    expect(html).toContain('id="cfg-img"');
    expect(html).toContain('📷 Carica foto');
    expect(html).toContain('accept="image/*"');
    expect(html).toContain('Togli foto');
  });

  it('shows an uploaded photo as such, not as its reference', async () => {
    const html = await render('media:stagione-3');
    expect(html).toContain("Foto caricata dall&#x27;area organizzatore.");
    expect(html).not.toContain('media:stagione-3');
    expect(html).toContain('📷 Cambia foto');
  });

  it('has nothing to remove without a photo', async () => {
    expect(await render('')).not.toContain('Togli foto');
  });
});

describe('hall of fame form', () => {
  it('asks for the period of a season, month by month', async () => {
    const { HallOfFameSection } = await import('../../tabs/settings/HallOfFameSection');
    const winners = [{ season: 'Stagione 1', name: 'Anna', handle: 'anna', start: '2025-10', end: '2026-02' }, { season: 'Stagione 0', name: 'Bruno', handle: 'bruno', year: '2024' }];
    const html = renderToStaticMarkup(<HallOfFameSection winners={winners} players={[]} flash={noop} onUpdateTournamentMeta={noop} />);
    expect(html).toContain('id="hof-start" type="month"');
    expect(html).toContain('id="hof-end" type="month"');
    expect(html).toContain('ott 2025 – feb 2026');
    expect(html).toContain(' · 2024');
  });
});

describe('players register', () => {
  const row = (handle: string, name: string) => ({ handle, name, points: 1, played: 1, won: 1, drawn: 0, lost: 0, sb: 0 });
  const season1 = { id: 's1', season: 'Stagione 1', title: 'T', archivedAt: '2026-01-01T00:00:00Z', gamesPlayed: 1, standings: [row('battimat', 'Matteo'), row('ma_pi', 'Matteo'), row('roxylinz', 'Bianca')] } as any;
  const cfg = {
    ...config,
    players: [{ handle: 'battimat', name: 'Matteo' }],
    tournament: { ...config.tournament, roster: [{ handle: 'nuovo1', name: 'Nuovo' }] },
  };

  it('groups current, past and never-played players, and flags the same name twice', async () => {
    const { RosterSection } = await import('../../tabs/settings/RosterSection');
    const html = renderToStaticMarkup(
      <RosterSection meta={cfg.tournament} players={cfg.players} seasons={[season1]} history={[]} schedule={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} />
    );
    expect(html).toContain('In questa stagione (1)');
    expect(html).toContain('Nello storico');
    expect(html).toContain('Registrati, senza partite');
    expect(html).toContain('Alcuni giocatori hanno lo stesso nome');
    expect(html.match(/nome doppio/g)).toHaveLength(2);
    // Only the one who never played can be deleted
    expect(html.match(/>Elimina</g)).toHaveLength(1);
  });
});

describe('Elo di partenza in Stagioni', () => {
  const season1 = {
    id: 's1', season: 'Stagione 1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: 1,
    standings: [{ handle: 'anna', name: 'Anna', played: 1, won: 1, drawn: 0, lost: 0, points: 1, sb: 0 }],
    games: [],
  } as any;
  const cfg = {
    ...config,
    players: ['anna', 'carla', 'dario', 'elena', 'fabio'].map((handle) => ({ handle, name: handle })),
    tournament: {
      ...config.tournament,
      seeds: [
        { handle: 'carla', rating: 1620, date: '2026-09-08', perf: 'rapid', lichess: 1900, offset: -280, regulars: [{ handle: 'anna', elo: 1700, ratings: { rapid: 1980, blitz: 1500 } }, { handle: 'bruno', elo: 1600, ratings: { blitz: 1400 } }] },
        { handle: 'dario', rating: null, date: '2026-09-08', reason: 'Elo blitz 1700 affidabile, ma solo 2 veterani con l\'Elo blitz affidabile a quella data (ne servono 3)' },
      ],
    },
  } as any;
  const history = [{ round: '1', white: 'elena', black: 'anna', url: 'https://lichess.org/aaaaaaaa', createdAt: Date.parse('2026-10-08T10:00:00Z') }];

  it('lists who plays their first season, with where each starts', () => {
    const html = renderToStaticMarkup(<SeedsSection config={cfg} history={history} gameStates={{}} seasons={[season1]} />);
    expect(html).toContain('<strong>carla</strong> · 1620');
    expect(html).toContain('Lichess rapid 1900 del 8 set 2026, correzione −280. Veterani usati (Elo del torneo/Lichess): anna 1700/1980');
    expect(html).not.toContain('bruno 1600'); // no rapid: not used
    const halfway = renderToStaticMarkup(
      <SeedsSection config={{ ...cfg, tournament: { ...cfg.tournament, seeds: [{ handle: 'carla', rating: 1610, date: '2026-09-08', perf: 'blitz', lichess: 1500, offset: 120, mean: 1600, rule: 2 }] } }} history={history} gameStates={{}} seasons={[season1]} />
    );
    expect(halfway).toContain('Lichess blitz 1500 del 8 set 2026, correzione +120 (1620), poi a metà strada verso la media dei veterani (1600)');
    expect(html).toContain('<strong>dario</strong> · esordiente');
    expect(html).toContain('al 8 set 2026: Elo blitz 1700 affidabile, ma solo 2 veterani'); // why, from the seed
    expect(html).toContain('Si ricontrolla a ogni apertura.');
    expect(html).toContain('<strong>elena</strong> · in calcolo'); // first game there, seed not fixed yet
    expect(html).toContain('<strong>fabio</strong> · in attesa');
    expect(html).not.toContain('<strong>anna</strong>'); // played Stagione 1
  });

  it('has nothing to list in the first season of the tournament', () => {
    expect(renderToStaticMarkup(<SeedsSection config={cfg} history={history} gameStates={{}} seasons={[]} />)).toContain('sono tutti esordienti');
  });
});

describe('scudetto colour field', () => {
  const archive = (season: string, masterName: string, masterColor?: string) =>
    ({ id: season, season, title: 'T', masterName, masterColor, archivedAt: '2027-04-01T00:00:00Z', standings: [], gamesPlayed: 0 });
  const render = async (masterName: string, masterColor: string) => {
    const { SeasonInfoSection } = await import('../../tabs/settings/SeasonInfoSection');
    return renderToStaticMarkup(
      <SeasonInfoSection
        meta={{ title: 'T', season: 'Stagione 3', description: '', masterName, masterColor }}
        seasons={[archive('Stagione 2', 'José Raúl Capablanca', '#5b3f86')]}
        flash={noop}
        onUpdateTournamentMeta={noop}
      />
    );
  };

  it('warns when the chosen colour is the one of an earlier scudetto with the same initial', async () => {
    const html = await render('Magnus Carlsen', '#5b3f86');
    expect(html).toContain('Attenzione');
    expect(html).toContain('Scudetto Capablanca (Stagione 2)');
    expect(html).toContain('is-taken');
  });

  it('does not warn for another initial, and lets the site choose by default', async () => {
    expect(await render('Mikhail Tal', '#5b3f86')).not.toContain('Attenzione');
    const auto = await render('Magnus Carlsen', '');
    expect(auto).not.toContain('Attenzione');
    expect(auto).toContain('Lo sceglie il sito: blu');
  });

  it('offers no colours without a master: the season is the Scudetto Chill', async () => {
    const html = await render('', '');
    expect(html).toContain('Scudetto Chill');
    expect(html).not.toContain('cfg-color-auto');
  });
});

describe('Turni con scadenza in the organizer area', () => {
  const past = Date.now() - 86400e3;
  const games = [
    { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', createdAt: past - 14 * 86400e3, lichess: { id: 'aaaaaaaa', status: 'started' } },
  ] as any[];
  const schedule = [
    { round: '1', white: 'anna', black: 'bruno' },
    { round: '2', white: 'bruno', black: 'anna' },
  ];
  const withDeadlines = (roundDays: number) => ({
    ...config,
    schedule,
    tournament: { ...config.tournament, roundDays, roundEnds: [{ round: '1', at: past }] },
  });
  const rounds = async (cfg: any, openRound = '') => {
    const { RoundsTab } = await import('../../tabs/RoundsTab');
    return renderToStaticMarkup(
      <RoundsTab openRound={openRound} setOpenRound={noop} config={cfg} settings={settings} templates={config.messageTemplates} history={games} setHistory={noop as any} gameStates={{}} onUpdateSchedule={noop} onUpdateTournamentMeta={noop} nameOf={(h) => h} flash={noop} triggerToast={noop} onMissingToken={noop} />
    );
  };

  it('is off by default, with its switch under the rules', () => {
    const html = renderToStaticMarkup(
      <SeasonsTab config={config} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} onSeasonReset={noop} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdateSchedule={noop} />
    );
    expect(html).toMatch(/<input id="round-deadline" type="checkbox"\/>/);
    expect(html).not.toContain('Durata del turno');
    const on = renderToStaticMarkup(
      <SeasonsTab config={withDeadlines(14)} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} onSeasonReset={noop} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdateSchedule={noop} />
    );
    expect(on).toMatch(/<input id="round-deadline" type="checkbox" checked=""\/>/);
    expect(on).toContain('Durata del turno (giorni)');
    expect(on).toContain('Ogni turno dura 14 giorni');
    // the notification to the organizer: in Impostazioni now
    expect(on).toContain('La notifica quando scade un turno si accende in Impostazioni');
    expect(html).not.toContain('La notifica quando scade un turno');
    // the last rounds without overlap: a switch of its own, off
    expect(on).toMatch(/<input id="final-rounds" type="checkbox"\/>/);
    expect(on).not.toContain('Quante giornate');
    const last = renderToStaticMarkup(
      <SeasonsTab config={{ ...withDeadlines(14), tournament: { ...withDeadlines(14).tournament, finalRoundsWait: 3 } }} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} onSeasonReset={noop} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdateSchedule={noop} />
    );
    expect(last).toMatch(/<input id="final-rounds" type="checkbox" checked=""\/>/);
    expect(last).toContain('Le ultime 3 giornate partono solo quando sono finite tutte le partite dei turni prima');
  });

  it('tells when the round is over and the next one can start, the open games going on', async () => {
    const html = await alertsOf(withDeadlines(14), games);
    expect(html).toMatch(/Il Turno 1 è scaduto \S+ \d+ \S+: puoi creare il Turno 2\. Continua accanto al nuovo turno: anna – bruno\./);
    expect(html).toContain('Apri il Turno 2');
    expect(await rounds(withDeadlines(14))).toContain('>Scaduto<');
    // switched off: as before
    expect(await alertsOf(withDeadlines(0), games)).not.toContain('è scaduto');
    expect(await rounds(withDeadlines(0))).not.toContain('>Scaduto<');
  });

  it('in the last rounds waits for the games still open instead of proposing the next round', async () => {
    // two rounds in the calendar, the last one waits
    const last = { ...withDeadlines(14), tournament: { ...withDeadlines(14).tournament, finalRoundsWait: 1 } };
    const html = await alertsOf(last, games);
    expect(html).toMatch(/Il Turno 1 si è chiuso \S+ \d+ \S+\. Siamo alle ultime giornate: il Turno 2 parte\s+quando finisce l&#x27;ultima partita ancora in corso\./);
    // nobody is named while they are waited for
    expect(html).not.toContain('anna – bruno');
    expect(html).not.toContain('puoi creare il Turno 2');
    const second = await rounds(last, '2');
    expect(second).toContain('È una delle ultime giornate: parte quando finisce l&#x27;ultima partita ancora in corso.');
    expect(second).not.toContain('anna – bruno');
    const first = await rounds(last, '1');
    expect(first).toContain('nelle ultime giornate il turno successivo parte quando sono finite tutte le partite');
  });

  it('holds the next round while one of its players already has two games open, naming nobody', async () => {
    const { RoundsTab } = await import('../../tabs/RoundsTab');
    const busyGames = [
      games[0],
      { round: '2', white: 'carla', black: 'anna', url: 'https://lichess.org/bbbbbbbb', createdAt: past - 86400e3, lichess: { id: 'bbbbbbbb', status: 'started' } },
    ] as any[];
    const cfg = {
      ...config,
      players: [...config.players, { handle: 'carla', name: 'Carla' }],
      schedule: [schedule[0], { round: '2', white: 'carla', black: 'anna' }, { round: '3', white: 'anna', black: 'bruno' }],
      tournament: { ...config.tournament, roundDays: 14, roundEnds: [{ round: '2', at: past }] },
    };
    const render = (openRound: string) =>
      renderToStaticMarkup(
        <RoundsTab openRound={openRound} setOpenRound={noop} config={cfg} settings={settings} templates={config.messageTemplates} history={busyGames} setHistory={noop as any} gameStates={{}} onUpdateSchedule={noop} onUpdateTournamentMeta={noop} nameOf={(h) => h} flash={noop} triggerToast={noop} onMissingToken={noop} />
      );
    const list = await alertsOf(cfg, busyGames);
    expect(list).toMatch(/Il Turno 2 si è chiuso \S+ \d+ \S+\. Il Turno 3 parte quando chi ha già 2 partite in corso ne chiude una\./);
    expect(list).not.toContain('puoi creare il Turno 3');
    expect(list).not.toMatch(/anna – |carla – /);
    expect(render('3')).toContain('Parte quando chi ha già 2 partite in corso ne chiude una.');
    expect(render('2')).toContain('il turno successivo parte quando chi ha già 2 partite in corso ne chiude una');
  });

  it('shows the end of a round, to move or remove, and what the next round will get', async () => {
    const first = await rounds(withDeadlines(14), '1');
    expect(first).toMatch(/🗓️ Scaduto \S+ \d+ \S+: le partite ancora aperte continuano accanto al turno successivo\./);
    expect(first).toContain('Togli la scadenza');
    expect(first).toMatch(/type="date" value="\d{4}-\d{2}-\d{2}"/);
    const second = await rounds(withDeadlines(14), '2');
    expect(second).toMatch(/Creando le sfide, il Turno 2 durerà 14 giorni: fino a \S+ \d+ \S+\./);
    // a round started before the option was on: it can be given one
    const before = await rounds({ ...withDeadlines(14), tournament: { ...config.tournament, roundDays: 14 } }, '1');
    expect(before).toContain('non ha una scadenza');
    expect(before).toContain('Dagli 14 giorni dalla creazione');
    expect(await rounds(withDeadlines(0), '1')).not.toContain('🗓️');
  });

  it('writes the end and the games still open in the message of the round', async () => {
    const { LaunchMessage } = await import('../../tabs/rounds/LaunchMessage');
    const props = {
      round: '2',
      matches: [{ white: 'bruno', black: 'anna', url: 'https://lichess.org/cccccccc', scheduled: true }],
      byes: [],
      config,
      settings,
      templates: config.messageTemplates,
      nameOf: (h: string) => h,
      flash: noop,
    };
    const html = renderToStaticMarkup(<LaunchMessage {...props} roundEnd={Date.UTC(2026, 11, 7, 23)} carryOver={games} />);
    expect(html).toContain('Il turno si chiude lunedì 7 dicembre: chi non ha finito continua anche dopo');
    expect(html).toContain('Continuano dai turni precedenti: anna – bruno (Turno 1)');
    const plain = renderToStaticMarkup(<LaunchMessage {...props} />);
    expect(plain).not.toContain('si chiude');
    expect(plain).not.toContain('Continuano');
  });
});

describe('results decided by the organizer and games past the days allowed', () => {
  const longAgo = Date.now() - 40 * 86400e3;
  const history = [
    { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', createdAt: longAgo, lichess: { id: 'aaaaaaaa', status: 'started', moves: 'e4 e5' } },
  ] as any[];
  const cfg = (extra: object) => ({ ...config, schedule: [{ round: '1', white: 'anna', black: 'bruno' }], tournament: { ...config.tournament, ...extra } });
  const rounds = async (c: any, h: any[], openRound = '') => {
    const { RoundsTab } = await import('../../tabs/RoundsTab');
    return renderToStaticMarkup(
      <RoundsTab openRound={openRound} setOpenRound={noop} config={c} settings={settings} templates={config.messageTemplates} history={h} setHistory={noop as any} gameStates={{}} onUpdateSchedule={noop} onUpdateTournamentMeta={noop} nameOf={(x) => x} flash={noop} triggerToast={noop} onMissingToken={noop} />
    );
  };

  it('lists the games past the days allowed in Turni, only with the option on', async () => {
    const html = await alertsOf(cfg({ overdueDays: 21 }), history);
    expect(html).toContain('Una partita è andata oltre i 21 giorni');
    expect(html).toMatch(/anna – bruno \(Turno 1, limite \S+ \d+ \S+\)/);
    expect(html).toContain('puoi registrare tu il risultato dalla partita (⚖️)');
    expect(await alertsOf(cfg({}), history)).not.toContain('oltre i');
    // decided: not past the limit any more, and the round is over
    const decided = [{ ...history[0], decision: { result: '½-½', at: Date.now() } }];
    expect(await alertsOf(cfg({ overdueDays: 21 }), decided)).not.toContain('oltre i');
    expect(await rounds(cfg({ overdueDays: 21 }), decided)).toContain('>Concluso<');
  });

  it('offers the decision on every game created, and shows the one taken', async () => {
    const open = await rounds(cfg({}), history, '1');
    expect(open).toContain('aria-label="Risultato deciso dall&#x27;organizzatore per anna – bruno"');
    const decided = await rounds(cfg({}), [{ ...history[0], decision: { result: '0-0', at: Date.now() } }], '1');
    expect(decided).toContain('⚖️ Deciso');
    // no new link while decided: it would drop the decision
    expect(decided).not.toContain('title="Nuovo link"');
  });

  it('has a panel to decide, with the four results and what Lichess says', async () => {
    const { DecisionPanel, lichessSummary } = await import('../../tabs/rounds/DecisionPanel');
    const html = renderToStaticMarkup(<DecisionPanel game={history[0]} state={history[0].lichess} nameOf={(x) => x[0].toUpperCase() + x.slice(1)} flash={noop} onSaved={noop} />);
    expect(html).toContain('1-0: vince Anna');
    expect(html).toContain('0-1: vince Bruno');
    expect(html).toContain('½-½: patta');
    expect(html).toContain('0-0: persa per entrambi');
    expect(html).toContain('Su Lichess la partita è in corso, meno di 10 mosse');
    expect(html).not.toContain('Torna al risultato di Lichess');
    const taken = renderToStaticMarkup(
      <DecisionPanel game={{ ...history[0], decision: { result: '0-0', at: Date.UTC(2026, 11, 15, 12), note: 'nessun accordo' } }} nameOf={(x) => x} flash={noop} onSaved={noop} />
    );
    expect(taken).toContain('Deciso il 15 dicembre: <strong>0-0: persa per entrambi</strong>. Nota: nessun accordo');
    expect(taken).toContain('Torna al risultato di Lichess');
    expect(lichessSummary(undefined)).toBe('la sfida non è ancora stata accettata');
    expect(lichessSummary({ id: 'x', status: 'started' })).toBe('iniziata, ma nessuno ha ancora mosso');
    expect(lichessSummary({ id: 'x', status: 'mate', winner: 'black' })).toBe('già finita (0-1): il risultato deciso la sostituisce');
  });
});
