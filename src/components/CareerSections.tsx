import React from 'react';
import { AllTimeHeadToHead, CareerSeason } from '../lib/allTime';
import { podiumPlace } from '../lib/standings';
import { MEDAL_EMOJI } from '../lib/honours';
import { playerHref } from '../lib/routes';

const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

// Player page: every season they played, newest first, with a short summary on top
export function CareerSection({ career }: { career: CareerSeason[] }) {
  const finished = career.filter((c) => !c.current && c.place !== null);
  const best = finished.length > 0 ? Math.min(...finished.map((c) => c.place!)) : null;
  const played = career.reduce((n, c) => n + c.played, 0);
  const points = career.reduce((n, c) => n + c.points, 0);
  const summary = [
    `${career.length} ${career.length === 1 ? "stagione" : "stagioni"}`,
    `${played} ${played === 1 ? "partita" : "partite"}`,
    `${fmt(points)} ${points === 1 || points === 0.5 ? "punto" : "punti"}`,
    best !== null ? `miglior piazzamento ${best}°` : "",
  ].filter(Boolean);
  return (
    <section className="dossier-card">
      <h2 className="section-heading">Carriera</h2>
      <p className="note career-summary">{summary.join(" · ")}</p>
      <ul className="career-list">
        {career.map((c) => {
          const medal = c.place !== null && !c.current ? podiumPlace(c.place, c.points) : undefined;
          return (
            <li key={c.season} className="career-row">
              <span className="career-season">{c.season}</span>
              <span className="career-place">
                {medal && <span aria-hidden="true">{MEDAL_EMOJI[medal]} </span>}
                {c.place === null ? "–" : `${c.place}° su ${c.of}`}
                {c.tied && " (pari merito)"}
                {c.current && <span className="career-current"> · in corso</span>}
              </span>
              <span className="career-score">
                {fmt(c.points)} pt · {c.won}V {c.drawn}N {c.lost}P
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
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
            <span className="h2h-games">
              <span className="status-badge win">{h.won} V</span>
              <span className="status-badge draw">{h.drawn} N</span>
              <span className="status-badge loss">{h.lost} P</span>
            </span>
            <span className="h2h-score" aria-label={`Punteggio ${fmt(h.scored)} a ${fmt(h.conceded)}`}>
              {fmt(h.scored)} – {fmt(h.conceded)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
