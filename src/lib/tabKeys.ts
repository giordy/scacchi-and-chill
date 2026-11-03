import type React from 'react';

// Keyboard support for role="tablist" (WAI-ARIA tabs pattern): arrows move to the
// previous/next tab, Home/End to the first/last one, and the focused tab is activated.
// Pair it with tabIndex={selected ? 0 : -1} on each tab, so Tab enters the list once.
export function onTabListKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
      ? tabs.length - 1
      : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
