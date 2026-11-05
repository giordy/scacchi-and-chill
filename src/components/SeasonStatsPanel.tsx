import React from 'react';
import { SeasonStats } from '../lib/seasonStats';

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;
const one = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

// A few anonymous numbers of the season, in the Torneo tab
export function SeasonStatsPanel({ stats: s }: { stats: SeasonStats }) {
  const items: Array<[string, string]> = [
    ['Partite giocate', String(s.games)],
    ['Vinte dal bianco', pct(s.whiteWins, s.games)],
    ['Vinte dal nero', pct(s.blackWins, s.games)],
    ['Patte', pct(s.draws, s.games)],
    ['Chiuse col matto', String(s.mates)],
    ['Per abbandono', String(s.resigns)],
  ];
  if (s.timeouts > 0) items.push(['Per tempo', String(s.timeouts)]);
  if (s.avgMoves !== undefined) items.push(['Lunghezza media', `${Math.round(s.avgMoves)} mosse`]);
  if (s.avgDays !== undefined) items.push(['Durata media', `${one(s.avgDays)} ${s.avgDays === 1 ? 'giorno' : 'giorni'}`]);
  return (
    <section className="season-stats" aria-labelledby="season-stats-title">
      <h2 id="season-stats-title" className="section-heading">I numeri della stagione</h2>
      <div className="stat-pills">
        {items.map(([label, value]) => (
          <div key={label} className="stat-pill">
            <span className="stat-pill-label">{label}</span>
            <span className="stat-pill-val">{value}</span>
          </div>
        ))}
      </div>
      {s.topOpening && (
        <p className="note m-0">
          Apertura più giocata: <strong>{s.topOpening.name}</strong> ({s.topOpening.games} partite).
        </p>
      )}
    </section>
  );
}
