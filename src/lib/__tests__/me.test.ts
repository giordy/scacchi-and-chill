import { describe, expect, it } from 'vitest';
import { myCurrentGame, paceText } from '../me';
import { HistoryGame, LichessExportGame } from '../../types';

const games: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa' },
  { round: '2', white: 'carla', black: 'Anna', url: 'https://lichess.org/bbbbbbbb' },
  { round: '3', white: 'anna', black: 'dario', url: '' },
];
const states: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white' },
  bbbbbbbb: { id: 'bbbbbbbb', status: 'started' },
};

describe('myCurrentGame', () => {
  it('is the game of the earliest round not over yet', () => {
    expect(myCurrentGame('anna', games, states)).toEqual({ round: '2', opponent: 'carla', color: 'black', url: 'https://lichess.org/bbbbbbbb', state: 'ongoing' });
  });
  it('is a game still to create once the others are over', () => {
    const over = { ...states, bbbbbbbb: { id: 'bbbbbbbb', status: 'draw' } };
    expect(myCurrentGame('ANNA', games, over)).toEqual({ round: '3', opponent: 'dario', color: 'white', url: '', state: 'pending' });
  });
  it('is none when every game is over', () => {
    expect(myCurrentGame('bruno', games, states)).toBeNull();
  });
});

describe('paceText', () => {
  it('says how far the pace is from the objective', () => {
    expect(paceText(11, 11)).toBe('sei in linea');
    expect(paceText(11, 11.5)).toBe('sei ½ punto sopra');
    expect(paceText(7, 6)).toBe('sei 1 punto sotto');
    expect(paceText(7, 4.5)).toBe('sei 2½ punti sotto');
  });
});
