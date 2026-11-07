import React from 'react';
import { AllTimeRow, allTimeRanks, GameRecord } from '../lib/allTime';
import { playerHref } from '../lib/routes';
import { useNameOf } from './Names';
import { shortSeason } from '../lib/honours';

const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

// Public "Albo" tab: the table of every season added up, then the all-time records
export function AllTimeSection({ rows, records, gamesSince, title }: { rows: AllTimeRow[]; records: GameRecord[]; gamesSince?: string; title?: string }) {
  const ranks = allTimeRanks(rows);
  const nameOf = useNameOf();
  return (
    <>
      {rows.length > 0 && (
        <article className="dossier-card">
          <h2 className="section-heading">Classifica di sempre</h2>
          <p className="note note-sm">Tutte le stagioni sommate, compresa quella in corso. «Media» sono i punti per partita.</p>
          <div className="table-responsive is-flat">
            <table className="standings-table all-time-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col">Giocatore</th>
                  <th className="col-center">Punti</th>
                  <th className="col-center" title="Punti per partita">Media</th>
                  <th className="col-center" title="Stagioni giocate">Stag.</th>
                  <th className="col-center">G</th>
                  <th className="col-center">V</th>
                  <th className="col-center">N</th>
                  <th className="col-center">P</th>
                  <th className="col-center" title="Titoli vinti">🏆</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.handle}>
                    <td className="col-rank">{ranks[i]}</td>
                    <td className="sticky-col">
                      <a href={playerHref(r.handle)} className="player-name player-page-link">{nameOf(r.handle, r.name)}</a>
                    </td>
                    <td className="col-points">{fmt(r.points)}</td>
                    <td className="col-center">{(r.points / r.played).toFixed(2).replace(".", ",")}</td>
                    <td className="col-center">{r.seasons}</td>
                    <td className="col-center">{r.played}</td>
                    <td className="col-center">{r.won}</td>
                    <td className="col-center">{r.drawn}</td>
                    <td className="col-center">{r.lost}</td>
                    <td className="col-center">{r.titles || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {records.length > 0 && (
        <article className="dossier-card">
          <h2 className="section-heading">Record</h2>
          {gamesSince && <p className="note note-sm">Dalle partite registrate a partire da {shortSeason(gamesSince, title)}.</p>}
          <ul className="compact-list">
            {records.map((r) => (
              <li key={r.id}>
                <span className="compact-emoji" aria-hidden="true">{r.emoji}</span>
                <span className="compact-body">
                  <strong>{r.title}</strong>
                  <span>{r.detail}</span>
                  <span className="compact-sub">
                    {shortSeason(r.season, title)}
                    {r.url && (
                      <>
                        {" · "}
                        <a href={r.url} target="_blank" rel="noopener noreferrer">vedi su Lichess</a>
                      </>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </>
  );
}
