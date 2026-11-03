import React from 'react';
import { SeasonArchive } from '../types';
import { playerHref } from '../lib/routes';
import { SeasonAwards } from './SeasonAwards';

// Public "Torneo" tab, past seasons: final standings of every archived season, newest first
export function SeasonsHistory({ seasons }: { seasons: SeasonArchive[] }) {
  return (
    <div className="seasons-history">
      {seasons.map((s, i) => (
        <details key={s.id} className="season-card" open={i === 0}>
          <summary>
            <span className="season-name">{s.season}</span>
            {s.champion && <span className="season-champion">{s.champion.name}</span>}
          </summary>
          <p className="note note-sm">
            {s.title}
            {s.masterName ? ` · dedicata a ${s.masterName}` : ""} · {s.gamesPlayed} partite · archiviata il{" "}
            {new Date(s.archivedAt).toLocaleDateString("it-IT")}
          </p>
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col">Giocatore</th>
                  <th className="col-center">Punti</th>
                  <th className="col-center">G</th>
                  <th className="col-center">V</th>
                  <th className="col-center">N</th>
                  <th className="col-center">P</th>
                  <th className="col-center" title="Spareggio Sonneborn-Berger">SB</th>
                </tr>
              </thead>
              <tbody>
                {s.standings.map((p, idx) => (
                  <tr key={p.handle} className={idx === 0 && p.points > 0 ? "row-leader" : ""}>
                    <td className="col-rank"><span className="rank">{idx + 1}</span></td>
                    <td className="sticky-col">
                      <a href={playerHref(p.handle)} className="player-name player-page-link">{p.name}</a>
                    </td>
                    <td className="col-points">{p.points}</td>
                    <td className="col-center">{p.played}</td>
                    <td className="col-center">{p.won}</td>
                    <td className="col-center">{p.drawn}</td>
                    <td className="col-center">{p.lost}</td>
                    <td className="col-center stat-sb">{p.sb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.awards && s.awards.length > 0 && (
            <>
              <h3 className="rules-heading">Premi</h3>
              <SeasonAwards awards={s.awards} />
            </>
          )}
        </details>
      ))}
    </div>
  );
}
