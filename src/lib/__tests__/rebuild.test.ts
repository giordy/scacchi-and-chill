import { describe, expect, it } from 'vitest';
import { isTournamentCandidate, lastMoveOf, lichessIdsFromText, playersOfGames, rebuiltHistory } from '../rebuild';
import { LichessExportGame } from '../../types';

const game = (id: string, white: string, black: string, extra: Partial<LichessExportGame> = {}): LichessExportGame => ({
  id,
  status: 'resign',
  winner: 'white',
  speed: 'correspondence',
  createdAt: 100,
  players: { white: { user: { name: white } }, black: { user: { name: black } } },
  ...extra,
});

describe('lichessIdsFromText', () => {
  it('finds game ids in a WhatsApp export, once each', () => {
    const chat = [
      '12/09/25, 21:14 - Fabio: finita! https://lichess.org/AbCd1234',
      '13/09/25, 08:02 - Matteo: https://lichess.org/AbCd1234wXyZ ahah',
      '14/09/25, 10:00 - Giordano: lichess.org/game/ZzZz9999 e https://lichess.org/@/fsgach',
      '15/09/25, 10:00 - Luca: https://lichess.org/study/abcdefgh https://lichess.org/tournament',
      '16/09/25, 10:00 - Luca: https://lichess.org/Qwer5678/black#40',
    ].join('\n');
    expect(lichessIdsFromText(chat)).toEqual(['AbCd1234', 'ZzZz9999', 'Qwer5678']);
  });
});

describe('isTournamentCandidate', () => {
  it('keeps correspondence games between two accounts', () => {
    expect(isTournamentCandidate(game('a', 'x', 'y'))).toBe(true);
    expect(isTournamentCandidate(game('a', 'x', 'y', { speed: 'blitz' }))).toBe(false);
    expect(isTournamentCandidate(game('a', 'x', 'y', { players: { white: { user: { name: 'x' } }, black: {} } }))).toBe(false);
  });
});

describe('playersOfGames', () => {
  it('counts games per player, whatever the case', () => {
    expect(playersOfGames([game('a', 'Fabio', 'matteo'), game('b', 'fabio', 'Luca')])).toEqual([
      { handle: 'Fabio', games: 2 }, // the first spelling met
      { handle: 'Luca', games: 1 },
      { handle: 'matteo', games: 1 },
    ]);
  });
});

describe('rebuiltHistory', () => {
  it('keeps games among the chosen players, oldest first, then the forfeits', () => {
    const players = [
      { handle: 'Fabio', name: 'Fabio' },
      { handle: 'matteo', name: 'Matteo' },
    ];
    const history = rebuiltHistory(
      [game('bbbbbbbb', 'fabio', 'Matteo', { createdAt: 200 }), game('aaaaaaaa', 'matteo', 'fabio', { createdAt: 100 }), game('cccccccc', 'fabio', 'stranger')],
      players,
      [{ white: 'Fabio', black: 'matteo', winner: 'black' }]
    );
    expect(history.map((h) => [h.white, h.black, h.url, h.round])).toEqual([
      ['matteo', 'Fabio', 'https://lichess.org/aaaaaaaa', '–'],
      ['Fabio', 'matteo', 'https://lichess.org/bbbbbbbb', '–'],
      ['Fabio', 'matteo', '', '–'],
    ]);
    expect(history[2].lichess).toEqual({ id: '', status: 'forfeit', winner: 'black' });
  });
});

describe('lastMoveOf', () => {
  it('is the latest move of the games', () => {
    expect(lastMoveOf([game('a', 'x', 'y', { lastMoveAt: 500 }), game('b', 'x', 'y', { lastMoveAt: 900 })])?.getTime()).toBe(900);
    expect(lastMoveOf([])).toBeUndefined();
  });
});
