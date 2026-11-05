import React from 'react';
import { SeasonAward } from '../types';
import { playerHref } from '../lib/routes';

// Grid of the end-of-season awards, each winner linking to their player page
export function SeasonAwards({ awards }: { awards: SeasonAward[] }) {
  return (
    <ul className="awards-grid">
      {awards.map((a) => (
        <li key={a.id} className="award-card">
          <span className="award-emoji" aria-hidden="true">{a.emoji}</span>
          <div className="award-body">
            <h3 className="award-title">{a.title}</h3>
            <p className="award-winners">
              {a.winners.map((w, i) => (
                <React.Fragment key={w.handle}>
                  {i > 0 && (i === a.winners.length - 1 ? " e " : ", ")}
                  <a href={playerHref(w.handle)}>{w.name}</a>
                </React.Fragment>
              ))}
            </p>
            <p className="award-detail">{a.detail}</p>
            <p className="award-desc">{a.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
