// «Io sono…»: a visitor can say which player they are (saved in the browser, see hooks/useMe). The
// public page then marks their row and opens with what is theirs: place, the game to play now and
// how far the objective of the Trofeo Pillsbury is.
import { HistoryGame, LichessExportGame } from '../types';
import { byRound, isVoid, stateOf } from './games';
import { gameProgress } from './progress';

export const ME_STORAGE_KEY = 'scacchi-and-chill:io-sono';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface MyGame {
  round: string;
  opponent: string; // handle
  color: 'white' | 'black';
  url: string; // empty while the challenge is still to create
  state: 'pending' | 'ongoing'; // link not created or not accepted yet, or on the board
}

// The game a player has to play now: the one of the earliest round not over yet, a created one
// first within the same round. None once every game of theirs is over.
export function myCurrentGame(handle: string, games: HistoryGame[], gameStates: Record<string, LichessExportGame>): MyGame | null {
  const open = games
    .filter((g) => same(g.white, handle) || same(g.black, handle))
    .map((g) => ({ g, s: stateOf(g, gameStates) }))
    .filter(({ s }) => gameProgress(s) !== 'finished' && !isVoid(s))
    .sort((a, b) => byRound(a.g.round, b.g.round) || Number(!!b.g.url) - Number(!!a.g.url));
  const first = open[0];
  if (!first) return null;
  const color = same(first.g.white, handle) ? 'white' : 'black';
  return {
    round: first.g.round,
    opponent: color === 'white' ? first.g.black : first.g.white,
    color,
    url: first.g.url,
    state: gameProgress(first.s) === 'ongoing' ? 'ongoing' : 'pending',
  };
}

// How the visitor stands against their objective, as the "ritmo" of the race table: the points at
// the end of the season if the games left go as the Elo expects, against the objective. "sei in
// linea", "sei ½ punto sopra", "sei 2 punti sotto". The points still missing say little after a
// couple of rounds (10 of 11), the pace says the same thing at any moment of the season.
export function paceText(objective: number, projected: number): string {
  const gap = projected - objective;
  if (gap === 0) return 'sei in linea';
  const n = String(Math.abs(gap)).replace('.5', '½').replace(/^0½/, '½');
  return `sei ${n} ${Math.abs(gap) <= 1 ? 'punto' : 'punti'} ${gap > 0 ? 'sopra' : 'sotto'}`;
}
