import { describe, expect, it } from 'vitest';
import { buildBulletin, laterGamesNote, openRounds } from '../bulletin';
import { defaultConfig } from '../config';
import { applyWithdrawals } from '../withdrawals';
import { AppConfig, HistoryGame, LichessExportGame } from '../../types';

// Overlapping rounds (Turni con scadenza): one weekly bulletin for every round still open, the
// earlier ones in short at its bottom, and the message of a round's end for its round only

const players = ['anna', 'bruno', 'carla', 'dario', 'elena', 'fabio'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const url = (id: string) => `https://lichess.org/${id}`;
const first = () => 0;
const NOW = Date.UTC(2026, 11, 10, 12); // Thursday 10 December
const END3 = Date.UTC(2026, 11, 7, 23); // Turno 3: until the end of Monday 7 December in Italy
const config: AppConfig = {
  ...defaultConfig,
  players,
  numberEmojis: [],
  tournament: { title: 'T', season: 'Stagione 2', description: '', roundDays: 14, roundEnds: [{ round: '3', at: END3 }] },
};

const finished = (id: string, winner: 'white' | 'black' | undefined): LichessExportGame => ({
  id,
  status: winner ? 'resign' : 'draw',
  winner,
  moves: Array.from({ length: 60 }, () => 'e4').join(' '),
});
const started = (id: string, plies: number): LichessExportGame => ({ id, status: 'started', moves: Array.from({ length: plies }, () => 'e4').join(' ') });

const r3: HistoryGame[] = [
  { round: '3', white: 'elena', black: 'fabio', url: url('r3aaaaaa'), lichess: finished('r3aaaaaa', 'white') },
  { round: '3', white: 'anna', black: 'carla', url: url('r3bbbbbb') },
  { round: '3', white: 'bruno', black: 'dario', url: url('r3cccccc'), lichess: finished('r3cccccc', undefined) },
];
const r4: HistoryGame[] = [
  { round: '4', white: 'anna', black: 'bruno', url: url('r4aaaaaa') },
  { round: '4', white: 'carla', black: 'elena', url: url('r4bbbbbb'), lichess: finished('r4bbbbbb', 'black') },
];
const history = [...r3, ...r4];

describe('the weekly bulletin with an earlier round still open', () => {
  const states = { r3bbbbbb: started('r3bbbbbb', 45), r4aaaaaa: started('r4aaaaaa', 10) };
  const b = buildBulletin({ round: '4', games: r4, states, history, config, expiryDays: 2, now: NOW, random: first });

  it('tells the new round first and the earlier one in short at its bottom', () => {
    expect(b.isComplete).toBe(false);
    expect(b.tails).toEqual(['3']);
    expect(b.text).toContain('📊 *Aggiornamento Turno 4*');
    expect(b.text).toContain(
      '🔚 *Coda del Turno 3* (chiuso lunedì 7 dicembre)\n' +
        '✅ Elena – Fabio *(1-0)*\n' +
        '♟️ Anna – Carla: in corso (più di 20 mosse)\n' +
        '✅ Bruno – Dario *(½-½)*'
    );
    // under the new round's games, above the one summary, which is the new round's
    expect(b.text.indexOf('*Carla* ⚪ vs *Elena* ⚫')).toBeLessThan(b.text.indexOf('🔚'));
    expect(b.text.indexOf('🔚')).toBeLessThan(b.text.indexOf('📋 *1 finita · 1 in corso*'));
    // one header, one summary, the site once
    expect(b.text.match(/📊/g)).toHaveLength(1);
    expect(b.text.match(/📋/g)).toHaveLength(1);
    expect(b.text.split(defaultConfig.statusPhrases.infoLine!)).toHaveLength(2);
  });

  it('says of the tail games still to accept, or whose link expired', () => {
    const tail: HistoryGame[] = [
      { round: '3', white: 'anna', black: 'carla', url: url('r3dddddd'), createdAt: NOW - 3 * 86400e3 },
      { round: '3', white: 'bruno', black: 'dario', url: url('r3eeeeee'), createdAt: NOW - 3600e3 },
    ];
    const t = buildBulletin({ round: '4', games: r4, states: {}, history: [...tail, ...r4], config, expiryDays: 2, now: NOW, random: first }).text;
    expect(t).toContain('🔁 Anna – Carla: link scaduto, la sfida va ricreata');
    expect(t).toMatch(/🔗 Bruno – Dario: sfida da accettare entro \w+ \d+\/\d+ alle \d\d:\d\d/);
  });

  it('leaves out an earlier round once its games are over', () => {
    const over = { ...states, r3bbbbbb: finished('r3bbbbbb', 'black') };
    const o = buildBulletin({ round: '4', games: r4, states: over, history, config, expiryDays: 2, now: NOW, random: first });
    expect(o.tails).toEqual([]);
    expect(o.text).not.toContain('Coda del Turno');
  });

  it('tells a tail round without an end, and a result decided by the organizer', () => {
    const decided = applyWithdrawals([{ ...r3[0], decision: { result: '0-1', at: NOW } }, r3[1], ...r4], []);
    const d = buildBulletin({ round: '4', games: decided.filter((g) => g.round === '4'), states, history: decided, config: { ...config, tournament: { title: 'T', season: 'S', description: '' } }, expiryDays: 2, now: NOW, random: first });
    expect(d.text).toContain("🔚 *Coda del Turno 3*\n⚖️ Elena – Fabio *(0-1)*, deciso dall'organizzatore");
  });
});

describe('the message of the end of an earlier round', () => {
  it('speaks of its round only, and says which later games the table already counts', () => {
    const states = { r3bbbbbb: finished('r3bbbbbb', 'white'), r4aaaaaa: started('r4aaaaaa', 10) };
    const e = buildBulletin({ round: '3', games: r3, states, history, config, expiryDays: 2, now: NOW, random: first });
    expect(e.isComplete).toBe(true);
    expect(e.tails).toEqual([]);
    expect(e.text).toContain('🏁 *Turno 3 concluso!*');
    expect(e.text).toContain('📈 *Classifica dopo il Turno 3* (con 1 partita già finita del Turno 4)\n');
    expect(e.text).not.toContain('Anna* ⚪ vs *Bruno');
  });
});

describe('openRounds', () => {
  it('lists the rounds with a game not over, a void game included', () => {
    expect(openRounds(history, {})).toEqual(['3', '4']);
    expect(openRounds(history, { r3bbbbbb: finished('r3bbbbbb', 'white') })).toEqual(['4']);
    const aborted = { r3bbbbbb: { id: 'r3bbbbbb', status: 'aborted' } as LichessExportGame, r4aaaaaa: finished('r4aaaaaa', 'white') };
    expect(openRounds(history, aborted)).toEqual(['3']);
  });
});

describe('laterGamesNote', () => {
  it('names the later round, or the later rounds together', () => {
    expect(laterGamesNote([])).toBe('');
    expect(laterGamesNote(['4'])).toBe('con 1 partita già finita del Turno 4');
    expect(laterGamesNote(['4', '4'])).toBe('con 2 partite già finite del Turno 4');
    expect(laterGamesNote(['4', '5', '5'])).toBe('con 3 partite già finite dei turni successivi');
  });
});
