import { describe, expect, it } from 'vitest';
import { gameHref, gameOverHref, pageOfHash, parseGameHash, parsePlayerHash, parsePublicView } from '../routes';
import { findGame } from '../gameLookup';
import { GameAnalysis, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

describe('the address of a game', () => {
  it('has one of its own to share, straight to the key moments or not', () => {
    expect(gameHref('abcdefgh')).toBe('#/partita/abcdefgh');
    expect(gameHref('abcdefgh', true)).toBe('#/partita/abcdefgh/momenti');
    expect(parseGameHash('#/partita/abcdefgh')).toEqual({ id: 'abcdefgh', moments: false, shared: true });
    expect(parseGameHash('#/partita/abcdefgh/momenti')).toEqual({ id: 'abcdefgh', moments: true, shared: true });
  });

  it('opens over the Partite tab when shared', () => {
    expect(parsePublicView('#/partita/abcdefgh')).toBe('matches');
    expect(pageOfHash('#/partita/abcdefgh/momenti')).toBe('#/partite');
  });

  it('opens over the page it was opened from, which stays under it', () => {
    expect(gameOverHref('#/cronaca', 'abcdefgh')).toBe('#/cronaca?partita=abcdefgh');
    expect(gameOverHref('#/giocatore/anna', 'abcdefgh', true)).toBe('#/giocatore/anna?momenti=abcdefgh');
    expect(gameOverHref('', 'abcdefgh')).toBe('#/?partita=abcdefgh');
    // Another game opened from the replay replaces the first
    expect(gameOverHref('#/cronaca?partita=abcdefgh', 'ijklmnop')).toBe('#/cronaca?partita=ijklmnop');
    expect(parseGameHash('#/cronaca?partita=abcdefgh')).toEqual({ id: 'abcdefgh', moments: false, shared: false });
    expect(parseGameHash('#/giocatore/anna?momenti=abcdefgh')).toEqual({ id: 'abcdefgh', moments: true, shared: false });
    expect(parsePublicView('#/cronaca?partita=abcdefgh')).toBe('timeline');
    expect(parsePlayerHash('#/giocatore/anna?momenti=abcdefgh')).toBe('anna');
    expect(pageOfHash('#/giocatore/anna?momenti=abcdefgh')).toBe('#/giocatore/anna');
  });

  it('is none for anything else', () => {
    for (const h of ['', '#/partite', '#/partita/', '#/partita/abc', '#/partita/abcdefgh!', '#/cronaca?partita=<script>', '#admin']) {
      expect(parseGameHash(h)).toBeNull();
    }
  });
});

describe('findGame', () => {
  const nameOf = (h: string, fallback?: string) => ({ anna: 'Anna', bruno: 'Bruno' } as Record<string, string>)[h] ?? fallback ?? h;
  const analysis: GameAnalysis = { v: 5, id: 'aaaaaaaa', curve: [50, 90, 100], turns: [] };
  const history: HistoryGame[] = [
    { round: '2', white: 'anna', black: 'bruno', url: 'https://lichess.org/aaaaaaaa', analysis },
    { round: '3', white: 'bruno', black: 'anna', url: 'https://lichess.org/bbbbbbbb' },
    { round: '4', white: 'anna', black: 'bruno', url: 'https://lichess.org/cccccccc', decision: { result: '0-0', at: 1 } },
  ];
  const states: Record<string, LichessExportGame> = {
    aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white' },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'started' },
  };
  const season = {
    id: 'stagione-1',
    season: 'Scacchi & Chill - Stagione 1',
    title: 'Scacchi & Chill',
    archivedAt: '2026-06-30T10:00:00.000Z',
    standings: [{ handle: 'carla', name: 'Carla', played: 1, won: 1, drawn: 0, lost: 0, points: 1, sb: 0 }],
    games: [
      { round: '5', white: 'carla', black: 'anna', result: '1-0', id: 'dddddddd', status: 'resign' },
      { round: '6', white: 'anna', black: 'carla', result: '1-0', id: 'eeeeeeee', status: 'decided' },
      { round: '–', white: 'anna', black: 'carla', result: '½-½', id: 'ffffffff', status: 'draw' },
    ],
  } as unknown as SeasonArchive;

  it('finds a game of this season, with its key moments', () => {
    expect(findGame('aaaaaaaa', history, states, [season], nameOf)).toMatchObject({
      white: 'Anna',
      black: 'Bruno',
      round: '2',
      ongoing: false,
      decided: false,
      analysis,
      ending: { status: 'mate', winner: 'white' },
    });
    expect(findGame('aaaaaaaa', history, states, [], nameOf)?.season).toBeUndefined();
  });

  it('says when a game is still on the board, or decided by the organizer', () => {
    expect(findGame('bbbbbbbb', history, states, [], nameOf)?.ongoing).toBe(true);
    expect(findGame('cccccccc', history, states, [], nameOf)).toMatchObject({ decided: true, analysis: undefined });
  });

  it('finds a game of an archived season, with the names of then', () => {
    expect(findGame('dddddddd', history, states, [season], nameOf)).toMatchObject({
      url: 'https://lichess.org/dddddddd',
      white: 'Carla',
      black: 'Anna',
      season: 'Stagione 1',
      ending: { status: 'resign', winner: 'white' },
      ongoing: false,
      decided: false,
    });
    expect(findGame('eeeeeeee', history, states, [season], nameOf)?.decided).toBe(true);
    // A season archived without its rounds
    expect(findGame('ffffffff', history, states, [season], nameOf)).toMatchObject({ round: undefined, ending: { status: 'draw', winner: undefined } });
  });

  it('finds nothing for a game outside the tournament', () => {
    expect(findGame('zzzzzzzz', history, states, [season], nameOf)).toBeUndefined();
  });
});
