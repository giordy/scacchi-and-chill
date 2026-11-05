import { describe, expect, it } from 'vitest';
import { replayGifUrl } from '../../components/GameReplay';

describe('replayGifUrl', () => {
  it('asks Lichess for the animated game with the Staunty pieces of the site', () => {
    expect(replayGifUrl('KXmPfreU')).toBe('https://lichess1.org/game/export/gif/KXmPfreU.gif?piece=staunty&theme=green');
  });
});
