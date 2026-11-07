import React from 'react';
import { PodiumPlace, SeasonArchive, SeasonWinner } from '../types';
import { pastSeasonPeriod } from '../lib/period';
import { playerHref } from '../lib/routes';
import { SeasonAwards } from './SeasonAwards';
import { RankCell } from './RankCell';
import { isTied, seasonStarted, sharedRanks } from '../lib/standings';
import { departureText } from '../lib/departures';
import { fullPodium, MEDAL_EMOJI, podiumFromStandings, shortSeason } from '../lib/honours';
import { useNameOf } from './Names';
import { withAwardGames } from '../lib/awards';

interface PastSeason {
  season: string;
  winner?: SeasonWinner; // the hall of fame entry
  archive?: SeasonArchive; // the final table, when the season was archived
}

// Hall of fame entries and archived seasons, one per season name, newest first: by archive date, or
// by the months typed in the hall of fame, and in the order of the hall of fame otherwise
export function pastSeasons(seasons: SeasonArchive[], winners: SeasonWinner[] = []): PastSeason[] {
  const list: Array<PastSeason & { order: number }> = winners.map((w, i) => ({
    season: w.season,
    winner: w,
    archive: seasons.find((s) => s.season === w.season),
    order: i,
  }));
  seasons
    .filter((s) => !winners.some((w) => w.season === s.season))
    .forEach((s) => list.push({ season: s.season, archive: s, order: winners.length }));
  const when = (p: PastSeason) => p.archive?.archivedAt ?? p.winner?.end ?? p.winner?.start ?? '';
  return list
    .sort((a, b) => (when(a) && when(b) ? when(b).localeCompare(when(a)) : 0) || b.order - a.order)
    .map(({ order: _order, ...p }) => p);
}

// The podium of a past season: from the hall of fame, otherwise from the archived table
const podiumOf = ({ winner, archive }: PastSeason): PodiumPlace[] => {
  if (winner) return fullPodium(winner);
  if (!archive?.champion) return [];
  const { handle, name } = archive.champion;
  return [{ handle, name, place: 1 as const }, ...podiumFromStandings(archive.standings)];
};

// The final table of an archived season, the note on who left and the awards
function SeasonDetails({ archive }: { archive: SeasonArchive }) {
  const nameOf = useNameOf();
  // Shared places on a full tie, as in the live standings
  const ranks = sharedRanks(archive.standings);
  const started = seasonStarted(archive.standings);
  return (
    <div className="season-details">
      <p className="note note-sm">
        {archive.title}
        {archive.masterName ? ` · dedicata a ${archive.masterName}` : ''} · {archive.gamesPlayed} partite
      </p>
      <div className="table-responsive is-flat">
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
            {archive.standings.map((p, idx) => (
              <tr key={p.handle} className={ranks[idx] === 1 && p.points > 0 ? 'row-leader' : ''}>
                <td className="col-rank">
                  <RankCell rank={started ? ranks[idx] : null} points={p.points} tied={started && isTied(ranks, idx)} medals={false} />
                </td>
                <td className="sticky-col">
                  <a href={playerHref(p.handle)} className="player-name player-page-link">{nameOf(p.handle, p.name)}</a>
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
      {archive.departures?.map((d) => (
        <p key={d.handle} className="note note-sm season-departure">{departureText(d, nameOf)}</p>
      ))}
      {archive.awards && archive.awards.length > 0 && (
        <>
          <h3 className="rules-heading">Premi</h3>
          <SeasonAwards awards={withAwardGames(archive.awards, archive.games)} compact />
        </>
      )}
    </div>
  );
}

// Public "Albo" tab: the hall of fame, one short row per season (name, period, podium), newest first.
// An archived season opens on its final table, awards and withdrawals; only the latest is open.
export function SeasonsHistory({ seasons, winners = [], title }: { seasons: SeasonArchive[]; winners?: SeasonWinner[]; title?: string }) {
  const nameOf = useNameOf();
  const list = pastSeasons(seasons, winners);
  return (
    <ol className="winners-list">
      {list.map((p, i) => {
        const period = pastSeasonPeriod(p.winner, p.archive);
        const head = (
          <>
            {/* The season is the heading of its entry; the tournament's name is already the page's */}
            <span className="winner-season">
              <span className="winner-season-name">{shortSeason(p.season, title)}</span>
              {period && <span className="winner-period">{period}</span>}
            </span>
            <span className="winner-podium">
              {podiumOf(p).map((x) => (
                <span key={x.handle} className={`podium-place podium-place-${x.place}`}>
                  <span className="podium-medal" aria-label={`${x.place}° posto`}>{MEDAL_EMOJI[x.place]}</span>
                  <a href={playerHref(x.handle)}>{nameOf(x.handle, x.name)}</a>
                </span>
              ))}
            </span>
            {p.winner?.notes && <span className="winner-notes">{p.winner.notes}</span>}
          </>
        );
        return (
          <li key={p.season} className="winner-row">
            {p.archive ? (
              <details className="season-entry" open={i === 0}>
                <summary>
                  {head}
                  <span className="season-more">Classifica finale e premi</span>
                </summary>
                <SeasonDetails archive={p.archive} />
              </details>
            ) : (
              head
            )}
          </li>
        );
      })}
    </ol>
  );
}
