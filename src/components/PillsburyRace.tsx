import React, { useMemo } from 'react';
import { HistoryGame, LichessExportGame, Player, SeasonArchive, Withdrawal } from '../types';
import { EloReport } from '../lib/tournamentElo';
import { objectiveReached, PILLSBURY_MIN_PLAYERS, PILLSBURY_ORIGIN, PILLSBURY_TITLE, pillsburyRace, pillsburyWinners, projectedPoints, reigningPillsbury } from '../lib/pillsbury';
import { playerHref } from '../lib/routes';
import { Trend, TrendKind } from './Trend';
import { InfoTip } from './InfoTip';
import { PillsburyIcon } from './PillsburyIcon';
import { pronosticoPoints } from '../lib/tournamentElo';
import { computeStandings } from '../lib/standings';

const TREND_LABEL: Record<TrendKind, string> = { up: "sopra l'obiettivo", same: "in linea con l'obiettivo", down: "sotto l'obiettivo" };

// 1.5 -> "1½", 0.5 -> "½"
const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');

// "Anna, Bruno e Carla"
const namesList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0] ?? '');

// The ritmo: the points at the end of the season at this pace, with the arrow against the objective.
// Below the objective the arrow alone: how far behind would only discourage
function Pace({ trend, points }: { trend: TrendKind; points: number }) {
  return (
    <span className={`pace pace-${trend}`}>
      <Trend kind={trend} label={TREND_LABEL[trend]} />
      {trend !== 'down' && <> {halves(points)}</>}
    </span>
  );
}

// Public view next to Classifica and Tabellone: the race for the Trofeo Pillsbury. For each player
// the points made, the objective and the ritmo (the points at the end at this pace); ordered by the
// points beyond those expected, weighed by how sure each objective is (PillsburyRow.score). Ranked
// from the first game, as the standings: early on the order is mostly luck, and that is fine.
export function PillsburyRace({
  players,
  elo,
  calendar,
  history,
  gameStates,
  withdrawals,
  fairPlayBan,
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
  fairPlayBan?: boolean; // TournamentMeta.fairPlayAwardsBan
  seasons: SeasonArchive[];
  nameOf: (handle: string) => string;
  concluded?: boolean; // every game of the season played: the trophy is decided
}) {
  const race = useMemo(() => pillsburyRace(players, elo, calendar, history, gameStates, withdrawals, fairPlayBan), [players, elo, calendar, history, gameStates, withdrawals, fairPlayBan]);
  const reigning = reigningPillsbury(seasons);
  // Once the last game is over, who wins it (the same rule as the awards under the standings)
  const winners = concluded ? pillsburyWinners(race).map((r) => r.handle) : [];
  // The points of the standings, to mark who has a different count here (games that do not count)
  const standingPoints = useMemo(
    () => new Map(computeStandings(players, history, gameStates).standings.map((r) => [r.handle.toLowerCase(), r.points])),
    [players, history, gameStates]
  );
  const differs = (handle: string) => {
    const f = race.forecasts[handle];
    const p = standingPoints.get(handle.toLowerCase());
    return !!f && p !== undefined && p !== f.points;
  };
  const anyDiffers = [...race.rows.map((r) => r.handle), ...race.waiting].some(differs);
  // The Elo is left out: it is the level, and the race is about going beyond it
  const row = (handle: string, rank: string, className = '') => {
    const f = race.forecasts[handle];
    const counted = race.counted[handle];
    const r = race.rows.find((x) => x.handle === handle);
    return (
      <tr key={handle} className={className}>
        <td className="col-rank"><span className="rank">{rank}</span></td>
        <td className="sticky-col">
          <div className="player-cell">
            <a href={playerHref(handle)} className="player-name player-page-link">{nameOf(handle)}</a>
            {winners.includes(handle) && (
              <span className="pillsbury-winner">
                <PillsburyIcon /> {winners.length === 1 ? 'Vince il trofeo' : 'Vince il trofeo, a pari merito'}
              </span>
            )}
            {!winners.includes(handle) && f && objectiveReached(f) && (
              <span className="objective-reached">
                <span aria-hidden="true">🎯</span> Obiettivo raggiunto
              </span>
            )}
          </div>
        </td>
        <td className="col-center">
          <span className="pillsbury-points">
            {f ? halves(f.points) : '–'}
            {differs(handle) && <span className="points-mark" aria-label=", diversi dalla classifica">*</span>}
          </span>
          {counted && (
            <span className="counted-games">
              {counted.played} di {counted.games}
            </span>
          )}
        </td>
        <td className="col-center">{f ? halves(pronosticoPoints(f)) : '–'}</td>
        <td className="col-center">{r && f ? <Pace trend={r.trend} points={projectedPoints(f)} /> : <span className="muted">–</span>}</td>
      </tr>
    );
  };
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
                  <th className="col-center" scope="col">
                    <InfoTip className="cell-tip th-tip" text="I punti fatti nelle partite che contano per il trofeo, e quante ne ha giocate">Punti</InfoTip>
                  </th>
                  <th className="col-center" scope="col">
                    <InfoTip className="cell-tip th-tip" text="I punti previsti dall'Elo del torneo a inizio stagione, contro il suo calendario">Obiettivo</InfoTip>
                  </th>
                  <th className="col-center" scope="col">
                    <InfoTip className="cell-tip th-tip" text="I punti a fine stagione se da qui in poi ogni partita va come prevede l'Elo. ▲ sopra l'obiettivo, ▼ sotto">Ritmo</InfoTip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {race.rows.map((r, i) => row(r.handle, String(i + 1), winners.includes(r.handle) ? 'row-leader' : ''))}
                {race.waiting.map((h) => row(h, '–'))}
              </tbody>
            </table>
          </div>
          {anyDiffers && (
            <p className="note note-top-xs">
              * Punti diversi dalla classifica: per il trofeo non contano le partite decise a tavolino (ritiri, chiusure per scorrettezza) né quelle con gli esordienti.
            </p>
          )}
          {race.rows.length === 0 && <p className="note note-top-xs">La corsa parte con le prime partite concluse.</p>}
          {race.newcomers.length > 0 && (
            <p className="note note-top-xs">
              {namesList(race.newcomers.map(nameOf))} {race.newcomers.length === 1 ? "è esordiente: entra" : "sono esordienti: entrano"} in corsa dalla prossima stagione. Le partite con gli esordienti contano solo per la classifica.
            </p>
          )}
        </>
      )}
      <p className="note note-top-xs">
        Il <strong>{PILLSBURY_TITLE}</strong> <PillsburyIcon /> va a chi chiude la stagione più sopra il proprio obiettivo, di almeno mezzo punto.
        {reigning && <> Detentore: {namesList(reigning.handles.map(nameOf))} ({reigning.season}).</>}
      </p>
      <details className="pillsbury-about">
        <summary>Come funziona</summary>
        <p className="note note-top-xs">
          L'obiettivo è fisso per la stagione e lo trovate anche nel vostro profilo. La graduatoria pesa lo scarto con quanto è sicuro l'obiettivo: chi ha un Elo ancora incerto, come chi gioca la prima stagione, deve superarlo di più, perché una parte dello scarto può venire dall'Elo e non dalla sua stagione. Le partite con gli esordienti e quelle decise a tavolino non contano.
        </p>
        <p className="note note-top-xs">
          <strong>Perché Pillsbury.</strong> {PILLSBURY_ORIGIN}
        </p>
      </details>
    </section>
  );
}
