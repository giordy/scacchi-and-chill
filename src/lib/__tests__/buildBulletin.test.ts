import { describe, expect, it } from 'vitest';
import { buildBulletin, phrasePicker } from '../bulletin';
import { defaultConfig } from '../config';
import { applyWithdrawals } from '../withdrawals';
import { AppConfig, HistoryGame, LichessExportGame } from '../../types';

const players = ['anna', 'bruno', 'carla', 'dario', 'elena', 'fabio'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const config: AppConfig = { ...defaultConfig, players, numberEmojis: [] };
const url = (id: string) => `https://lichess.org/${id}`;
const first = () => 0; // always the first phrase of each list
const NOW = Date.UTC(2026, 10, 5, 12);

const finished = (id: string, winner: 'white' | 'black' | undefined, extra: Partial<LichessExportGame> = {}): LichessExportGame => ({
  id,
  status: winner ? 'resign' : 'draw',
  winner,
  moves: Array.from({ length: 60 }, () => 'e4').join(' '),
  ...extra,
});

describe('buildBulletin', () => {
  it('describes every kind of game of an open round', () => {
    const games: HistoryGame[] = [
      { round: '2', white: 'anna', black: 'bruno', url: url('pppppppp'), createdAt: NOW - 3600e3 }, // not accepted
      { round: '2', white: 'carla', black: 'dario', url: url('oooooooo') }, // ongoing
      { round: '2', white: 'elena', black: 'fabio', url: url('ffffffff') }, // finished, an upset
    ];
    const states: Record<string, LichessExportGame> = {
      oooooooo: { id: 'oooooooo', status: 'started', moves: Array.from({ length: 45 }, () => 'e4').join(' '), division: { middle: 20 } },
      ffffffff: finished('ffffffff', 'white', {
        opening: { name: 'Caro-Kann Defense: Campomanes Attack' },
        players: { white: { rating: 1400 }, black: { rating: 1600 } },
      }),
    };
    const b = buildBulletin({ round: '2', games, states, history: games, config, expiryDays: 2, now: NOW, random: first });
    expect(b.isComplete).toBe(false);
    expect(b.text).toContain('📊 *Aggiornamento Turno 2*');
    expect(b.text).toContain('*Anna* ⚪ vs *Bruno* ⚫\nDa avviare: il link scade');
    expect(b.text).toContain('In corso ♟️ (più di 20 mosse, nel mediogioco)');
    expect(b.text).toContain('Finita! Ha vinto Elena col bianco per abbandono in 30 mosse *(1-0)* 🎉\n♟️ Apertura: Caro-Kann Defense: Campomanes Attack');
    expect(b.text).toContain('💥 Colpaccio! Elena batte un avversario con 200 punti Elo in più');
    expect(b.text).toContain('📊 *1 finita · 1 in corso · 1 da avviare*');
    expect(b.details).toHaveLength(3);
    expect(b.details[1]).toContain('fase Lichess=middlegame');
  });

  it('closes a round with results, leader and studies', () => {
    // Round 1 gives Anna and Carla a win each: they meet in round 2, too early for a summit
    const r1: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: url('a1a1a1a1'), lichess: finished('a1a1a1a1', 'white') },
      { round: '1', white: 'carla', black: 'dario', url: url('b1b1b1b1'), lichess: finished('b1b1b1b1', 'white') },
      { round: '1', white: 'elena', black: 'fabio', url: url('c1c1c1c1'), lichess: finished('c1c1c1c1', undefined) },
    ];
    const r2: HistoryGame[] = [
      { round: '2', white: 'anna', black: 'carla', url: url('a2a2a2a2') },
      { round: '2', white: 'bruno', black: 'elena', url: url('b2b2b2b2') },
    ];
    const states: Record<string, LichessExportGame> = {
      a2a2a2a2: finished('a2a2a2a2', 'black', { opening: { name: 'Owen Defense' } }),
      b2b2b2b2: finished('b2b2b2b2', undefined),
    };
    const b = buildBulletin({ round: '2', games: r2, states, history: [...r1, ...r2], config, expiryDays: 2, now: NOW, random: first });
    expect(b.isComplete).toBe(true);
    expect(b.text).toContain('🏁 *Turno 2 concluso!*');
    expect(b.text).not.toContain('Scontro al vertice');
    expect(b.text).toContain('🥇 In testa Carla con 2 punti.');
    expect(b.text).toContain('📚 *Studi consigliati per le aperture del turno:*\n• Owen Defense:');
    expect(b.text).toContain(defaultConfig.statusPhrases.infoLine!);
  });

  it('uses the stored result of finished games and shows forfeits after a withdrawal', () => {
    const games: HistoryGame[] = [
      { round: '3', white: 'anna', black: 'bruno', url: url('dddddddd'), lichess: finished('dddddddd', 'black') },
      { round: '3', white: 'carla', black: 'dario', url: '' },
    ];
    const view = applyWithdrawals(games, [
      { handle: 'dario', name: 'Dario', at: '', played: 8, total: 14, mode: 'forfeit', forfeits: [{ round: '3', white: 'carla', black: 'dario' }] },
    ]);
    const b = buildBulletin({ round: '3', games: view, states: {}, history: view, config, expiryDays: 2, now: NOW, random: first });
    expect(b.text).toContain('Finita! Ha vinto Bruno col nero per abbandono'); // not asked to Lichess again
    expect(b.text).toContain('Carla porta a casa il punto col bianco a tavolino *(1-0)*');
    expect(b.isComplete).toBe(true);
  });

  it('says when an unaccepted link expired', () => {
    const games: HistoryGame[] = [{ round: '4', white: 'anna', black: 'bruno', url: url('eeeeeeee'), createdAt: NOW - 3 * 86400e3 }];
    const b = buildBulletin({ round: '4', games, states: {}, history: games, config, expiryDays: 2, now: NOW, random: first });
    expect(b.text).toContain('Link scaduto: la sfida va ricreata 🔁');
  });
});

describe('phrasePicker', () => {
  it('uses every phrase once before repeating, even with a fixed random', () => {
    const pick = phrasePicker({ x: ['a', 'b', 'c'], none: [] }, () => 0);
    expect([pick('x'), pick('x'), pick('x'), pick('x')]).toEqual(['a', 'b', 'c', 'a']);
    expect(pick('none')).toBe('');
    expect(pick('missing')).toBe('');
  });
});
