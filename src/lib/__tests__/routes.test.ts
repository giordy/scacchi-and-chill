import { describe, expect, it } from 'vitest';
import { parsePlayerHash, parsePublicView, playerHref, publicViewHref } from '../routes';

describe('routes', () => {
  it('reads the Italian addresses already shared, and the English ones', () => {
    expect(parsePublicView('#/partite')).toBe('matches');
    expect(parsePublicView('#/games')).toBe('matches');
    expect(parsePublicView('#/albo')).toBe('hall');
    expect(parsePublicView('#/hall-of-fame')).toBe('hall');
    expect(parsePublicView('#/cronaca')).toBe('timeline');
    expect(parsePublicView('#/chronicle')).toBe('timeline');
    expect(parsePublicView('#/torneo/albo')).toBe('hall');
    expect(parsePublicView('#/whatever')).toBe('standings');
    expect(parsePlayerHash('#/giocatore/anna')).toBe('anna');
    expect(parsePlayerHash('#/player/Bruno')).toBe('Bruno');
    expect(parsePlayerHash('#/players/x')).toBeNull();
  });

  it('writes the addresses as before', () => {
    expect(publicViewHref('matches')).toBe('#/partite');
    expect(playerHref('anna')).toBe('#/giocatore/anna');
  });
});
