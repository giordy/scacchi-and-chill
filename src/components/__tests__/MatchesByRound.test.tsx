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
  it('shows a result decided by the organizer, 0-0 included, over what Lichess says', () => {
    const decided: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', lichess: { id: 'aaaaaaaa', status: 'doubleLoss', lastMoveAt: 1 } },
      { round: '1', white: 'carla', black: 'dario', url: 'https://lichess.org/bbbbbbbb', lichess: { id: 'bbbbbbbb', status: 'decided', lastMoveAt: 1 } },
    ];
    const live = { aaaaaaaa: { id: 'aaaaaaaa', status: 'started' } as any };
    const html = renderToStaticMarkup(<MatchesByRound games={decided} gameStates={live} nameOf={nameOf} />);
    expect(html).toContain('0 – 0');
    expect(html).toContain('½ – ½');
    expect(html.match(/Deciso dall&#x27;organizzatore/g)).toHaveLength(2);
    expect(html).not.toContain('In corso');
  });

  it('says until when the round in progress goes on, only with the Turni con scadenza', () => {
    const open: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', lichess: { id: 'aaaaaaaa', status: 'mate', winner: 'white' } },
      { round: '2', white: 'carla', black: 'dario', url: 'https://lichess.org/bbbbbbbb', lichess: { id: 'bbbbbbbb', status: 'started' } },
    ];
    const end = Date.UTC(2026, 11, 7, 23); // the end of Monday 7 December in Italy
    const now = Date.UTC(2026, 11, 4, 12);
    const html = (roundEndOf?: (r: string) => number | undefined, at = now) =>
      renderToStaticMarkup(<MatchesByRound games={open} gameStates={{}} nameOf={nameOf} roundEndOf={roundEndOf} now={at} />);
    expect(html((r) => (r === '2' ? end : undefined))).toContain('Fino a lunedì 7 dicembre');
    expect(html((r) => (r === '2' ? end : undefined))).not.toContain('mancano');
    expect(html((r) => (r === '2' ? end : undefined), end + 1)).toContain('Si è chiuso lunedì 7 dicembre: le partite in corso continuano');
    expect(html()).not.toContain('round-group-deadline');
    // only the current round: the played one says nothing, even with an end
    expect(html((r) => (r === '1' ? end : undefined))).not.toContain('round-group-deadline');
  });

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

  it('offers the key moments of an analysed finished game, and of no other', () => {
    const analysis = { v: 3, id: 'aaaaaaaa', curve: [50, 60], turns: [], best: [{ ply: 1, color: 'white' as const, san: 'e4', uci: 'e2e4', fen: 'x', after: 60, gap: 10 }], swings: 0 };
    const finishedState = { id: 'aaaaaaaa', status: 'mate', winner: 'white' as const, moves: 'e4 e5', lastFen: '8/8/8/8/8/8/8/K6k w - - 0 1' };
    const card = (g: HistoryGame) => renderToStaticMarkup(<MatchesByRound games={[g]} gameStates={{}} nameOf={nameOf} />);
    const base: HistoryGame = { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', lichess: finishedState };
    expect(card({ ...base, analysis })).toContain('Momenti chiave');
    // not analysed yet, an analysis of another link, a game still going, a result decided by the organizer
    expect(card(base)).not.toContain('Momenti chiave');
    expect(card({ ...base, analysis: { ...analysis, id: 'zzzzzzzz' } })).not.toContain('Momenti chiave');
    expect(card({ ...base, lichess: { ...finishedState, status: 'started', winner: undefined }, analysis })).not.toContain('Momenti chiave');
    expect(card({ ...base, analysis, decision: { result: '0-1', at: 1 } })).not.toContain('Momenti chiave');
    // the small board of the card has no files and ranks
    expect(card({ ...base, analysis })).not.toContain('mb-coords');
  });

  it('shows the key moments greyed, explained with a tap, while the analysis of a finished game is on its way', () => {
    const moves = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8';
    const state = { id: 'aaaaaaaa', status: 'resign', winner: 'white' as const, moves, lastFen: '8/8/8/8/8/8/8/K6k w - - 0 1' };
    const base: HistoryGame = { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', lichess: state };
    const card = (g: HistoryGame) => renderToStaticMarkup(<MatchesByRound games={[g]} gameStates={{}} nameOf={nameOf} />);
    const html = card(base);
    expect(html).toContain('match-moments is-pending');
    expect(html).toContain('L&#x27;analisi è in preparazione: di solito arriva entro un quarto d&#x27;ora dalla fine della partita.');
    // once analysed: the real button, no more greyed one
    const done = card({ ...base, analysis: { v: 5, id: 'aaaaaaaa', curve: [50, 60], turns: [], best: [], chances: [], phases: { middle: 1 } } });
    expect(done).toContain('class="match-moments"');
    expect(done).not.toContain('is-pending');
    // a game the analysis leaves out, or could not analyse: no button at all
    expect(card({ ...base, lichess: { ...state, moves: 'e4 e5' } })).not.toContain('Momenti chiave');
    expect(card({ ...base, analysis: { v: 5, id: 'aaaaaaaa', skipped: 'engine' } })).not.toContain('Momenti chiave');
  });

  it('says in the replay that the key moments are on their way', async () => {
    const { GameReplay } = await import('../GameReplay');
    const html = renderToStaticMarkup(<GameReplay url="https://lichess.org/aaaaaaaa" title="Anna – Bruno" onClose={() => {}} pending />);
    expect(html).toContain('I momenti chiave sono in preparazione');
    expect(renderToStaticMarkup(<GameReplay url="https://lichess.org/aaaaaaaa" title="Anna – Bruno" onClose={() => {}} />)).not.toContain('in preparazione');
  });
});
