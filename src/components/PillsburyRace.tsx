import React from 'react';
import { HistoryGame, LichessExportGame, Player, SeasonArchive } from '../types';
import { EloReport } from '../lib/tournamentElo';
import { FORM_GAMES, FORM_LABEL, FORM_MARK, PILLSBURY_EMOJI, PILLSBURY_ORIGIN, PILLSBURY_TITLE, pillsburyRace, reigningPillsbury } from '../lib/pillsbury';
import { playerHref } from '../lib/routes';
import { Trend, TrendKind } from './Trend';
import { InfoTip } from './InfoTip';
import { roundHalf } from '../lib/tournamentElo';

const TREND_LABEL: Record<TrendKind, string> = { up: "sopra l'obiettivo", same: "in linea con l'obiettivo", down: "sotto l'obiettivo" };

// 1.5 -> "1½", 0.5 -> "½"
const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');

// "Anna, Bruno e Carla"
const namesList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0] ?? '');

// Above the objective: by how much, in half points (good news only); in line or below: the arrow
// alone, no gap that would only discourage
function Progress({ trend, over }: { trend: TrendKind; over: number }) {
  const label = TREND_LABEL[trend];
  if (trend !== 'up') return <Trend kind={trend} label={label} />;
  return (
    <span className="progress-up">
      <Trend kind="up" label={label} /> +{halves(roundHalf(over))}
    </span>
  );
}

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
  calendar: HistoryGame[]; // the season's games, created and still to create
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  nameOf: (handle: string) => string;
}) {
  const race = pillsburyRace(players, elo, calendar, history, gameStates);
  const reigning = reigningPillsbury(seasons);
  // Forma: how the last games went; a tap says what it means
  const formCell = (handle: string) => {
    const f = race.form[handle];
    if (!f) return '';
    return (
      <InfoTip className="cell-tip" text={`Ultime ${FORM_GAMES} partite: ${FORM_LABEL[f]}`}>
        <span aria-hidden="true">{FORM_MARK[f]}</span>
        <span className="sr-only">Forma, ultime {FORM_GAMES} partite: {FORM_LABEL[f]}</span>
      </InfoTip>
    );
  };
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
      <td className="col-center col-form">{formCell(handle)}</td>
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
                  <th className="col-center" scope="col">Stato</th>
                  <th className="col-center" scope="col">Forma</th>
                </tr>
              </thead>
              <tbody>
                {race.rows.map((r, i) => row(r.handle, String(i + 1), <Progress trend={r.trend} over={r.over} />))}
                {race.waiting.map((h) => row(h, '–', <InfoTip className="cell-tip" text="Nessuna partita che conta, finora"><span aria-hidden="true">⏳</span><span className="sr-only">In attesa</span></InfoTip>))}
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
          Il <strong>{PILLSBURY_TITLE}</strong> {PILLSBURY_EMOJI} va a chi, a fine stagione, ha superato di più il proprio obiettivo di punti (lo trovate nel vostro profilo).
          {reigning && <> Detentore: {namesList(reigning.handles.map(nameOf))} ({reigning.season}).</>}
        </p>
        <p className="note note-top-xs">
          <strong>Perché Pillsbury.</strong> {PILLSBURY_ORIGIN}
        </p>
      </div>
    </section>
  );
}
