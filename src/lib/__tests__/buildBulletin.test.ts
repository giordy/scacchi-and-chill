import { describe, expect, it } from 'vitest';
import { buildBulletin, phrasePicker } from '../bulletin';
import { defaultConfig } from '../config';
import { applyWithdrawals } from '../withdrawals';
import { pillsburyRace } from '../pillsbury';
import { tournamentElo } from '../tournamentElo';
import { withScheduledGames } from '../publicGames';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const players = ['anna', 'bruno', 'carla', 'dario', 'elena', 'fabio'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const config: AppConfig = { ...defaultConfig, players, numberEmojis: [] };
// A past season where Fabio beat Elena again and again: in the Elo del torneo he is well ahead
const pastSeason = (wins: number): SeasonArchive => ({
  id: 'stagione-1', season: 'Stagione 1', title: 'T', archivedAt: '2026-01-01', gamesPlayed: wins,
  standings: players.map((p) => ({ handle: p.handle, name: p.name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 })),
  games: Array.from({ length: wins }, (_, i) => ({ round: String(i + 1), white: 'fabio', black: 'elena', result: '1-0' as const, end: i + 1 })),
});
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
    const matchesUrl = 'https://example.org/#/partite';
    const b = buildBulletin({ round: '2', games, states, history: games, config, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(4)], matchesUrl });
    expect(b.isComplete).toBe(false);
    // where to follow the games, just above the site
    expect(b.text).toContain(`📡 Le partite in diretta: ${matchesUrl}\n\n${defaultConfig.statusPhrases.infoLine}`);
    expect(b.text).toContain('📊 *Aggiornamento Turno 2*');
    expect(b.text).toContain('*Anna* ⚪ vs *Bruno* ⚫\nDa avviare ⏳');
    // the deadline once, under the games, with the games still to accept
    expect(b.text).toMatch(/⏳ \*Da accettare entro \w+ \d+\/\d+ alle \d\d:\d\d:\* Anna–Bruno/);
    expect(b.text.match(/alle \d\d:\d\d/g)).toHaveLength(1);
    // the site, also during the round
    expect(b.text).toContain(defaultConfig.statusPhrases.infoLine!);
    expect(b.text).toContain('In corso ♟️ (più di 20 mosse, nel mediogioco)');
    expect(b.text).toContain('Finita! Ha vinto Elena col bianco per abbandono in 30 mosse *(1-0)* 🎉\n♟️ Apertura: Caro-Kann Defense: Campomanes Attack');
    // The colpaccio waits for the bulletin of the round's end: not in the updates
    expect(b.text).not.toContain('Colpaccio');
    const end = games.slice(2); // the round with only Elena–Fabio: finished
    const e = buildBulletin({ round: '2', games: end, states, history: end, config, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(4)], matchesUrl });
    expect(e.isComplete).toBe(true);
    // nothing left to follow at the round's end
    expect(e.text).not.toContain('Le partite in diretta');
    expect(e.text).toContain('🎉\n♟️ Apertura: Caro-Kann Defense: Campomanes Attack\n💥 Colpaccio di Elena, contro un avversario sulla carta più forte');
    // A draw against him, once he is 400 points ahead, is a colpaccio too
    const draw = { ...states, ffffffff: { ...states.ffffffff, status: 'draw', winner: undefined } };
    const d = buildBulletin({ round: '2', games: end, states: draw, history: end, config, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(12)] });
    expect(d.text).toContain('🛡️ Colpaccio di patta: Elena ferma Fabio');
    // Without past seasons everyone is at 1500: no colpaccio
    expect(buildBulletin({ round: '2', games: end, states, history: end, config, expiryDays: 2, now: NOW, random: first }).text).not.toContain('Colpaccio');
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
    // the table after the round takes the place of the summary, which would repeat the header
    expect(b.text).toContain('📈 *Classifica dopo il Turno 2*\n1. Carla – 2 punti\n');
    expect(b.text).not.toContain('📊');
    expect(b.text).not.toContain('Da accettare');
    expect(b.text).toContain('Owen+Defense');
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

describe('buildBulletin: deadlines and phrases', () => {
  it('groups the challenges still to accept under one deadline', () => {
    const games: HistoryGame[] = [
      { round: '4', white: 'anna', black: 'bruno', url: url('gggggggg'), createdAt: NOW - 3600e3 },
      { round: '4', white: 'carla', black: 'dario', url: url('hhhhhhhh'), createdAt: NOW - 3600e3 },
      { round: '4', white: 'elena', black: 'fabio', url: url('iiiiiiii'), createdAt: NOW - 3600e3 },
    ];
    const states = { iiiiiiii: { id: 'iiiiiiii', status: 'started', moves: 'e4 e5' } as LichessExportGame };
    const b = buildBulletin({ round: '4', games, states, history: games, config, expiryDays: 2, now: NOW, random: first });
    expect(b.text).toContain('*Da accettare entro');
    expect(b.text).toContain(':* Anna–Bruno, Carla–Dario');
    expect(b.text).not.toContain('Elena–Fabio');
    // before the summary of the round
    expect(b.text.indexOf('Da accettare')).toBeLessThan(b.text.lastIndexOf('📊 *'));
  });

  it('asks to recreate expired challenges, without a deadline already past', () => {
    const games: HistoryGame[] = [{ round: '4', white: 'anna', black: 'bruno', url: url('jjjjjjjj'), createdAt: NOW - 5 * 86400e3 }];
    const b = buildBulletin({ round: '4', games, states: {}, history: games, config, expiryDays: 2, now: NOW, random: first });
    expect(b.text).toContain('Link scaduto: la sfida va ricreata');
    expect(b.text).not.toContain('Da accettare');
  });

  it('still fills a custom phrase that asks for the deadline', () => {
    const custom: AppConfig = { ...config, statusPhrases: { ...config.statusPhrases, pending: ['Entro {deadline}'] } };
    const games: HistoryGame[] = [{ round: '4', white: 'anna', black: 'bruno', url: url('kkkkkkkk'), createdAt: NOW - 3600e3 }];
    const b = buildBulletin({ round: '4', games, states: {}, history: games, config: custom, expiryDays: 2, now: NOW, random: first });
    expect(b.text).toMatch(/Entro \w+ \d+\/\d+ alle/);
    expect(b.text).not.toContain('{deadline}');
  });

  it('reads well with every draw and win phrase, with or without details', () => {
    const phrases = defaultConfig.statusPhrases;
    const games: HistoryGame[] = [{ round: '5', white: 'anna', black: 'bruno', url: url('llllllll') }];
    const cases: LichessExportGame[] = [
      finished('llllllll', undefined), // draw in 30 moves
      { id: 'llllllll', status: 'draw' }, // draw, no moves known
      finished('llllllll', 'white', { status: 'mate' }),
      { id: 'llllllll', status: 'resign', winner: 'black' }, // win, no moves known
    ];
    for (const s of cases) {
      const list = s.winner ? phrases.win : phrases.draw;
      list.forEach((_, i) => {
        const pick = () => (i + 0.5) / list.length;
        const b = buildBulletin({ round: '5', games, states: { llllllll: s }, history: games, config, expiryDays: 2, now: NOW, random: pick });
        const line = b.text.split('\n').find((l) => l.includes('*(')) ?? '';
        expect(line, line).not.toMatch(/\{|\}| [:,]|  |\( \)/);
      });
    }
  });

  it('puts the crown of the reigning champion only in the table at the end of the round', () => {
    const champion: AppConfig = {
      ...config,
      tournament: { title: 'T', season: 'S2', description: '', winners: [{ season: 'S1', name: 'Bruno', handle: 'Bruno' }] },
    };
    const games: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: url('mmmmmmmm') },
      { round: '1', white: 'carla', black: 'dario', url: url('nnnnnnnn') },
    ];
    const open = buildBulletin({ round: '1', games, states: { mmmmmmmm: finished('mmmmmmmm', 'white') }, history: games, config: champion, expiryDays: 2, now: NOW, random: first });
    expect(open.text).not.toContain('👑');
    const states = { mmmmmmmm: finished('mmmmmmmm', 'white'), nnnnnnnn: finished('nnnnnnnn', undefined) };
    const end = buildBulletin({ round: '1', games, states, history: games, config: champion, expiryDays: 2, now: NOW, random: first });
    expect(end.text.match(/👑/g)).toHaveLength(1);
    expect(end.text).toContain('. Bruno 👑 – 0 punti');
    expect(end.text).not.toMatch(/\*Bruno\* 👑/);
  });

  it('tells the race for the Trofeo Pillsbury under the standings, only at the end of the round', () => {
    // Elena, well below Fabio in the Elo del torneo, beats him: above her objective
    const games: HistoryGame[] = [{ round: '1', white: 'elena', black: 'fabio', url: url('pppppppp') }];
    const states = { pppppppp: finished('pppppppp', 'white') };
    const end = buildBulletin({ round: '1', games, states, history: games, config, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(4)] });
    expect(end.text).toContain('📈 *Classifica dopo il Turno 1*');
    // With nothing else in the calendar the season is over: the winner
    expect(end.text).toContain('🏅 *Trofeo Pillsbury* a Elena, +1 punto oltre le attese');
    // With a game still to play in the calendar, the race
    const more: AppConfig = { ...config, schedule: [{ round: '2', white: 'anna', black: 'bruno' }] };
    const mid = buildBulletin({ round: '1', games, states, history: games, config: more, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(4)] });
    expect(mid.text).toContain('🏅 *Trofeo Pillsbury* (punti oltre le attese): Elena +1');
    expect(end.text.indexOf('🏅 *Trofeo Pillsbury')).toBeGreaterThan(end.text.indexOf('📈 *Classifica'));
    // Not during the round, nor in the first season (everyone an esordiente)
    const open: HistoryGame[] = [...games, { round: '1', white: 'anna', black: 'bruno', url: url('qqqqqqqq') }];
    expect(buildBulletin({ round: '1', games: open, states, history: open, config, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(4)] }).text).not.toContain('Pillsbury');
    expect(buildBulletin({ round: '1', games, states, history: games, config, expiryDays: 2, now: NOW, random: first }).text).not.toContain('Pillsbury');
  });

  it('measures the race against the whole calendar, as the site does, not only the rounds created', () => {
    // Elena beat Fabio in the only game created so far. On that game alone her objective shows as 0
    // and she is a point above it; on her three games of the calendar it shows as 1 and her pace as
    // 1½: half a point above, which is what the race table of the site says
    const games: HistoryGame[] = [{ round: '1', white: 'elena', black: 'fabio', url: url('pppppppp') }];
    const states = { pppppppp: finished('pppppppp', 'white') };
    const schedule = [{ round: '2', white: 'elena', black: 'anna' }, { round: '3', white: 'bruno', black: 'elena' }];
    const elo = tournamentElo([pastSeason(2)], players.map((p) => p.handle), games, states);
    const gapOn = (calendar: HistoryGame[]) => pillsburyRace(players, elo, calendar, games, states).rows.find((r) => r.handle === 'elena')!.gap;
    expect(gapOn(games)).toBe(1);
    expect(gapOn(withScheduledGames(games, schedule))).toBe(0.5);
    const mid = buildBulletin({ round: '1', games, states, history: games, config: { ...config, schedule }, expiryDays: 2, now: NOW, random: first, seasons: [pastSeason(2)] });
    expect(mid.text).toContain('🏅 *Trofeo Pillsbury* (punti oltre le attese): Elena +½');
  });
});
