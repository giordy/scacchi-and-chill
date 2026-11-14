import React, { useState } from 'react';
import { AllTimeHeadToHead, CareerSeason } from '../lib/allTime';
import { podiumPlace } from '../lib/standings';
import { MEDAL_EMOJI } from '../lib/honours';
import { playerHref } from '../lib/routes';
import { useNameOf } from './Names';

const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

// Player page, in the Carriera: the seasons already concluded, newest first, with a short summary on
// top. The season being played is not here: it has the top of the page.
// highs: the career records under the summary (Elo massimo, colpaccio migliore), when there are any
// recaps: «La stagione in breve» of each season that has one, by season name: its row opens it
export function CareerSection({ career, highs, recaps = {} }: { career: CareerSeason[]; highs?: React.ReactNode; recaps?: Record<string, React.ReactNode> }) {
  const nameOf = useNameOf();
  const [open, setOpen] = useState<string | null>(null);
  const concluded = career.filter((c) => !c.current);
  const placed = concluded.filter((c) => c.place !== null);
  const best = placed.length > 0 ? Math.min(...placed.map((c) => c.place!)) : null;
  const played = concluded.reduce((n, c) => n + c.played, 0);
  const points = concluded.reduce((n, c) => n + c.points, 0);
  const summary = [
    concluded.length === 1 ? "1 stagione conclusa" : `${concluded.length} stagioni concluse`,
    `${played} ${played === 1 ? "partita" : "partite"}`,
    `${fmt(points)} ${points === 1 || points === 0.5 ? "punto" : "punti"}`,
    best !== null ? `miglior piazzamento ${best}°` : "",
  ].filter(Boolean);
  return (
    <section className="dossier-card">
      <h2 className="section-heading">{concluded.length > 0 ? "Stagioni concluse" : "Primati"}</h2>
      {concluded.length > 0 && <p className="note career-summary">{summary.join(" · ")}</p>}
      {highs}
      {concluded.length > 0 && (
        <ul className="career-list">
          {concluded.map((c) => {
            const medal = c.place !== null ? podiumPlace(c.place, c.points) : undefined;
            const recap = recaps[c.season];
            const isOpen = !!recap && open === c.season;
            const row = (
              <>
                <span className="career-season">{c.season}</span>
                <span className="career-place">
                  {medal && <span aria-hidden="true">{MEDAL_EMOJI[medal]} </span>}
                  {c.place === null ? "–" : `${c.place}° su ${c.of}`}
                  {c.tied && " (pari merito)"}
                </span>
                <span className="career-score">
                  {fmt(c.points)} pt · {c.won}V {c.drawn}N {c.lost}P
                  {c.replacing && ` · al posto di ${nameOf(c.replacing.handle, c.replacing.name)}`}
                  {c.replacedBy && ` · poi al suo posto ${nameOf(c.replacedBy.handle, c.replacedBy.name)}`}
                </span>
              </>
            );
            return (
              <li key={c.season} className="career-row">
                {recap ? (
                  <button type="button" className="career-row-main career-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.season)}>
                    {row}
                    <span className="career-chevron" aria-hidden="true">›</span>
                    <span className="sr-only">La stagione in breve</span>
                  </button>
                ) : (
                  <div className="career-row-main">{row}</div>
                )}
                {isOpen && <div className="career-recap">{recap}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Won / drawn / lost against one opponent, short and without the zeros: "3V 1P"
export function recordWords({ won, drawn, lost }: { won: number; drawn: number; lost: number }) {
  return [won > 0 ? `${won}V` : "", drawn > 0 ? `${drawn}N` : "", lost > 0 ? `${lost}P` : ""].filter(Boolean).join(" ");
}

// Player page: the record against every opponent ever met, across seasons
export function AllTimeHeadToHeadSection({ rows, nameOf, since }: { rows: AllTimeHeadToHead[]; nameOf: (h: string) => string; since?: string }) {
  return (
    <section className="dossier-card">
      <h2 className="section-heading">Scontri diretti di sempre</h2>
      {since && <p className="note note-sm">Dalle partite registrate a partire da {since}.</p>}
      <ul className="h2h-list">
        {rows.map((h) => (
          <li key={h.opponent} className="h2h-row">
            <a href={playerHref(h.opponent)} className="h2h-name">{nameOf(h.opponent)}</a>
            <span className="h2h-past-record">{recordWords(h)} <b>{fmt(h.scored)}–{fmt(h.conceded)}</b></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
