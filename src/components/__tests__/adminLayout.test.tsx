import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_TABS, isAdminTab } from '../../views/AdminConsole';
import { SeasonsTab } from '../../tabs/SeasonsTab';
import { PlayersTab } from '../../tabs/PlayersTab';
import { SettingsTab } from '../../tabs/SettingsTab';
import { ReviewsTab } from '../../ReviewsTab';
import { defaultConfig } from '../../lib/config';

const noop = () => {};
const settings = { token: '', days: 3, expiry: 2, rated: true, rules: {} } as any;
const config = {
  ...defaultConfig,
  players: [{ handle: 'anna', name: 'Anna' }, { handle: 'bruno', name: 'Bruno' }],
  tournament: { ...(defaultConfig.tournament as any), winners: [] },
} as any;
const organizer = { anecdotes: {}, ratings: {}, setAnecdote: noop, setRatings: noop, statusPhrases: null, setStatusPhrases: noop } as any;
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
    expect(summaries(html)).toEqual(['Stagione corrente', 'Regolamento', 'Calendario', 'Fine stagione e storico (0)']);
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
      <SettingsTab config={config} settings={settings} setSettings={noop as any} templates={config.messageTemplates} setTemplates={noop as any} history={[]} setHistory={noop as any} seasons={[]} organizer={organizer} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Token Lichess', 'Copia dei dati']);
    expect(html).toMatch(/<details class="settings-section" open="">\s*<summary>Token Lichess/);
    expect(html).not.toContain('Frasi del bollettino');
  });

  it('points to Stagioni for the calendar when there are no rounds', async () => {
    const { RoundsTab } = await import('../../tabs/RoundsTab');
    const html = renderToStaticMarkup(
      <RoundsTab openRound="" setOpenRound={noop} config={{ ...config, schedule: [] }} settings={settings} templates={config.messageTemplates} history={[]} setHistory={noop as any} gameStates={{}} onUpdateSchedule={noop} nameOf={(h) => h} flash={noop} triggerToast={noop} onMissingToken={noop} onOpenCalendar={noop} />
    );
    expect(html).toContain('♛ Stagioni → Calendario');
    expect(html).not.toContain('Genera i turni in automatico');
  });

  it('gathers the review, the awards and the message texts in WhatsApp', async () => {
    const { WhatsAppTab } = await import('../../tabs/WhatsAppTab');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(
      <WhatsAppTab config={config} history={[]} gameStates={{}} nameOf={(h) => h} templates={config.messageTemplates} setTemplates={noop as any} organizer={organizer} flash={noop} />
    );
    vi.unstubAllGlobals();
    expect(summaries(html)).toEqual(['✨ Il racconto della stagione', '🏆 Premi della stagione', 'Testi dei messaggi']);
    expect(html).toContain('Messaggio con i link del turno');
    expect(html).toContain('Frasi del bollettino');
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
