import { describe, expect, it } from 'vitest';
import { needText, titleRace } from '../titleRace';
import { HistoryGame } from '../../types';

const players = ['anna', 'bruno', 'carla'].map((h) => ({ handle: h, name: h[0].toUpperCase() + h.slice(1) }));
const won = (round: string, white: string, black: string, winner: 'white' | 'black'): HistoryGame => ({
  round,
  white,
  black,
  url: '',
  lichess: { id: '', status: 'resign', winner },
});
const todo = (round: string, white: string, black: string): HistoryGame => ({ round, white, black, url: '' });

describe('titleRace', () => {
  it('says nothing while everyone can still win', () => {
    // Anna 1, Bruno 0 (2 left), Carla 0 (2 left)
    expect(titleRace(players, [won('1', 'anna', 'bruno', 'white'), todo('2', 'bruno', 'carla'), todo('3', 'carla', 'anna')], {})).toBeNull();
  });

  it('names only the players still in the race', () => {
    // Anna 2, Bruno 0 with 1 left (max 1): out. Carla 0 with 2 left (max 2): can draw level
    const games = [won('1', 'anna', 'bruno', 'white'), won('2', 'anna', 'bruno', 'white'), todo('3', 'bruno', 'carla'), todo('4', 'carla', 'anna')];
    const race = titleRace(players, games, {})!;
    expect(race.contenders.map((c) => c.handle)).toEqual(['anna', 'carla']);
    expect(race.champion).toBeUndefined();
    expect(race.roundsLeft).toBe(2);
    // Anna: half a point against Carla is enough; Carla: winning both only draws her level
    expect(race.needs).toEqual([
      { handle: 'anna', left: 1, alone: 0.5, level: 0 },
      { handle: 'carla', left: 2, alone: null, level: 2 },
    ]);
  });

  it('leaves out who can win no trophy (fair play): the race is among the others', () => {
    // Anna 2 can win no trophy: Carla, 0 with 2 left, leads the race against Bruno, 0 with 1 left
    const games = [won('1', 'anna', 'bruno', 'white'), won('2', 'anna', 'bruno', 'white'), todo('3', 'bruno', 'carla'), todo('4', 'carla', 'anna')];
    expect(titleRace(players, games, {}, new Set(['anna']))).toBeNull(); // both can still win it
    const later = [...games.slice(0, 2), won('3', 'bruno', 'carla', 'black'), todo('4', 'carla', 'anna')];
    const race = titleRace(players, later, {}, new Set(['anna']))!;
    expect(race.champion).toEqual({ handle: 'carla', name: 'Carla' });
    expect(race.contenders.map((c) => c.handle)).toEqual(['carla']);
  });

  it('crowns the leader once nobody can reach them', () => {
    // Anna 3, Bruno 0 and Carla 0, with one game each left
    const games = [
      won('1', 'anna', 'bruno', 'white'),
      won('2', 'carla', 'anna', 'black'),
      won('3', 'anna', 'bruno', 'white'),
      todo('4', 'bruno', 'carla'),
    ];
    const race = titleRace(players, games, {})!;
    expect(race.champion).toEqual({ handle: 'anna', name: 'Anna' });
    expect(race.roundsLeft).toBe(1);
  });

  it('counts an aborted game as still to play, and says nothing once the season is over', () => {
    const aborted: HistoryGame = { round: '2', white: 'bruno', black: 'carla', url: '', lichess: { id: '', status: 'aborted' } };
    const games = [won('1', 'anna', 'bruno', 'white'), won('1', 'anna', 'carla', 'white'), aborted];
    expect(titleRace(players, games, {})?.contenders.map((c) => c.handle)).toEqual(['anna']);
    expect(titleRace(players, games.slice(0, 2), {})).toBeNull();
  });
});

describe('needText', () => {
  it('says what a contender needs', () => {
    expect(needText({ handle: 'a', left: 3, alone: 2, level: 1.5 })).toBe('bastano 2 punti nelle ultime 3 partite');
    expect(needText({ handle: 'a', left: 1, alone: 0.5, level: 0 })).toBe("basta ½ punto nell'ultima partita");
    expect(needText({ handle: 'a', left: 2, alone: 2, level: 1.5 })).toBe('deve vincere tutte le ultime 2 partite');
    expect(needText({ handle: 'a', left: 2, alone: null, level: 2 })).toBe('con 2 punti nelle ultime 2 partite arriva almeno a pari punti; per il primo posto servono passi falsi degli altri');
    expect(needText({ handle: 'a', left: 2, alone: null, level: null })).toBe('non dipende solo dalle sue partite: servono passi falsi degli altri');
  });

  it('has its own words for who has no games left', () => {
    // Anna 2 and done; Bruno 1 with a game against Carla left: he can only draw level
    const games = [won('1', 'anna', 'bruno', 'white'), won('2', 'anna', 'carla', 'white'), won('1', 'bruno', 'carla', 'white'), todo('3', 'carla', 'bruno')];
    const anna = titleRace(players, games, {})!.needs[0];
    expect(anna).toEqual({ handle: 'anna', left: 0, alone: null, level: 0 });
    expect(needText(anna)).toBe('ha finito le sue partite: nessuno può superarlo, ma può ancora essere raggiunto a pari punti');
    expect(needText({ handle: 'a', left: 0, alone: null, level: null })).toBe('ha finito le sue partite: servono passi falsi degli altri');
  });
});
