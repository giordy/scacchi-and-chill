import React, { useMemo } from 'react';
import { HistoryGame, LichessExportGame, Player, SeasonArchive, Withdrawal } from '../types';
import { EloReport } from '../lib/tournamentElo';
import { objectiveReached, PILLSBURY_MIN_PLAYERS, PILLSBURY_ORIGIN, PILLSBURY_TITLE, pillsburyRace, pillsburyWinners, reigningPillsbury } from '../lib/pillsbury';
import { playerHref } from '../lib/routes';
import { Trend, TrendKind } from './Trend';
import { InfoTip } from './InfoTip';
import { PillsburyIcon } from './PillsburyIcon';
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

// Public view next to Classifica and Tabellone: the race for the Trofeo Pillsbury. Ordered by the
// points beyond those expected, weighed by how sure each objective is (PillsburyRow.score), but shown
// only with arrows and, above the objective, the half points: the gap below would only discourage.
export function PillsburyRace({
  players,
  elo,
  calendar,
  history,
  gameStates,
  withdrawals,
  seasons,
  nameOf,
  concluded = false,
}: {
  players: Player[];
  elo: EloReport;
  calendar: HistoryGame[]; // the season's games, created and still to create
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  withdrawals?: Withdrawal[]; // who left the season: out of the race
  seasons: SeasonArchive[];
  nameOf: (handle: string) => string;
  concluded?: boolean; // every game of the season played: the trophy is decided
}) {
  const race = useMemo(() => pillsburyRace(players, elo, calendar, history, gameStates, withdrawals), [players, elo, calendar, history, gameStates, withdrawals]);
  const reigning = reigningPillsbury(seasons);
  // Once the last game is over, who wins it (the same rule as the awards under the standings)
  const winners = concluded ? pillsburyWinners(race).map((r) => r.handle) : [];
  // The Elo is left out: it is the level, and the race is about going beyond it
  const row = (handle: string, rank: string, status: React.ReactNode, className = '') => (
    <tr key={handle} className={className}>
      <td className="col-rank"><span className="rank">{rank}</span></td>
      <td className="sticky-col">
        <div className="player-cell">
          <a href={playerHref(handle)} className="player-name player-page-link">{nameOf(handle)}</a>
          <span className="player-link">@{handle}</span>
          {/* Good news only, as the rest of the table: who already made the points of their objective */}
          {winners.includes(handle) && (
            <span className="pillsbury-winner">
              <PillsburyIcon /> {winners.length === 1 ? 'Vince il trofeo' : 'Vince il trofeo, a pari merito'}
            </span>
          )}
          {!winners.includes(handle) && race.forecasts[handle] && objectiveReached(race.forecasts[handle]) && (
            <span className="objective-reached">
              <span aria-hidden="true">🎯</span> Obiettivo raggiunto
            </span>
          )}
        </div>
      </td>
      <td className="col-center">
        {status}
        {/* How far the race is for them: the games that count, played of all */}
        {race.counted[handle] && (
          <span className="counted-games">
            {race.counted[handle].played} di {race.counted[handle].games}
          </span>
        )}
      </td>
    </tr>
  );
  const firstSeason = seasons.length === 0;

  return (
    <section aria-label={PILLSBURY_TITLE}>
      {firstSeason ? (
        <p className="note">Il trofeo parte dalla seconda stagione: nella prima sono tutti esordienti.</p>
      ) : race.suspended ? (
        <p className="note">
          Quest'anno il {PILLSBURY_TITLE} è sospeso: servono almeno {PILLSBURY_MIN_PLAYERS} giocatori in corsa, e gli esordienti non lo sono.
        </p>
      ) : (
        <>
          {concluded && (
            <p className="title-race" role="status">
              {winners.length > 0 ? (
                <>
                  🏁 <strong>Stagione conclusa:</strong> il {PILLSBURY_TITLE} va a {namesList(winners.map(nameOf))}.
                </>
              ) : (
                <>
                  🏁 <strong>Stagione conclusa:</strong> nessuno ha superato il proprio obiettivo di almeno mezzo punto, il trofeo non si assegna.
                </>
              )}
            </p>
          )}
          <div className="table-responsive">
            <table className="standings-table pillsbury-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col" scope="col">Giocatore</th>
                  <th className="col-center" scope="col">Stato</th>
                </tr>
              </thead>
              <tbody>
                {race.rows.map((r, i) => row(r.handle, String(i + 1), <Progress trend={r.trend} over={r.over} />, winners.includes(r.handle) ? 'row-leader' : ''))}
                {race.waiting.map((h) => row(h, '–', <InfoTip className="cell-tip" text="Nessuna partita che conta, finora"><span aria-hidden="true">⏳</span><span className="sr-only">In attesa</span></InfoTip>))}
              </tbody>
            </table>
          </div>
          {race.rows.length === 0 && <p className="note note-top-xs">La corsa parte con le prime partite concluse.</p>}
          {race.newcomers.length > 0 && (
            <p className="note note-top-xs">
              {namesList(race.newcomers.map(nameOf))} {race.newcomers.length === 1 ? "è esordiente: entra" : "sono esordienti: entrano"} in corsa dalla prossima stagione. Le partite con gli esordienti contano solo per la classifica.
            </p>
          )}
        </>
      )}
      <div className="pillsbury-about">
        <p className="note note-top-xs">
          Il <strong>{PILLSBURY_TITLE}</strong> <PillsburyIcon /> va a chi, a fine stagione, ha superato di più il proprio obiettivo di punti (lo trovate nel vostro profilo).
          {' '}Lo scarto si pesa con quanto è sicuro l'obiettivo: chi ha un Elo ancora incerto, come chi gioca la prima stagione, deve superarlo di più, perché una parte dello scarto può venire dall'Elo e non dalla sua stagione.
          {reigning && <> Detentore: {namesList(reigning.handles.map(nameOf))} ({reigning.season}).</>}
        </p>
        <p className="note note-top-xs">
          <strong>Perché Pillsbury.</strong> {PILLSBURY_ORIGIN}
        </p>
      </div>
    </section>
  );
}
