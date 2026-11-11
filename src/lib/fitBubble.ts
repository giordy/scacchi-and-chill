// Keeps an open explanation bubble (InfoTip) inside the screen: placed by CSS under its trigger or
// across its container, it can still run past an edge (a trigger near the right of a wide card, a
// narrow phone). Shifted sideways by the overflow, with a small margin.
const MARGIN = 8;

export function fitBubble(bubble: HTMLElement, viewportWidth = window.innerWidth): void {
  bubble.style.marginLeft = '';
  const r = bubble.getBoundingClientRect();
  if (r.width === 0) return; // not shown
  let shift = 0;
  if (r.right > viewportWidth - MARGIN) shift = viewportWidth - MARGIN - r.right;
  if (r.left + shift < MARGIN) shift = MARGIN - r.left; // the left edge wins on a bubble wider than the screen
  if (shift !== 0) bubble.style.marginLeft = `${Math.round(shift)}px`;
}
