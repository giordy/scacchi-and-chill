import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_TABS, isAdminTab } from '../../views/AdminConsole';
import { TournamentTab } from '../../tabs/TournamentTab';
import { SettingsTab } from '../../tabs/SettingsTab';
import { ReviewsTab } from '../../ReviewsTab';
import { defaultConfig } from '../../lib/config';

const noop = () => {};
const settings = { token: '', days: 3, expiry: 2, rated: true, rules: {} } as any;
const config = { ...defaultConfig, tournament: { ...(defaultConfig.tournament as any), winners: [] } } as any;
const organizer = { anecdotes: {}, ratings: {}, setAnecdote: noop, setRatings: noop, statusPhrases: null, setStatusPhrases: noop } as any;
const summaries = (html: string) => [...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);

describe('admin layout', () => {
  it('has four tabs, settings last', () => {
    expect(ADMIN_TABS.map((t) => t.key)).toEqual(['rounds', 'reviews', 'tournament', 'settings']);
    expect(isAdminTab('settings')).toBe(true);
    expect(isAdminTab('options')).toBe(false);
  });

  it('keeps the season in Torneo, with the challenge settings under the rules', () => {
    const html = renderToStaticMarkup(
      <TournamentTab config={config} settings={settings} setSettings={noop as any} history={[]} setHistory={noop as any} onSeasonReset={noop} gameStates={{}} seasons={[]} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Stagione corrente', `Giocatori (${config.players.length})`, 'Regolamento', 'Fine stagione e storico (0)']);
    const rules = html.slice(html.indexOf('<summary>Regolamento'));
    expect(rules.indexOf('Validità del link di sfida')).toBeLessThan(rules.indexOf('Come funziona il torneo'));
    expect(html).not.toContain('Token API Lichess');
  });

  it('puts the set-and-forget settings in Impostazioni, the token open while missing', () => {
    const html = renderToStaticMarkup(
      <SettingsTab config={config} settings={settings} setSettings={noop as any} templates={config.messageTemplates} setTemplates={noop as any} history={[]} setHistory={noop as any} seasons={[]} organizer={organizer} flash={noop} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />
    );
    expect(summaries(html)).toEqual(['Token Lichess', 'Messaggi WhatsApp', 'Copia dei dati']);
    expect(html).toMatch(/<details class="settings-section" open="">\s*<summary>Token Lichess/);
    expect(html).toContain('Messaggio con i link del turno');
    expect(html).toContain('Frasi del bollettino');
  });

  it('leaves the computed standings, the extra sync and the JSON download out of Recensione', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(<ReviewsTab history={[]} gameStates={{}} config={config} nameOf={(h) => h} organizer={organizer} />);
    vi.unstubAllGlobals();
    expect(html).not.toContain('classifica calcolata');
    expect(html).not.toContain('Sincronizza Partite');
    expect(html).not.toContain('Scarica JSON');
    expect(html).toContain('Scarica Elo da Lichess');
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
