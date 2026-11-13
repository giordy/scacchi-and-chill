import { describe, expect, it } from 'vitest';
import { pledgeCommit, readPledges } from '../firestoreRest';
import { pledgeDocId, pledgeFromDoc, pledgeMessage, pledgeStatus, rulesText, rulesVersion } from '../pledges';
import { currentSeasonActivity } from '../activity';
import { TournamentMeta } from '../../types';

const meta: TournamentMeta = { title: 'Scacchi & Chill', season: 'Stagione 3 - Fischer', description: '', fairPlayText: '• Niente motori.' };
const players = [
  { handle: 'Anna', name: 'Anna' },
  { handle: 'bruno', name: 'Bruno' },
  { handle: 'carla', name: 'Carla' },
];
const v = rulesVersion(meta);
const pledge = (handle: string, at: number, season = meta.season, rules = v) => ({ handle, season, at, rules });

describe('rules version', () => {
  it('is a short fingerprint that changes with the text of the rules', () => {
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(rulesVersion({ ...meta })).toBe(v);
    expect(rulesVersion({ ...meta, fairPlayText: '• Niente motori, mai.' })).not.toBe(v);
    expect(rulesText(meta)).toContain('• Niente motori.');
  });
});

describe('pledgeStatus', () => {
  it('lists who accepted this season (oldest first), who is missing and who accepted older rules', () => {
    const s = pledgeStatus(
      [pledge('bruno', 20), pledge('anna', 10, meta.season, '00000000'), pledge('carla', 5, 'Stagione 2'), pledge('dario', 7)],
      meta.season,
      players,
      v
    );
    expect(s.accepted.map((p) => [p.handle, p.name])).toEqual([['Anna', 'Anna'], ['bruno', 'Bruno']]);
    expect(s.missing.map((p) => p.handle)).toEqual(['carla']); // her acceptance is of the last season
    expect(s.outdated).toEqual(['Anna']);
    expect(s.all).toBe(false);
    expect(pledgeStatus([pledge('anna', 1), pledge('bruno', 2), pledge('carla', 3)], meta.season, players, v).all).toBe(true);
    expect(pledgeStatus([], meta.season, [], v).all).toBe(false);
  });
});

describe('the documents', () => {
  it('one per season and player, read back from Firestore', () => {
    expect(pledgeDocId('Stagione 3 - Fischer', 'Anna')).toBe('stagione-3-fischer--anna');
    expect(pledgeFromDoc({ handle: 'Anna', season: 'S', at: '2026-11-13T10:00:00Z', rules: v })).toEqual({ handle: 'anna', season: 'S', at: Date.parse('2026-11-13T10:00:00Z'), rules: v });
    expect(pledgeFromDoc({ handle: 'anna', season: 'S' })).toBeNull();
    expect(typeof readPledges).toBe('function');
  });
  it('counts only the document of that season and player: another id the rules let through is ignored', () => {
    const data = { handle: 'anna', season: 'Stagione 3 - Fischer', at: '2026-11-13T10:00:00Z', rules: v };
    expect(pledgeFromDoc(data, 'stagione-3-fischer--anna')).not.toBeNull();
    // Written by hand to change the date or the text accepted, or after the organizer cancelled the real one
    expect(pledgeFromDoc(data, 'x--anna')).toBeNull();
    expect(pledgeFromDoc(data, 'stagione-3-fischer-2--anna')).toBeNull();
    expect(pledgeFromDoc({ ...data, handle: 'bruno' }, 'stagione-3-fischer--anna')).toBeNull();
  });
  it('are written new, with the server time', () => {
    const body = pledgeCommit('projects/p/databases/(default)', meta.season, 'Anna', v);
    expect(body.writes[0].update.name).toBe('projects/p/databases/(default)/documents/tournaments/scacchi-and-chill-official/pledges/stagione-3-fischer--anna');
    expect(body.writes[0].update.fields.handle).toEqual({ stringValue: 'anna' });
    expect(body.writes[0].currentDocument).toEqual({ exists: false });
    expect(body.writes[0].updateTransforms).toEqual([{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }]);
  });
  it('the message for the group has the link', () => {
    expect(pledgeMessage('Stagione 3', 'https://x/#/regolamento')).toContain('🔗 https://x/#/regolamento');
  });
});

describe('the cronaca', () => {
  it('tells each acceptance, and when everyone accepted', () => {
    const status = pledgeStatus([pledge('anna', 1000), pledge('bruno', 2000), pledge('carla', 3000)], meta.season, players, v);
    const events = currentSeasonActivity({ season: meta.season, players, history: [], gameStates: {}, pledges: status });
    expect(events.map((e) => [e.kind, e.at])).toEqual([
      ['pledges', 3000],
      ['pledge', 3000],
      ['pledge', 2000],
      ['pledge', 1000],
    ]);
    const partial = currentSeasonActivity({ season: meta.season, players, history: [], gameStates: {}, pledges: pledgeStatus([pledge('anna', 1000)], meta.season, players, v) });
    expect(partial.map((e) => e.kind)).toEqual(['pledge']);
    expect(partial[0].parts).toEqual([{ handle: 'Anna' }, ' accetta il regolamento']);
  });
});
