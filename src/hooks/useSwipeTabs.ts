import { useEffect, useRef } from 'react';
import { startsAtEdge, swipeStep, SwipeStep } from '../lib/swipe';

// True when the touch starts on something that handles sideways moves itself: a table or other
// box that scrolls horizontally (standings, crosstable on phones), a form field, an open dialog
// (the game replay), or anything marked data-no-swipe
function handlesOwnSwipe(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (el.matches('input, select, textarea, dialog, [data-no-swipe]')) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
  }
  return false;
}

// Calls onSwipe(1) for a swipe to the left (next tab) and onSwipe(-1) for a swipe to the right,
// on touch screens only. It listens on the whole page, footer and the empty space under a short
// tab included, while the component using it is on screen. Listeners are passive: scrolling is
// never blocked or delayed.
export function useSwipeTabs(onSwipe: (step: SwipeStep) => void) {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const root = document;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (startsAtEdge(t.clientX, window.innerWidth) || handlesOwnSwipe(e.target)) return;
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const step = swipeStep(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t);
      start = null;
      // A text selection in progress is not a swipe
      if (step && !window.getSelection()?.toString()) onSwipeRef.current(step);
    };
    const onCancel = () => {
      start = null;
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
    };
  }, []);
}
