import React from 'react';
import { onTabListKeyDown } from '../lib/tabKeys';

export type RoundView = 'pairings' | 'status';

// The work of the current round: create the challenges, then follow them with the status bulletin
export function RoundTab({
  view,
  setView,
  pairings,
  status,
}: {
  view: RoundView;
  setView: (v: RoundView) => void;
  pairings: React.ReactNode;
  status: React.ReactNode;
}) {
  return (
    <>
      <div className="segmented" role="tablist" aria-label="Fase del turno" onKeyDown={onTabListKeyDown}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'pairings'}
          tabIndex={view === 'pairings' ? 0 : -1}
          className={view === 'pairings' ? 'active' : ''}
          onClick={() => setView('pairings')}
        >
          1 · Accoppiamenti
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'status'}
          tabIndex={view === 'status' ? 0 : -1}
          className={view === 'status' ? 'active' : ''}
          onClick={() => setView('status')}
        >
          2 · Bollettino
        </button>
      </div>
      {view === 'pairings' ? pairings : status}
    </>
  );
}
