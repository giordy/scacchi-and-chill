import { describe, expect, it } from 'vitest';
import { anecdoteForRound, anecdotesFromText, anecdotesToText, anecdoteText, publishedAnecdotes } from '../masterAnecdotes';
import { DEFAULT_TOURNAMENT, mergeTournamentMeta, tournamentFromDoc } from '../tournament';
import { HistoryGame } from '../../types';

const list = [
  { title: 'Primo', text: 'Uno' },
  { title: 'Secondo', text: 'Due *grassetto*' },
  { title: 'Terzo', text: 'Tre' },
];

describe('master anecdotes', () => {
  it('gives round N its anecdote #N', () => {
    expect(anecdoteForRound(list, '2')).toEqual({ n: 2, anecdote: list[1] });
    expect(anecdoteForRound(list, '4')).toBeUndefined();
    expect(anecdoteForRound(undefined, '1')).toBeUndefined();
    expect(anecdoteText(2, list[1])).toBe('📜 *Aneddoto #2: Secondo*\nDue *grassetto*');
  });

  it('publishes only the anecdotes of rounds already started', () => {
    const history: HistoryGame[] = [
      { round: '1', white: 'a', black: 'b', url: 'https://lichess.org/aaaaaaaa' },
      { round: '2', white: 'a', black: 'b', url: 'https://lichess.org/bbbbbbbb' },
      { round: '3', white: 'a', black: 'b', url: '' }, // scheduled, no link yet
    ];
    expect(publishedAnecdotes(list, history).map((x) => x.n)).toEqual([1, 2]);
  });

  it('round-trips the editor text and reads anecdotes pasted from WhatsApp', () => {
    expect(anecdotesFromText(anecdotesToText(list))).toEqual(list);
    const pasted = '*Aneddoto #1: Imparò a 4 anni*\nJosé Raúl...\nseconda riga\n\n---\n\n*Aneddoto #2: Campione a 12 anni*\nA soli 12 anni...\n---\nsolo titolo';
    expect(anecdotesFromText(pasted)).toEqual([
      { title: 'Imparò a 4 anni', text: 'José Raúl...\nseconda riga' },
      { title: 'Campione a 12 anni', text: 'A soli 12 anni...' },
    ]);
  });

  it('keeps the default anecdotes only for the season they were written for', () => {
    expect(DEFAULT_TOURNAMENT.masterAnecdotes).toHaveLength(14);
    const doc = { title: 'Scacchi & Chill', season: DEFAULT_TOURNAMENT.season };
    expect(tournamentFromDoc(doc)?.masterAnecdotes).toHaveLength(14);
    expect(tournamentFromDoc({ ...doc, season: 'Stagione 3 - Tal' })?.masterAnecdotes).toEqual([]);
    expect(tournamentFromDoc({ ...doc, masterAnecdotes: list })?.masterAnecdotes).toEqual(list);
    expect(mergeTournamentMeta(tournamentFromDoc(doc)!, { masterAnecdotes: [] }).masterAnecdotes).toEqual([]);
  });
});
