import React from 'react';
import { HistoryGame, LichessExportGame, Player, SeasonArchive } from '../types';
import { EloReport, currentSeason, ratingOf } from '../lib/tournamentElo';
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
  const season = currentSeason(elo);
  const reigning = reigningPillsbury(seasons);
  const eloCell = (handle: string) => {
    const now = ratingOf(elo, handle);
    const start = season.start.get(handle.toLowerCase());
    if (now === undefined) return '–';
    const move = start === undefined ? 0 : now - Math.round(start);
    const kind: TrendKind = move > 0 ? 'up' : move < 0 ? 'down' : 'same';
    return (
      <>
        {now} <Trend kind={kind} label={move === 0 ? 'come a inizio stagione' : `${move > 0 ? '+' : '−'}${Math.abs(move)} da inizio stagione`} />
      </>
    );
  };
  const row = (handle: string, rank: string, trend?: TrendKind) => (
    <tr key={handle}>
      <td className="col-rank"><span className="rank">{rank}</span></td>
      <td className="sticky-col">
        <div className="player-cell">
          <a href={playerHref(handle)} className="player-name player-page-link">{nameOf(handle)}</a>
          <span className="player-link">@{handle}</span>
        </div>
      </td>
      <td className="col-center nowrap">{eloCell(handle)}</td>
      <td className="col-center">{trend ? <Trend kind={trend} label={TREND_LABEL[trend]} /> : '–'}</td>
    </tr>
  );
  const firstSeason = seasons.length === 0;

  return (
    <section aria-label={PILLSBURY_TITLE}>
      <article className="dossier-card pillsbury-intro">
        <h2 className="section-heading">
          <span aria-hidden="true">{PILLSBURY_EMOJI}</span> {PILLSBURY_TITLE}
        </h2>
        <p>
          Va a chi, a fine stagione, ha superato di più il proprio <strong>pronostico</strong>: i punti che ci si aspettava facesse,
          dall'Elo del torneo suo e dei suoi avversari a inizio stagione. Qui sotto la corsa: ▲ sopra il previsto, = in linea, ▼ sotto.
        </p>
        <p className="pillsbury-origin">
          <strong>Perché Pillsbury.</strong> {PILLSBURY_ORIGIN}
        </p>
        {reigning && (
          <p className="note note-flush">
            Detentore: {namesList(reigning.handles.map(nameOf))} ({reigning.season}).
          </p>
        )}
      </article>

      {firstSeason ? (
        <p className="note">Il premio parte dalla seconda stagione: nella prima sono tutti esordienti, e il livello di nessuno si conosce ancora.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="standings-table pillsbury-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col" scope="col">Giocatore</th>
                  <th className="col-center" scope="col">Elo</th>
                  <th className="col-center" scope="col">Pronostico</th>
                </tr>
              </thead>
              <tbody>
                {race.rows.map((r, i) => row(r.handle, String(i + 1), r.trend))}
                {race.waiting.map((h) => row(h, '–'))}
              </tbody>
            </table>
          </div>
          {race.rows.length === 0 && <p className="note note-top-xs">La corsa parte con le prime partite concluse.</p>}
          {race.newcomers.length > 0 && (
            <p className="note note-top-xs">
              {race.newcomers.length === 1 ? 'Esordiente' : 'Esordienti'}, fuori dalla corsa per questa stagione:{' '}
              {namesList(race.newcomers.map(nameOf))}. Il loro livello si conosce dalla prossima; intanto le partite contro di loro contano solo per la classifica.
            </p>
          )}
        </>
      )}
    </section>
  );
}
