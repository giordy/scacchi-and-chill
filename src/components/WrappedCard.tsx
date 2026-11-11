import React from 'react';
import { SeasonWrapped } from '../lib/wrapped';
import { CareerSeason } from '../lib/allTime';
import { playerHref } from '../lib/routes';
import { SeasonAward } from '../types';
import { awardEmoji, awardTitle } from '../lib/awards';

const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');
const pts = (n: number) => `${halves(n)} ${n === 1 ? 'punto' : 'punti'}`;
const OUTCOME = ['persa', 'patta', 'vinta'];

// Player page, at the end of a season: «La stagione in breve», one line per figure that says something
export function WrappedCard({
  season,
  wrapped,
  career,
  awards,
  nameOf,
}: {
  season: string;
  wrapped: SeasonWrapped;
  career?: CareerSeason; // place and players of that season
  awards: SeasonAward[]; // the season's awards this player won
  nameOf: (handle: string) => string;
}) {
  const w = wrapped;
  const vs = (handle: string) => <a href={playerHref(handle)}>{nameOf(handle)}</a>;
  const lines: { emoji: string; text: React.ReactNode }[] = [];
  lines.push({
    emoji: '🏁',
    text: (
      <>
        {career?.place ? <strong>{career.tied ? `${career.place}° a pari merito` : `${career.place}°`} su {career.of}</strong> : null}
        {career?.place ? ' con ' : ''}
        {pts(w.points)} · {w.won} V · {w.drawn} N · {w.lost} P
      </>
    ),
  });
  awards.forEach((a) => lines.push({ emoji: awardEmoji(a), text: <><strong>{awardTitle(a)}</strong> ({a.detail})</> }));
  if (w.winStreak) lines.push({ emoji: '🔥', text: <>{w.winStreak} vittorie di fila</> });
  if (w.unbeaten) lines.push({ emoji: '🛡️', text: <>{w.unbeaten} partite di fila senza perdere</> });
  if (w.upsets) lines.push({ emoji: '🗡️', text: <>{w.upsets === 1 ? 'Un colpaccio' : `${w.upsets} colpacci`} contro avversari molto più forti</> });
  if (w.favourite) lines.push({ emoji: '🍀', text: <>Il bersaglio preferito: {vs(w.favourite.opponent)} ({halves(w.favourite.scored)}–{halves(w.favourite.conceded)})</> });
  if (w.nemesis) lines.push({ emoji: '😈', text: <>L'avversario più duro: {vs(w.nemesis.opponent)} ({halves(w.nemesis.scored)}–{halves(w.nemesis.conceded)})</> });
  if (w.quickestWin) lines.push({ emoji: '⚡', text: <>La vittoria più rapida: {w.quickestWin.moves} mosse contro {vs(w.quickestWin.opponent)}</> });
  if (w.longest) lines.push({ emoji: '🐢', text: <>La partita più lunga: {w.longest.moves} mosse contro {vs(w.longest.opponent)}, {OUTCOME[w.longest.score * 2]}</> });
  if (w.opening) lines.push({ emoji: '📖', text: <>L'apertura più giocata: {w.opening.name} ({w.opening.games} partite)</> });
  if (w.elo) {
    const move = w.elo.end - w.elo.start;
    lines.push({ emoji: move >= 0 ? '📈' : '📉', text: <>Elo del torneo: {w.elo.start} → {w.elo.end} ({move >= 0 ? '+' : ''}{move})</> });
  }
  return (
    <section className="dossier-card wrapped-card">
      <h2 className="section-heading">La stagione in breve</h2>
      <p className="note note-sm">{season}</p>
      <ul className="wrapped-list">
        {lines.map((l, i) => (
          <li key={i}>
            <span className="wrapped-emoji" aria-hidden="true">{l.emoji}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
