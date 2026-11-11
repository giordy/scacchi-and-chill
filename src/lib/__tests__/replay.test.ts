import { describe, expect, it } from 'vitest';
import { replayGifFor, replayGifUrl, studyChapterOf } from '../../components/GameReplay';

describe('replayGifUrl', () => {
  it('asks Lichess for the animated game with the Staunty pieces of the site', () => {
    expect(replayGifUrl('KXmPfreU')).toBe('https://lichess1.org/game/export/gif/KXmPfreU.gif?piece=staunty&theme=green');
  });
});

describe('replayGifFor', () => {
  it('replays games and study chapters', () => {
    expect(replayGifFor('https://lichess.org/KXmPfreU')).toBe('https://lichess1.org/game/export/gif/KXmPfreU.gif?piece=staunty&theme=green');
    expect(studyChapterOf('https://lichess.org/study/tGEhgIAZ/wLvBG6PX')).toEqual({ study: 'tGEhgIAZ', chapter: 'wLvBG6PX' });
    expect(replayGifFor('https://lichess.org/study/tGEhgIAZ/wLvBG6PX')).toBe('https://lichess.org/study/tGEhgIAZ/wLvBG6PX.gif?piece=staunty&theme=green');
    expect(replayGifFor('https://lichess.org/study/tGEhgIAZ')).toBeUndefined(); // a whole study: which chapter?
    expect(replayGifFor('https://example.com/game')).toBeUndefined();
  });
});
