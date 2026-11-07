import { describe, expect, it } from 'vitest';
import { normalizeSchedule, validateAndNormalizeConfig } from '../config';
import raw from '../../../config.json';

// A fresh copy of the real config.json to break in each test
const base = () => JSON.parse(JSON.stringify(raw));

describe('validateAndNormalizeConfig', () => {
  it('accepts the config.json of the repository', () => {
    const cfg = validateAndNormalizeConfig(base());
    expect(cfg.players).toEqual([]); // players live on Firestore, none in the repository
    expect(cfg.defaults.days).toBeGreaterThanOrEqual(1);
    expect(cfg.statusPhrases.header.length).toBeGreaterThan(0);
  });

  it('trims the players and falls back to the handle for a missing name', () => {
    const cfg = validateAndNormalizeConfig({ ...base(), players: [{ handle: ' anna ' }, { handle: 'bruno', name: 'Bruno' }] });
    expect(cfg.players).toEqual([
      { handle: 'anna', name: 'anna' },
      { handle: 'bruno', name: 'Bruno' },
    ]);
  });

  it.each([
    ['players that are not a list', { players: { handle: 'anna' } }, '"players"'],
    ['a player without handle', { players: [{ handle: 'anna' }, { name: 'X' }] }, '"players"'],
    ['the same handle twice', { players: [{ handle: 'Anna' }, { handle: 'anna' }] }, 'same handle twice'],
    ['days out of range', { defaults: { days: 30 } }, '"days"'],
    ['expiry not whole', { defaults: { expiry: 1.5 } }, '"expiry"'],
    ['a round message without footer', { roundMessage: { header: 'h', game: 'g', bye: 'b' } }, '"roundMessage"'],
    ['no status message', { statusMessage: undefined }, '"statusMessage"'],
  ])('rejects %s', (_label, patch, message) => {
    expect(() => validateAndNormalizeConfig({ ...base(), ...patch })).toThrow(message);
  });

  it('rejects an empty list of status phrases', () => {
    const cfg = base();
    cfg.statusMessage.win = [];
    expect(() => validateAndNormalizeConfig(cfg)).toThrow('"statusMessage.win"');
  });

  it('accepts the Italian field names', () => {
    const { defaults, roundMessage, statusMessage, ...rest } = base();
    const players = [{ handle: 'anna', name: 'Anna' }, { handle: 'bruno', name: 'Bruno' }];
    const sm = statusMessage;
    // The English names win when both are there: keep only the Italian ones
    const { challengeName: _c, numberEmojis: _n, ...rm } = roundMessage;
    const cfg = validateAndNormalizeConfig({
      ...rest,
      giocatori: players,
      impostazioniPredefinite: { ...defaults, days: 5 },
      messaggioNuovoTurno: { ...rm, nomeSfida: 'Giornata {round}', numeriEmoji: ['1️⃣'] },
      messaggioStatoPartite: {
        titoli: sm.header,
        inCorso: sm.ongoing,
        vittoria: sm.win,
        patta: sm.draw,
        annullata: sm.aborted,
        daIniziare: sm.pending,
        riepilogo: sm.footer,
        chiusura: ['Ciao'],
        colpaccio: ['Colpaccio!'],
      },
      calendario: [{ round: '1', white: 'a', black: 'b' }],
    });
    expect(cfg.players).toHaveLength(players.length);
    expect(cfg.defaults.days).toBe(5);
    expect(cfg.challengeName).toBe('Giornata {round}');
    expect(cfg.numberEmojis).toEqual(['1️⃣']);
    expect(cfg.statusPhrases.closing).toEqual(['Ciao']);
    expect(cfg.statusPhrases.upset).toEqual(['Colpaccio!']);
    expect(cfg.schedule).toEqual([{ round: '1', white: 'a', black: 'b' }]);
  });

  it('builds the info line from the site link', () => {
    const cfg = base();
    delete cfg.statusMessage.infoLine;
    cfg.statusMessage.infoLink = ' https://example.org ';
    const out = validateAndNormalizeConfig(cfg);
    expect(out.statusPhrases.infoLink).toBe('https://example.org');
    expect(out.statusPhrases.infoLine).toBe('🌐 Classifica e regolamento: https://example.org');
  });

  it('has a default tournament when config.json has none', () => {
    const cfg = base();
    delete cfg.tournament;
    expect(validateAndNormalizeConfig(cfg).tournament?.title).toBe('Scacchi & Chill');
  });
});

describe('normalizeSchedule', () => {
  it('keeps round, white and black only, and drops incomplete games', () => {
    expect(
      normalizeSchedule([
        { round: ' 1 ', white: 'anna', black: 'bruno', url: 'https://lichess.org/x' },
        { round: '2', white: 'anna' },
        null,
      ])
    ).toEqual([{ round: '1', white: 'anna', black: 'bruno' }]);
  });
});
