import React from 'react';
import { SeasonAward } from '../types';
import { playerHref } from '../lib/routes';
import { useNameOf } from './Names';

// Grid of the end-of-season awards, each winner linking to their player page
export function SeasonAwards({ awards, compact = false }: { awards: SeasonAward[]; compact?: boolean }) {
  const nameOf = useNameOf();
  const winners = (a: SeasonAward) =>
    a.winners.map((w, i) => (
      <React.Fragment key={w.handle}>
        {i > 0 && (i === a.winners.length - 1 ? " e " : ", ")}
        <a href={playerHref(w.handle)}>{nameOf(w.handle, w.name)}</a>
      </React.Fragment>
    ));
  // Inside a card (a past season): rows of a list, not cards in a card
  if (compact) {
    return (
      <ul className="compact-list">
        {awards.map((a) => (
          <li key={a.id}>
            <span className="compact-emoji" aria-hidden="true">{a.emoji}</span>
            <span className="compact-body">
              <span>
                <strong>{a.title}</strong>: <span className="award-winners">{winners(a)}</span>
              </span>
              <span className="compact-sub">{a.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="awards-grid">
      {awards.map((a) => (
        <li key={a.id} className="award-card">
          <span className="award-emoji" aria-hidden="true">{a.emoji}</span>
          <div className="award-body">
            <h3 className="award-title">{a.title}</h3>
            <p className="award-winners">{winners(a)}</p>
            <p className="award-detail">{a.detail}</p>
            <p className="award-desc">{a.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
