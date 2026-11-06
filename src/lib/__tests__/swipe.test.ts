import { describe, expect, it } from 'vitest';
import { adjacentTab, startsAtEdge, swipeStep } from '../swipe';

describe('swipeStep', () => {
  it('reads a quick swipe to the left as the next tab, to the right as the previous one', () => {
    expect(swipeStep(-80, 10, 200)).toBe(1);
    expect(swipeStep(80, -10, 200)).toBe(-1);
  });
  it('ignores short, diagonal or slow gestures', () => {
    expect(swipeStep(-50, 0, 200)).toBeNull();
    expect(swipeStep(-80, 50, 200)).toBeNull();
    expect(swipeStep(-80, 0, 900)).toBeNull();
  });
});

describe('startsAtEdge', () => {
  it('leaves the screen edges to the browser back swipe', () => {
    expect(startsAtEdge(10, 390)).toBe(true);
    expect(startsAtEdge(380, 390)).toBe(true);
    expect(startsAtEdge(200, 390)).toBe(false);
  });
});

describe('adjacentTab', () => {
  const tabs = ['standings', 'matches', 'season', 'hall'] as const;
  it('moves one tab, without wrapping around', () => {
    expect(adjacentTab(tabs, 'matches', 1)).toBe('season');
    expect(adjacentTab(tabs, 'matches', -1)).toBe('standings');
    expect(adjacentTab(tabs, 'standings', -1)).toBeUndefined();
    expect(adjacentTab(tabs, 'hall', 1)).toBeUndefined();
  });
  it('does nothing outside the tabs (the rules page)', () => {
    expect(adjacentTab(tabs, undefined, 1)).toBeUndefined();
  });
});
