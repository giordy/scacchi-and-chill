import { describe, expect, it } from 'vitest';
import { parseRoundMessage } from '../parse';
import { extractGameId } from '../utils';

const players = [
  { name: 'Fabio', handle: 'fsgach' },
  { name: 'Marco', handle: 'marco_chess' },
  { name: 'Luca', handle: 'lucab' },
  { name: 'José', handle: 'jose99' },
];

describe('parseRoundMessage', () => {
  it('reads the round number and the pairings, white first', () => {
    const text = `Turno 3
Fabio vs Marco https://lichess.org/AbCdEfGh
Luca - José https://lichess.org/Zy9Xw8Vu`;
    const r = parseRoundMessage(text, players);
    expect(r.round).toBe('3');
    expect(r.problems).toEqual([]);
    expect(r.games).toEqual([
      { white: 'fsgach', black: 'marco_chess', url: 'https://lichess.org/AbCdEfGh' },
      { white: 'lucab', black: 'jose99', url: 'https://lichess.org/Zy9Xw8Vu' },
    ]);
  });

  it('is case-insensitive and accepts "Round"', () => {
    const r = parseRoundMessage('ROUND 12\nmarco vs fabio lichess.org/AbCdEfGh', players);
    expect(r.round).toBe('12');
    expect(r.games[0]).toMatchObject({ white: 'marco_chess', black: 'fsgach' });
  });

  it('recognizes handles as well as names', () => {
    const r = parseRoundMessage('Turno 1\nfsgach vs marco_chess https://lichess.org/AbCdEfGh', players);
    expect(r.games[0]).toMatchObject({ white: 'fsgach', black: 'marco_chess' });
  });

  it('supports the game/ and challenge/ URL formats and strips extra characters', () => {
    const text = `Turno 1
Fabio vs Marco https://lichess.org/game/AbCdEfGh
Luca vs José https://lichess.org/challenge/Zy9Xw8Vu?color=white`;
    const r = parseRoundMessage(text, players);
    expect(r.games.map((g) => g.url)).toEqual([
      'https://lichess.org/AbCdEfGh',
      'https://lichess.org/Zy9Xw8Vu',
    ]);
  });

  it('truncates 12-character player URLs to the 8-character game id', () => {
    const r = parseRoundMessage('Fabio vs Marco https://lichess.org/AbCdEfGhIjKl', players);
    expect(r.games[0].url).toBe('https://lichess.org/AbCdEfGh');
  });

  it('does not match a name inside a longer word', () => {
    const r = parseRoundMessage('Marcotti vs Lucano https://lichess.org/AbCdEfGh', players);
    expect(r.games).toEqual([]);
    expect(r.problems).toHaveLength(1);
  });

  it('reports a problem when fewer than two players are found before a link', () => {
    const r = parseRoundMessage('Turno 2\nFabio https://lichess.org/AbCdEfGh', players);
    expect(r.games).toEqual([]);
    expect(r.problems[0]).toContain('Link 1');
  });

  it('keeps the valid games when one link is broken', () => {
    const text = `Turno 2
Fabio https://lichess.org/AbCdEfGh
Luca vs Marco https://lichess.org/Zy9Xw8Vu`;
    const r = parseRoundMessage(text, players);
    expect(r.games).toHaveLength(1);
    expect(r.games[0]).toMatchObject({ white: 'lucab', black: 'marco_chess' });
    expect(r.problems).toHaveLength(1);
  });

  it('returns an empty round when there is no "turno" keyword', () => {
    expect(parseRoundMessage('niente da vedere', players)).toEqual({ round: '', games: [], problems: [] });
  });
});

describe('extractGameId', () => {
  it('extracts the id from the supported URL formats', () => {
    expect(extractGameId('https://lichess.org/AbCdEfGh')).toBe('AbCdEfGh');
    expect(extractGameId('lichess.org/game/AbCdEfGh')).toBe('AbCdEfGh');
    expect(extractGameId('https://www.lichess.org/AbCdEfGhIjKl')).toBe('AbCdEfGh');
  });

  it('returns undefined for missing or foreign URLs', () => {
    expect(extractGameId(undefined)).toBeUndefined();
    expect(extractGameId('https://example.com/AbCdEfGh')).toBeUndefined();
  });
});
