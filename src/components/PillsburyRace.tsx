import React from 'react';
import { HistoryGame, LichessExportGame, Player, SeasonArchive } from '../types';
import { EloReport } from '../lib/tournamentElo';
import { PILLSBURY_EMOJI, PILLSBURY_ORIGIN, PILLSBURY_TITLE, pillsburyRace, reigningPillsbury } from '../lib/pillsbury';
import { playerHref } from '../lib/routes';
import { Trend, TrendKind } from './Trend';

const TREND_LABEL: Record<TrendKind, string> = { up: 'sopra il pronostico', same: 'in linea col pronostico', down: 'sotto il pronostico' };

// "Anna, Bruno e Carla"
const namesList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0] ?? '');

// Public view next to Classifica and Tabellone: the race for the Premio Pillsbury. Ordered by the
// points beyond those expected, but shown only with arrows: the gap in points would only discourage.
export function PillsburyRace({
  players,
  elo,
  calendar,
  history,
  gameStates,
  seasons,
  nameOf,
}: {
  players: Player[];
  elo: EloReport;
  calendar: { white: string; black: string }[];
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  nameOf: (handle: string) => string;
}) {
  const race = pillsburyRace(players, elo, calendar, history, gameStates);
  const reigning = reigningPillsbury(seasons);
  // The Elo is left out: it is the level, and the race is about going beyond it
  const row = (handle: string, rank: string, status: React.ReactNode, className = '') => (
    <tr key={handle} className={className}>
      <td className="col-rank"><span className="rank">{rank}</span></td>
      <td className="sticky-col">
        <div className="player-cell">
          <a href={playerHref(handle)} className="player-name player-page-link">{nameOf(handle)}</a>
          <span className="player-link">@{handle}</span>
        </div>
      </td>
      <td className="col-center">{status}</td>
    </tr>
  );
  const firstSeason = seasons.length === 0;

  return (
    <section aria-label={PILLSBURY_TITLE}>
      {firstSeason ? (
        <p className="note">Il premio parte dalla seconda stagione: nella prima sono tutti esordienti.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="standings-table pillsbury-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col" scope="col">Giocatore</th>
                  <th className="col-center" scope="col">Rispetto al pronostico</th>
                </tr>
              </thead>
              <tbody>
                {race.rows.map((r, i) => row(r.handle, String(i + 1), <Trend kind={r.trend} label={TREND_LABEL[r.trend]} />))}
                {race.waiting.map((h) => row(h, '–', '–'))}
                {race.newcomers.map((h) => row(h, '', <span className="newcomer-label">Esordiente</span>, 'is-newcomer'))}
              </tbody>
            </table>
          </div>
          {race.rows.length === 0 && <p className="note note-top-xs">La corsa parte con le prime partite concluse.</p>}
          {race.newcomers.length > 0 && (
            <p className="note note-top-xs">Gli esordienti entrano in corsa dalla prossima stagione.</p>
          )}
        </>
      )}
      <div className="pillsbury-about">
        <p className="note note-top-xs">
          Il <strong>{PILLSBURY_TITLE}</strong> {PILLSBURY_EMOJI} va a chi, a fine stagione, ha fatto più punti del previsto. ▲ sopra il previsto · = in
          linea · ▼ sotto.
          {reigning && <> Detentore: {namesList(reigning.handles.map(nameOf))} ({reigning.season}).</>}
        </p>
        <p className="note note-top-xs">
          <strong>Perché Pillsbury.</strong> {PILLSBURY_ORIGIN}
        </p>
      </div>
    </section>
  );
}
