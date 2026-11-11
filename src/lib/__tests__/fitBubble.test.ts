import { describe, expect, it } from 'vitest';
import { fitBubble } from '../fitBubble';

// A bubble at a given place on the screen: only what fitBubble reads and writes
const bubble = (left: number, width: number) => {
  const el = { style: { marginLeft: '' }, getBoundingClientRect: () => ({ left, right: left + width, width }) };
  return el as unknown as HTMLElement & { style: { marginLeft: string } };
};

describe('fitBubble', () => {
  it('leaves a bubble inside the screen where it is', () => {
    const b = bubble(20, 200);
    fitBubble(b, 390);
    expect(b.style.marginLeft).toBe('');
  });

  it('moves a bubble running past the right edge back in', () => {
    const b = bubble(300, 220); // right edge at 520 on a 390px screen
    fitBubble(b, 390);
    expect(b.style.marginLeft).toBe('-138px');
  });

  it('keeps the left edge on screen when the bubble is wider than it', () => {
    const b = bubble(4, 400);
    fitBubble(b, 390);
    expect(b.style.marginLeft).toBe('4px');
  });

  it('does nothing on a hidden bubble', () => {
    const b = bubble(0, 0);
    fitBubble(b, 390);
    expect(b.style.marginLeft).toBe('');
  });
});
