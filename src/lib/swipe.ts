// Swiping between the public tabs on phones: which gestures count, and where they lead

export type SwipeStep = 1 | -1; // 1: next tab (finger moves left), -1: previous tab

// Only a quick, clearly horizontal gesture: at least 60px sideways, far more sideways than
// vertical (a slightly diagonal scroll never changes tab), within 700ms (a slow drag is someone
// reading or selecting text)
export const MIN_DISTANCE = 60;
export const MAX_DURATION = 700;
// Touches starting this close to the screen edge are the browser's back/forward swipe
export const EDGE = 24;

export function swipeStep(dx: number, dy: number, ms: number): SwipeStep | null {
  if (ms > MAX_DURATION) return null;
  if (Math.abs(dx) < MIN_DISTANCE) return null;
  if (Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

export const startsAtEdge = (x: number, width: number) => x < EDGE || x > width - EDGE;

// The tab a step leads to; none past the first or the last (no wrapping around)
export function adjacentTab<T>(tabs: readonly T[], current: T | undefined, step: SwipeStep): T | undefined {
  if (current === undefined) return undefined;
  const i = tabs.indexOf(current);
  if (i < 0) return undefined;
  return tabs[i + step];
}
