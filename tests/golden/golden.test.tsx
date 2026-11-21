// Golden tests: the texts the site shows and sends, in every scenario (see scenarios.ts), saved in
// tests/golden/<locale>/. They protect the live tournament during the i18n refactor: the Italian
// output must stay exactly as it was. A change shows as a diff of the .txt file; when it is wanted,
// `npx vitest run tests/golden -u` writes the new files, to be reviewed in the diff.
process.env.TZ = 'Europe/Rome';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { scenarios, seeded, Scenario } from './scenarios';
import { htmlText } from './htmlText';
import { PublicTournamentView } from '../../src/PublicTournamentView';
import { PlayerPage } from '../../src/views/PlayerPage';
import { AdminConsole } from '../../src/views/AdminConsole';
import { RoundsTab } from '../../src/tabs/RoundsTab';
import { WhatsAppTab } from '../../src/tabs/WhatsAppTab';
import { ReviewsTab } from '../../src/ReviewsTab';
import { PlayersTab } from '../../src/tabs/PlayersTab';
import { SeasonsTab } from '../../src/tabs/SeasonsTab';
import { SettingsTab } from '../../src/tabs/SettingsTab';
import { LaunchMessage } from '../../src/tabs/rounds/LaunchMessage';
import { BulletinSection } from '../../src/tabs/rounds/BulletinSection';
import { roundsOf } from '../../src/lib/rounds';
import { FairPlayAlert } from '../../src/components/FairPlayAlert';
import { SeasonChecklistPanel } from '../../src/components/SeasonChecklistPanel';
import { NamesContext } from '../../src/components/Names';
import { buildBulletin } from '../../src/lib/bulletin';
import { buildMasterPrompt } from '../../src/lib/masterPrompt';
import { awardsMessage, computeSeasonAwards } from '../../src/lib/awards';
import { championText, computeStandings, leaderText } from '../../src/lib/standings';
import { closeReminders, seasonChecklist } from '../../src/lib/seasonChecklist';
import { fullRoster } from '../../src/lib/roster';
import { byRound } from '../../src/lib/games';
import { pledgeDocId, pledgeStatus, rulesVersion, Pledge } from '../../src/lib/pledges';
import { movesNews, notificationFor } from '../../scripts/push.mjs';
import { setLocale } from '../../src/i18n';

const LOCALE = 'it';
const file = (s: Scenario, name: string) => `./${LOCALE}/${s.name}/${name}.txt`;
const noop = () => {};

const PUBLIC_VIEWS: Record<string, string> = {
  standings: '',
  crosstable: '#/tabellone',
  pillsbury: '#/pillsbury',
  matches: '#/partite',
  timeline: '#/cronaca',
  season: '#/stagione',
  hall: '#/albo',
  rules: '#/regolamento',
};

// Who accepted the rules: everyone but the last player of the list, a day apart
function pledgesOf(s: Scenario): Pledge[] {
  const meta = s.config.tournament!;
  const version = rulesVersion(meta);
  return s.config.players.slice(0, -1).map((p, i) => ({
    handle: p.handle.toLowerCase(),
    season: meta.season,
    at: s.now - (10 - i) * 86_400_000,
    rules: version,
  }));
}

const settingsOf = (s: Scenario) => ({ token: 'lip_test', days: s.config.defaults?.days ?? 2, expiry: s.config.defaults?.expiry ?? 2, rated: true, rules: s.config.defaults?.rules ?? {} }) as any;
const organizerOf = () => ({ anecdotes: {}, settings: {}, fairPlaySeen: [], checklist: {}, loaded: true, setAnecdote: noop, replaceAll: noop, setSettings: noop }) as any;

const all = scenarios();

beforeAll(() => {
  setLocale(LOCALE);
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterAll(() => vi.unstubAllGlobals());

describe.each(all.map((s) => [s.name, s] as const))('golden texts: %s', (_name, s) => {
  const withTime = <T,>(fn: () => T): T => {
    vi.useFakeTimers({ now: s.now, toFake: ['Date'] });
    try {
      return fn();
    } finally {
      vi.useRealTimers();
    }
  };
  const render = (node: React.ReactElement, hash = '') =>
    withTime(() => {
      vi.stubGlobal('window', { location: { hash, search: '', href: `https://example.org/${hash}` }, matchMedia: () => ({ matches: false }) });
      try {
        return htmlText(renderToStaticMarkup(<NamesContext.Provider value={s.nameOf}>{node}</NamesContext.Provider>));
      } finally {
        vi.stubGlobal('window', undefined);
      }
    });
  const pledges = pledgesOf(s);
  const meta = s.config.tournament!;

  it.each(Object.entries(PUBLIC_VIEWS))('public view %s', async (view, hash) => {
    const text = render(
      <PublicTournamentView config={s.config} tournamentMeta={meta} history={s.history} gameStates={s.gameStates} nameOf={s.nameOf} seasons={s.seasons} pledges={pledges} movesRead />,
      hash
    );
    await expect(text).toMatchFileSnapshot(file(s, `public-${view}`));
  });

  it('player pages', async () => {
    const roster = fullRoster({ roster: meta.roster, players: s.config.players, seasons: s.seasons, winners: meta.winners });
    const pages = roster.map((p) => `===== ${p.handle} =====\n` + render(<PlayerPage handle={p.handle} config={s.config} history={s.history} gameStates={s.gameStates} nameOf={s.nameOf} seasons={s.seasons} />, `#/giocatore/${p.handle}`));
    await expect(pages.join('\n') || '(none)\n').toMatchFileSnapshot(file(s, 'player-pages'));
  });

  it('organizer area', async () => {
    const settings = settingsOf(s);
    const organizer = organizerOf();
    const common = { config: s.config, history: s.history, setHistory: noop as any, gameStates: s.gameStates, seasons: s.seasons, flash: noop };
    const checklistInput = {
      meta,
      players: s.config.players,
      schedule: s.config.schedule ?? [],
      history: s.history,
      gameStates: s.gameStates,
      pledges: pledgeStatus(pledges, meta.season, s.config.players, rulesVersion(meta)),
      ticks: {},
    };
    const checklist = withTime(() => seasonChecklist(checklistInput));
    const rounds = [...new Set([...(s.config.schedule ?? []).map((m) => m.round), ...s.history.map((g) => g.round)])];
    const parts: Array<[string, React.ReactElement]> = [
      ['console', <AdminConsole title={meta.title} email="organizer@example.org" onLogout={noop} activeTab="rounds" setActiveTab={noop} isSyncing={false} lastSyncTime="12:00" onSync={noop} toastMessage={null}>{null}</AdminConsole>],
      ['fair play alert', <FairPlayAlert history={s.history} gameStates={s.gameStates} withdrawals={meta.withdrawals ?? []} seen={[]} onSeen={noop} nameOf={s.nameOf} awardsBan={meta.fairPlayAwardsBan} />],
      ['season checklist', checklist ? <SeasonChecklistPanel checklist={checklist} onGo={noop} onTick={noop} /> : <p>(no checklist)</p>],
      ...['', ...rounds].map((round): [string, React.ReactElement] => [
        `rounds tab, open round "${round}"`,
        <RoundsTab openRound={round} setOpenRound={noop} config={s.config} settings={settings} templates={s.config.messageTemplates} history={s.history} setHistory={noop as any} gameStates={s.gameStates} onUpdateSchedule={noop} nameOf={s.nameOf} flash={noop} triggerToast={noop} onMissingToken={noop} onOpenCalendar={noop} seasons={s.seasons} />,
      ]),
      ...roundsOf(s.config.schedule ?? [], s.rawHistory).map((r): [string, React.ReactElement] => [
        `launch message, round ${r.round}`,
        <LaunchMessage round={r.round} matches={r.matches} byes={[]} config={s.config} settings={settings} templates={s.config.messageTemplates} nameOf={s.nameOf} flash={noop} />,
      ]),
      ['launch message with a bye', <LaunchMessage round="1" matches={roundsOf(s.config.schedule ?? [], s.rawHistory)[0]?.matches ?? []} byes={['Zoe']} config={s.config} settings={settings} templates={s.config.messageTemplates} nameOf={s.nameOf} flash={noop} />],
      ['bulletin section', <BulletinSection round="1" history={s.rawHistory} config={s.config} expiryDays={settings.expiry} triggerToast={noop} seasons={s.seasons} />],
      ['whatsapp tab', <WhatsAppTab config={s.config} history={s.history} gameStates={s.gameStates} nameOf={s.nameOf} organizer={organizer} flash={noop} triggerToast={noop} seasons={s.seasons} />],
      ['reviews', <ReviewsTab history={s.history} gameStates={s.gameStates} config={s.config} nameOf={s.nameOf} triggerToast={noop} organizer={organizer} seasons={s.seasons} />],
      ['players tab', <PlayersTab {...common} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />],
      ['seasons tab', <SeasonsTab {...common} settings={settings} setSettings={noop as any} onSeasonReset={noop} onUpdateTournamentMeta={noop} onUpdateSchedule={noop} closeReminders={withTime(() => closeReminders(checklistInput))} />],
      ['settings tab', <SettingsTab {...common} settings={settings} setSettings={noop as any} organizer={organizer} onUpdateTournamentMeta={noop} onUpdatePlayers={noop} onUpdateSchedule={noop} />],
    ];
    const text = parts.map(([name, node]) => `===== ${name} =====\n` + render(node, '#admin')).join('\n');
    await expect(text).toMatchFileSnapshot(file(s, 'organizer'));
  });

  it('group messages', async () => {
    const out: string[] = [];
    const rounds = [...new Set(s.rawHistory.map((g) => g.round))].sort(byRound);
    rounds.forEach((round) => {
      const games = s.rawHistory.filter((g) => g.round === round);
      const b = withTime(() =>
        buildBulletin({ round, games, states: s.gameStates, history: s.history, config: s.config, expiryDays: s.config.defaults?.expiry ?? 2, now: s.now, random: seeded(Number(round) || 1), seasons: s.seasons, matchesUrl: 'https://example.org/#/partite' })
      );
      out.push(`===== status bulletin, round ${round} =====`, b.text, '--- details ---', ...b.details);
    });
    const { standings } = computeStandings(s.config.players, s.history, s.gameStates);
    out.push('===== leader =====', withTime(() => leaderText(standings)));
    out.push('===== champion =====', withTime(() => championText(standings, 'Scudetto Capablanca')));
    s.seasons.forEach((a) => out.push(`===== awards message, archived ${a.season} =====`, awardsMessage(a.season, a.awards ?? [])));
    const awards = withTime(() =>
      computeSeasonAwards(s.config.players, s.history, s.gameStates, s.seasons, meta.seeds, meta.withdrawals, { name: meta.masterName, opening: meta.masterOpening }, meta.fairPlayAwardsBan)
    );
    out.push(`===== awards message, current season =====`, awardsMessage(meta.season, awards));
    await expect(out.join('\n') + '\n').toMatchFileSnapshot(file(s, 'messages'));
  });

  it('prompts', async () => {
    const out = [
      '===== master prompt =====',
      buildMasterPrompt({ master: meta.masterName || 'José Raúl Capablanca', rounds: new Set((s.config.schedule ?? []).map((m) => m.round)).size || 14, tournamentTitle: meta.title }),
    ];
    await expect(out.join('\n') + '\n').toMatchFileSnapshot(file(s, 'prompts'));
  });

  it('push notifications', async () => {
    const games = s.rawHistory.map((g) => ({ id: g.lichess?.id ?? g.url.split('/').pop(), white: g.white, black: g.black, round: g.round }));
    const states = Object.fromEntries(s.rawHistory.filter((g) => g.lichess).map((g) => [g.lichess!.id, g.lichess]));
    // The run before saw every game as started with an older move
    const prev = { games: Object.fromEntries(games.map((g) => [g.id, { at: 1, final: false }])) };
    const { news } = movesNews(games, states, prev);
    const out = [
      '===== all news =====',
      JSON.stringify(notificationFor(news, s.nameOf, undefined), null, 1),
      '===== one game =====',
      JSON.stringify(notificationFor(news.slice(0, 1), s.nameOf, undefined), null, 1),
      '===== one ongoing game =====',
      JSON.stringify(notificationFor([{ id: 'x', white: 'anna', black: 'bruno', round: '3', ended: false }], s.nameOf, undefined), null, 1),
      '===== draws only =====',
      JSON.stringify(notificationFor([{ id: 'x', white: 'anna', black: 'bruno', round: '3', ended: true }, { id: 'y', white: 'carla', black: 'dario', round: '3', ended: true }], s.nameOf, undefined), null, 1),
      '===== skipping the first player =====',
      JSON.stringify(notificationFor(news, s.nameOf, s.config.players[0]?.handle), null, 1),
    ];
    await expect(out.join('\n') + '\n').toMatchFileSnapshot(file(s, 'push'));
  });
});
