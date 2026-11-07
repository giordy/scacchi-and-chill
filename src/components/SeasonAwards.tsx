import React from 'react';
import { SeasonAward } from '../types';
import { playerHref, publicViewHref } from '../lib/routes';
import { PILLSBURY_ID } from '../lib/pillsbury';
import { awardEmoji } from '../lib/awards';
import { useNameOf } from './Names';

// Grid of the end-of-season awards, each winner linking to their player page
// Links to the games of an award: "vedi su Lichess", or "su Lichess: 1 · 2" when there are more (the
// same words as the records)
function GameLinks({ ids }: { ids?: string[] }) {
  if (!ids || ids.length === 0) return null;
  const link = (id: string, text: string) => (
    <a key={id} href={`https://lichess.org/${id}`} target="_blank" rel="noopener noreferrer">{text}</a>
  );
  if (ids.length === 1) return <> · {link(ids[0], 'vedi su Lichess')}</>;
  return (
    <>
      {' · su Lichess: '}
      {ids.map((id, i) => (
        <React.Fragment key={id}>
          {i > 0 && ' · '}
          {link(id, String(i + 1))}
        </React.Fragment>
      ))}
    </>
  );
}

// The Premio Pillsbury comes first and apart, in a card of its own; the light-hearted awards follow
export function SeasonAwards({ awards, compact = false }: { awards: SeasonAward[]; compact?: boolean }) {
  const nameOf = useNameOf();
  const winners = (a: SeasonAward) =>
    a.winners.map((w, i) => (
      <React.Fragment key={w.handle}>
        {i > 0 && (i === a.winners.length - 1 ? " e " : ", ")}
        <a href={playerHref(w.handle)}>{nameOf(w.handle, w.name)}</a>
      </React.Fragment>
    ));
  const main = awards.find((a) => a.id === PILLSBURY_ID);
  const others = awards.filter((a) => a !== main);
  // Inside a card (a past season): rows of a list, not cards in a card
  if (compact) {
    const row = (a: SeasonAward, className = "") => (
      <li key={a.id} className={className}>
        <span className="compact-emoji" aria-hidden="true">{awardEmoji(a)}</span>
        <span className="compact-body">
          <span>
            <strong>{a.title}</strong>: <span className="award-winners">{winners(a)}</span>
          </span>
          <span className="compact-sub">
            {a.detail}
            <GameLinks ids={a.games} />
          </span>
        </span>
      </li>
    );
    return (
      <ul className="compact-list">
        {main && row(main, "award-main-row")}
        {others.map((a) => row(a))}
      </ul>
    );
  }
  return (
    <>
      {main && (
        <div className="award-card award-main">
          <span className="award-emoji" aria-hidden="true">{main.emoji}</span>
          <div className="award-body">
            <h3 className="award-title">{main.title}</h3>
            <p className="award-winners">{winners(main)}</p>
            <p className="award-detail">{main.detail}</p>
            <p className="award-desc">
              {main.description}. <a href={publicViewHref("pillsbury")}>Perché si chiama così</a>
            </p>
          </div>
        </div>
      )}
      {main && others.length > 0 && <h3 className="awards-subheading">E poi, per sorridere</h3>}
      <ul className="awards-grid">
        {others.map((a) => (
          <li key={a.id} className="award-card">
            <span className="award-emoji" aria-hidden="true">{awardEmoji(a)}</span>
            <div className="award-body">
              <h3 className="award-title">{a.title}</h3>
              <p className="award-winners">{winners(a)}</p>
              <p className="award-detail">
                {a.detail}
                <GameLinks ids={a.games} />
              </p>
              <p className="award-desc">{a.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
