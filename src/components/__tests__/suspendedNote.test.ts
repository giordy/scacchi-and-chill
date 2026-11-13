import { describe, expect, it } from 'vitest';
import { suspendedToMention } from '../../PublicTournamentView';
import { computeStandings } from '../../lib/standings';
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
const mention = (games: HistoryGame[], out: string[], concluded = false) =>
  suspendedToMention(players, computeStandings(players, games, {}).standings, games, {}, new Set(out), concluded);

describe('the note under the table on who can win no trophy', () => {
  // Anna 2, Bruno 0 with 1 left: out of the race. Carla 0 with 2 left: still in it
  const games = [won('1', 'anna', 'bruno', 'white'), won('2', 'anna', 'bruno', 'white'), todo('3', 'bruno', 'carla'), todo('4', 'carla', 'anna')];
  it('names them while they would still be in the race for the Scudetto', () => {
    expect(mention(games, ['anna'])).toEqual(['Anna']);
    expect(mention(games, ['carla'])).toEqual(['Carla']);
  });
  it('says nothing when the rule changes nothing: out of the race anyway, or everyone still in it', () => {
    expect(mention(games, ['bruno'])).toEqual([]);
    expect(mention([won('1', 'anna', 'bruno', 'white'), todo('2', 'bruno', 'carla'), todo('3', 'carla', 'anna')], ['anna'])).toEqual([]);
  });
  it('at the end of the season, names them only if they finished first', () => {
    const over = [won('1', 'anna', 'bruno', 'white'), won('2', 'carla', 'bruno', 'white'), won('3', 'anna', 'carla', 'white')];
    expect(mention(over, ['anna'], true)).toEqual(['Anna']);
    expect(mention(over, ['carla'], true)).toEqual([]);
  });
});
