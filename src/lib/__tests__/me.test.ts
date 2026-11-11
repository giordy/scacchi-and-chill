import { describe, expect, it } from 'vitest';
import { myCurrentGame, toObjectiveText } from '../me';
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

describe('toObjectiveText', () => {
  it('says how many points are missing, none once made', () => {
    expect(toObjectiveText(11, 8)).toBe('ti mancano 3 punti');
    expect(toObjectiveText(7, 6.5)).toBe('ti manca ½ punto');
    expect(toObjectiveText(7, 6)).toBe('ti manca 1 punto');
    expect(toObjectiveText(7, 7)).toBeNull();
    expect(toObjectiveText(0, 0)).toBeNull();
  });
});
