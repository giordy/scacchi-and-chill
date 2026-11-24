import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { staleLinks } from '../relink';
import { extractGameId } from '../utils';
import { HistoryGame, LichessExportGame } from '../../types';
// @ts-expect-error a Node script without types
import { expiryDaysOf, staleLinksNotification, staleLinksOf } from '../../../scripts/push.mjs';
import { RoundsTab } from '../../tabs/RoundsTab';
import { defaultConfig } from '../config';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 24, 12);
const url = (id: string) => `https://lichess.org/${id}`;
const game = (round: string, white: string, black: string, id: string, createdAt: number | undefined, status?: string, extra: Partial<HistoryGame> = {}): HistoryGame => ({
  round,
  white,
  black,
  url: url(id),
  createdAt,
  ...(status ? { lichess: { id, status } as LichessExportGame } : {}),
  ...extra,
});
const history = [
  game('4', 'anna', 'bruno', 'aaaaaaaa', NOW - 3 * DAY), // never accepted, expired
  game('4', 'carla', 'dario', 'bbbbbbbb', NOW - DAY), // still to accept
  game('3', 'elena', 'fabio', 'cccccccc', NOW - 9 * DAY, 'aborted'), // voided by Lichess
  game('3', 'gino', 'ugo', 'dddddddd', NOW - 9 * DAY, 'started'),
  game('3', 'ivo', 'luca', 'eeeeeeee', NOW - 9 * DAY, undefined, { decision: { result: '0-0', at: 1 } }), // decided
  game('4', 'mara', 'nino', 'ffffffff', undefined), // no creation time: counts as still open
  { round: '5', white: 'anna', black: 'carla', url: '' }, // no link yet
];

describe('links to make again', () => {
  it('are the challenges expired without being accepted and the games voided, oldest round first', () => {
    expect(staleLinks(history, {}, 2, NOW).map((s) => [s.game.white, s.kind])).toEqual([
      ['elena', 'void'],
      ['anna', 'expired'],
    ]);
    expect(staleLinks(history, {}, 2, NOW)[1].expiredAt).toBe(NOW - DAY);
    // Accepted meanwhile: Lichess exports it
    expect(staleLinks(history, { aaaaaaaa: { id: 'aaaaaaaa', status: 'started' } as LichessExportGame }, 2, NOW).map((s) => s.game.white)).toEqual(['elena']);
    // With more days to accept, not expired yet
    expect(staleLinks(history, {}, 3, NOW).map((s) => s.game.white)).toEqual(['elena']);
  });

  it('are found by the sync script with the same rule', () => {
    for (const [states, days, now] of [[{}, 2, NOW], [{ aaaaaaaa: { id: 'aaaaaaaa', status: 'started' } }, 2, NOW], [{}, 3, NOW], [{ bbbbbbbb: { id: 'bbbbbbbb', status: 'noStart' } }, 1, NOW + 5 * DAY]] as const) {
      const site = staleLinks(history, states as Record<string, LichessExportGame>, days, now).map((s) => [s.game.round, s.game.white, s.game.black, s.kind]);
      const script = staleLinksOf(history, states, days, now, extractGameId).map((s: { round: string; white: string; black: string; kind: string }) => [s.round, s.white, s.black, s.kind]);
      expect(script).toEqual(site);
    }
    expect(staleLinksOf(history, {}, 2, NOW, extractGameId).map((s: { key: string }) => s.key)).toEqual([`link|${url('cccccccc')}`, `link|${url('aaaaaaaa')}`]);
  });

  it('read the days to accept from the organizer settings, else the default', () => {
    expect(expiryDaysOf({ settings: { expiry: 4 } }, 2)).toBe(4);
    expect(expiryDaysOf({ settings: { expiry: 0 } }, 2)).toBe(2);
    expect(expiryDaysOf({ settings: { expiry: '3' } }, 2)).toBe(3);
    expect(expiryDaysOf(null, 2)).toBe(2);
  });

  it('are told in one notification, with the names, opening the organizer area', () => {
    const items = staleLinksOf(history, {}, 2, NOW, extractGameId);
    const names: Record<string, string> = { anna: 'Anna', bruno: 'Bruno', elena: 'Elena', fabio: 'Fabio' };
    expect(staleLinksNotification(items, (h: string) => names[h] ?? h)).toEqual({
      title: '2 sfide da rifare',
      body: "Elena – Fabio (Turno 3, annullata), Anna – Bruno (Turno 4, non accettata). Dall'area organizzatore, 🔁 crea un nuovo link.",
      hash: '#admin',
      tag: 'link',
    });
    expect(staleLinksNotification(items.slice(0, 1), (h: string) => h).title).toBe('Sfida da rifare');
  });

  it('are listed at the top of Turni', () => {
    vi.useFakeTimers({ now: NOW });
    const config = { ...defaultConfig, schedule: [] };
    const settings = { token: '', days: 2, expiry: 2, rated: true, rules: defaultConfig.defaults.rules };
    const html = renderToStaticMarkup(
      React.createElement(RoundsTab, {
        openRound: '',
        setOpenRound: () => {},
        config,
        settings,
        templates: config.messageTemplates,
        history,
        setHistory: () => {},
        gameStates: {},
        onUpdateSchedule: () => {},
        onUpdateTournamentMeta: () => {},
        nameOf: (h: string) => h,
        flash: () => {},
        triggerToast: () => {},
        onMissingToken: () => {},
      })
    );
    vi.useRealTimers();
    expect(html).toContain('2 sfide sono da rifare');
    expect(html).toContain('anna – bruno (Turno 4): scaduta senza essere accettata');
    expect(html).toContain('elena – fabio (Turno 3): annullata su Lichess');
  });
});
