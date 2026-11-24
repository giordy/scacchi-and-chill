import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminAlert, adminAlerts, alertsBadge, openCheatCases } from '../adminAlerts';
import { AlertsBell, AlertsPanel } from '../../components/AdminAlerts';
import { HistoryGame, LichessExportGame } from '../../types';

const NOW = Date.UTC(2026, 10, 24, 12);
const DAY = 86400000;
const base = { meta: undefined, schedule: [], history: [] as HistoryGame[], gameStates: {}, expiryDays: 2, tokenCheck: null, syncHealth: null, withdrawals: [], fairPlaySeen: [], now: NOW };
const cheat = (round: string, id: string, loser: 'anna' | 'bruno'): HistoryGame => ({
  round,
  white: 'anna',
  black: 'bruno',
  url: `https://lichess.org/${id}`,
  lichess: { id, status: 'cheat', winner: loser === 'anna' ? 'black' : 'white' } as LichessExportGame,
});
const actions = { openRound: () => {}, openToken: () => {}, fairPlaySeen: [], onFairPlaySeen: () => {} };
const panel = (alerts: AdminAlert[]) => renderToStaticMarkup(React.createElement(AlertsPanel, { alerts, actions, nameOf: (h: string) => h }));
const bell = (alerts: AdminAlert[]) => renderToStaticMarkup(React.createElement(AlertsBell, { alerts, open: false, onToggle: () => {} }));

describe('the alerts of the organizer area', () => {
  it('are none when all is well', () => {
    expect(adminAlerts(base)).toEqual([]);
    expect(alertsBadge([])).toEqual({ count: 0, urgent: false });
    expect(panel([])).toContain('Nessun avviso: tutto in ordine.');
    expect(bell([])).toContain('aria-label="Avvisi: nessuno"');
    expect(bell([])).not.toContain('alerts-count');
  });

  it('put the urgent ones first and make the bell red', () => {
    const history = [{ round: '2', white: 'carla', black: 'dario', url: 'https://lichess.org/cccccccc', createdAt: NOW - 5 * DAY }];
    const alerts = adminAlerts({ ...base, history, tokenCheck: { kind: 'invalid' }, syncHealth: { kind: 'stale', at: NOW - 3 * 3600e3 } });
    expect(alerts.map((a) => a.kind)).toEqual(['token', 'sync', 'staleLinks']);
    expect(alertsBadge(alerts)).toEqual({ count: 3, urgent: true });
    const html = bell(alerts);
    expect(html).toContain('aria-label="Avvisi: 3, urgenti"');
    expect(html).toContain('alerts-count is-urgent');
    const list = panel(alerts);
    expect(list).toContain('Vai al token');
    expect(list).toContain('La sincronizzazione automatica è ferma');
    expect(list).toContain('href="https://github.com/giordy/scacchi-and-chill/actions/workflows/sync-results.yml"');
    // only the link to make again: not urgent
    expect(alertsBadge(alerts.slice(2))).toEqual({ count: 1, urgent: false });
  });

  it('tell a token about to expire without making the bell red', () => {
    const alerts = adminAlerts({ ...base, tokenCheck: { kind: 'expiring', expires: NOW + 3 * DAY } });
    expect(alertsBadge(alerts)).toEqual({ count: 1, urgent: false });
    // after the urgent ones
    const both = adminAlerts({ ...base, tokenCheck: { kind: 'expiring', expires: NOW + 3 * DAY }, syncHealth: { kind: 'stale' } });
    expect(both.map((a) => a.kind)).toEqual(['sync', 'token']);
    expect(alertsBadge(adminAlerts({ ...base, tokenCheck: { kind: 'noChallenge' } })).urgent).toBe(true);
  });

  it('leave out a token or a sync that work', () => {
    expect(adminAlerts({ ...base, tokenCheck: { kind: 'ok', userId: 'giordy' }, syncHealth: { kind: 'ok', at: NOW } })).toEqual([]);
    expect(adminAlerts({ ...base, syncHealth: { kind: 'unknown' } })).toEqual([]);
  });

  it('keep a first fair play case until acknowledged, a repeat until the player is out', () => {
    const first = [cheat('1', 'aaaaaaaa', 'anna')];
    expect(openCheatCases(first, {}, [], []).map((c) => c.id)).toEqual(['aaaaaaaa']);
    expect(openCheatCases(first, {}, [], ['aaaaaaaa'])).toEqual([]);
    const again = [...first, cheat('3', 'bbbbbbbb', 'anna')];
    expect(openCheatCases(again, {}, [], ['aaaaaaaa']).map((c) => c.count)).toEqual([2]);
    expect(openCheatCases(again, {}, [{ handle: 'Anna' } as any], ['aaaaaaaa'])).toEqual([]);
    const alerts = adminAlerts({ ...base, history: first });
    expect(alertsBadge(alerts)).toEqual({ count: 1, urgent: true });
    expect(panel(alerts)).toContain('Ho preso nota');
  });

  it('list a round waiting for its last games without counting it: there is nothing to do', () => {
    const waiting: AdminAlert = { kind: 'round', expired: { round: '1', next: '2', end: NOW - DAY, open: [], waitFor: [{ round: '1', white: 'a', black: 'b', url: '' }], waitReason: 'final' } };
    const ready: AdminAlert = { kind: 'round', expired: { round: '1', next: '2', end: NOW - DAY, open: [], waitFor: [] } };
    expect(alertsBadge([waiting])).toEqual({ count: 0, urgent: false });
    expect(alertsBadge([ready])).toEqual({ count: 1, urgent: false });
    expect(panel([waiting])).toContain('alert-item is-info');
    expect(panel([ready])).toContain('Apri il Turno 2');
  });
});
