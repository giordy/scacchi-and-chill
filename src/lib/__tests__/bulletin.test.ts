import { describe, expect, it } from 'vitest';
import { leaderLine, pillsburyLine, roundDeadline, roundSummary, standingsBlock, studySearchUrl } from '../bulletin';
import { PillsburyRace, Trend } from '../pillsbury';
import { PlayerStanding } from '../standings';

const DAY = 86400000;

describe('roundDeadline', () => {
  it('counts the expiry from the oldest created game', () => {
    expect(roundDeadline([{ createdAt: 5000 }, { createdAt: 1000 }, {}], 2, 99999)).toBe(1000 + 2 * DAY);
  });

  it('falls back to now when no game has a creation time', () => {
    expect(roundDeadline([{}, {}], 3, 7000)).toBe(7000 + 3 * DAY);
  });
});

describe('roundSummary', () => {
  it('omits zero parts and uses the singular', () => {
    expect(roundSummary({ finished: 3, ongoing: 1, pending: 0 })).toBe('3 finite · 1 in corso');
    expect(roundSummary({ finished: 1, ongoing: 0, pending: 2 })).toBe('1 finita · 2 da avviare');
    expect(roundSummary({ finished: 0, ongoing: 0, pending: 0 })).toBe('');
  });
});

describe('leaderLine', () => {
  const s = (name: string, points: number, sb = 0, won = 0): PlayerStanding => ({
    handle: name.toLowerCase(),
    name,
    played: 1,
    won,
    drawn: 0,
    lost: 0,
    points,
    sb,
  });

  it('names the leader', () => {
    expect(leaderLine([s('Anna', 3), s('Bruno', 2)])).toBe('🥇 In testa Anna con 3 punti.');
    expect(leaderLine([s('Anna', 1), s('Bruno', 0)])).toBe('🥇 In testa Anna con 1 punto.');
    expect(leaderLine([s('Anna', 0.5), s('Bruno', 0)])).toBe('🥇 In testa Anna con ½ punto.');
  });

  it('names tied leaders together, as the site does', () => {
    expect(leaderLine([s('Anna', 2.5), s('Bruno', 2.5), s('Carla', 1)])).toBe('🥇 In testa a pari merito Anna e Bruno, con 2½ punti.');
  });

  it('names one leader when the tiebreak separates equal points, as the site does', () => {
    expect(leaderLine([s('Anna', 2, 3, 2), s('Bruno', 2, 1, 2)])).toBe('🥇 In testa Anna con 2 punti.');
    expect(leaderLine([s('Anna', 2, 1, 2), s('Bruno', 2, 1, 1)])).toBe('🥇 In testa Anna con 2 punti.');
  });

  it('counts more than three tied leaders instead of leaving the line out', () => {
    expect(leaderLine([s('A', 1), s('B', 1), s('C', 1), s('D', 1)])).toBe('🥇 In testa 4 giocatori a pari merito, con 1 punto.');
  });

  it('says nothing before any point', () => {
    expect(leaderLine([s('Anna', 0)])).toBe('');
  });
});

describe('standingsBlock', () => {
  const s = (name: string, points: number, played: number, sb = 0, won = 0): PlayerStanding => ({
    handle: name.toLowerCase(),
    name,
    played,
    won,
    drawn: 0,
    lost: 0,
    points,
    sb,
  });

  it('lists every player with shared places and half points', () => {
    expect(standingsBlock([s('Carla', 2, 2, 1, 2), s('Anna', 1.5, 2, 1, 1), s('Bruno', 1.5, 2, 1, 1), s('Dario', 0, 2)], '2')).toBe(
      ['📈 *Classifica dopo il Turno 2*', '1. Carla – 2 punti', '2. Anna – 1½ punti', '2. Bruno – 1½ punti', '4. Dario – 0 punti'].join('\n')
    );
  });

  it('is empty before the first game', () => {
    expect(standingsBlock([s('Anna', 0, 0), s('Bruno', 0, 0)], '1')).toBe('');
  });

  it('crowns the reigning champions (co-champions too)', () => {
    const out = standingsBlock([s('Carla', 2, 2, 1, 2), s('Anna', 1, 2), s('Bruno', 0, 2)], '3', ['anna', 'carla']).split('\n');
    expect(out.slice(1)).toEqual(['1. Carla 👑 – 2 punti', '2. Anna 👑 – 1 punto', '3. Bruno – 0 punti']);
  });

  it('puts the medal by who holds the Trofeo Pillsbury, after the crown', () => {
    const out = standingsBlock([s('Carla', 2, 2, 1, 2), s('Anna', 1, 2), s('Bruno', 0, 2)], '3', ['carla'], ['carla', 'bruno']).split('\n');
    expect(out.slice(1)).toEqual(['1. Carla 👑 🏅 – 2 punti', '2. Anna – 1 punto', '3. Bruno 🏅 – 0 punti']);
  });
});

describe('pillsburyLine', () => {
  const name = (h: string) => h[0].toUpperCase() + h.slice(1);
  const row = (handle: string, over: number, trend: Trend) => ({ handle, over, trend, forecast: { expected: 0, games: 0, expectedSoFar: 0, points: 0, played: 1 } });
  const race = (rows: ReturnType<typeof row>[], suspended = false): PillsburyRace => ({ suspended, rows, waiting: [], counted: {}, forecasts: {}, newcomers: [] });

  it('names who is above the objective, at most three, and never who is in line or below', () => {
    const r = race([row('carla', 2, 'up'), row('anna', 1, 'up'), row('bruno', 0.5, 'up'), row('dario', 0.5, 'up'), row('elena', 0, 'same'), row('fabio', -1, 'down')]);
    expect(pillsburyLine(r, name)).toBe('🏅 *Trofeo Pillsbury:* in testa Carla, poi Anna e Bruno');
    expect(pillsburyLine(race([row('carla', 1, 'up'), row('elena', 0, 'same'), row('fabio', -1, 'down')]), name)).toBe('🏅 *Trofeo Pillsbury:* in testa Carla');
  });

  it('names who share the lead together', () => {
    const r = race([row('carla', 1, 'up'), row('anna', 1, 'up'), row('bruno', 0.5, 'up'), row('dario', 0.5, 'up')]);
    expect(pillsburyLine(r, name)).toBe('🏅 *Trofeo Pillsbury:* in testa Carla e Anna, poi Bruno');
  });

  it('says the race is open while nobody is above, and is silent when suspended or before any game', () => {
    expect(pillsburyLine(race([row('elena', 0, 'same'), row('fabio', -1, 'down')]), name)).toBe('🏅 *Trofeo Pillsbury:* corsa ancora aperta, nessuno finora sopra le attese');
    expect(pillsburyLine(race([row('carla', 1, 'up')], true), name)).toBe('');
    expect(pillsburyLine(race([]), name)).toBe('');
  });
});

describe('studySearchUrl', () => {
  it('writes the spaces as "+", readable in a chat', () => {
    expect(studySearchUrl("Queen's Gambit Declined")).toBe("https://lichess.org/study/search?q=Queen's+Gambit+Declined&order=popular");
    expect(studySearchUrl('Caro-Kann Defense')).toBe('https://lichess.org/study/search?q=Caro-Kann+Defense&order=popular');
  });
});
