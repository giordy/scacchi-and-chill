import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchesByRound } from '../MatchesByRound';
import { HistoryGame } from '../../types';

const games: HistoryGame[] = [
  { round: '1', white: 'anna', black: 'Bruno', url: 'https://lichess.org/aaaaaaaa', lichess: { id: 'aaaaaaaa', status: 'mate', winner: 'white', moves: 'e4 e5' } },
  { round: '1', white: 'carla', black: 'dario', url: '' }, // planned, no link yet
];
const nameOf = (h: string) => h[0].toUpperCase() + h.slice(1).toLowerCase();

describe('MatchesByRound', () => {
  it('links every player name to their profile, played or planned games alike', () => {
    const html = renderToStaticMarkup(<MatchesByRound games={games} gameStates={{}} nameOf={nameOf} />);
    const links = [...html.matchAll(/<a href="([^"]+)" class="player-name player-page-link">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([
      ['#/giocatore/anna', 'Anna'],
      ['#/giocatore/Bruno', 'Bruno'],
      ['#/giocatore/carla', 'Carla'],
      ['#/giocatore/dario', 'Dario'],
    ]);
  });

  it('keeps the winner highlighted', () => {
    const html = renderToStaticMarkup(<MatchesByRound games={games} gameStates={{}} nameOf={nameOf} />);
    expect(html).toMatch(/<div class="player-row is-winner">.*?#\/giocatore\/anna/);
  });

  it('marks the games with moves not seen, also in the summary of a closed round', () => {
    const html = renderToStaticMarkup(<MatchesByRound games={games} gameStates={{}} nameOf={nameOf} moved={new Set(['aaaaaaaa'])} />);
    expect(html).toContain('match-card has-new-moves');
    expect(html).toContain('Appena conclusa');
    expect(html).toContain('1 con mosse nuove');
    const none = renderToStaticMarkup(<MatchesByRound games={games} gameStates={{}} nameOf={nameOf} />);
    expect(none).not.toContain('has-new-moves');
    expect(none).not.toContain('con mosse nuove');
  });

  it('orders the current round by what there is to see: new moves, ongoing, to play, finished', () => {
    const round: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', lichess: { id: 'aaaaaaaa', status: 'mate', winner: 'white', moves: 'e4 e5' } },
      { round: '1', white: 'carla', black: 'dario', url: '' },
      { round: '1', white: 'elena', black: 'fabio', url: 'https://lichess.org/cccccccc', lichess: { id: 'cccccccc', status: 'started', moves: 'e4' } },
      { round: '1', white: 'gino', black: 'hilda', url: 'https://lichess.org/dddddddd', lichess: { id: 'dddddddd', status: 'resign', winner: 'black', moves: 'd4 d5' } },
      { round: '2', white: 'anna', black: 'carla', url: '' },
    ];
    const whites = (html: string) => [...html.matchAll(/<article.*?player-page-link">([^<]+)</g)].map((m) => m[1]);
    const html = renderToStaticMarkup(<MatchesByRound games={round} gameStates={{}} nameOf={nameOf} moved={new Set(['dddddddd'])} />);
    expect(whites(html).slice(0, 4)).toEqual(['Gino', 'Elena', 'Carla', 'Anna']);
  });
});
