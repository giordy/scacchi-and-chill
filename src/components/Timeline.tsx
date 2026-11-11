import { useMemo, useState } from 'react';
import { SeasonArchive } from '../types';
import { ActivityEvent, ActivityKind, archivedSeasonActivity, FRAME_KINDS, HIGHLIGHT_KINDS, isNewSince, newsSince } from '../lib/activity';
import { EloReport } from '../lib/tournamentElo';
import { playerHref } from '../lib/routes';

interface TimelineProps {
  season: string;
  events: ActivityEvent[]; // of the current season (see lib/activity.ts)
  lastVisit?: number; // when the visitor last opened the cronaca: what came after is marked
  seasons: SeasonArchive[];
  elo?: EloReport;
  nameOf: (handle: string) => string;
}

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// "martedì 10 novembre", with the year when it is not this one
function dayLabel(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const text = d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return text[0].toUpperCase() + text.slice(1);
}

// Three weights, so the eye finds what matters: the frame of the season (rounds, anecdotes) as a
// light line, results and withdrawals as cards, the moments worth telling as cards with their emoji
const levelOf = (kind: ActivityKind) => (FRAME_KINDS.has(kind) ? 'is-frame' : HIGHLIGHT_KINDS.has(kind) ? 'is-highlight' : 'is-card');

const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Public "Cronaca": what happened in the tournament, newest first and by day, read from the games
export function Timeline(props: TimelineProps) {
  const { season, seasons, elo, nameOf, lastVisit } = props;
  const archives = useMemo(() => [...seasons].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)), [seasons]);
  const [selected, setSelected] = useState<string>('current');
  const current = props.events;
  const archive = archives.find((a) => a.id === selected);
  const events = useMemo(() => (archive ? archivedSeasonActivity(archive, elo) : current), [archive, elo, current]);

  const days: { key: string; at: number; events: ActivityEvent[] }[] = [];
  events.forEach((e) => {
    const key = dayKey(e.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.events.push(e);
    else days.push({ key, at: e.at, events: [e] });
  });
  const fresh = archive ? 0 : newsSince(events, lastVisit).length;

  return (
    <div className="timeline">
      {archives.length > 0 && (
        <div className="filter-row">
          <label htmlFor="timeline-season">Stagione</label>
          <select id="timeline-season" className="filter-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="current">{season}</option>
            {archives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.season}
              </option>
            ))}
          </select>
        </div>
      )}

      {fresh > 0 && (
        <p className="timeline-fresh" role="status">
          {fresh === 1 ? '1 novità' : `${fresh} novità`} dalla tua ultima visita
        </p>
      )}

      {days.length === 0 ? (
        <p className="note">
          {archive
            ? 'Di questa stagione non sono rimaste le date delle partite.'
            : 'La cronaca comincia con il primo turno: qui comparirà tutto quello che succede.'}
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} className="timeline-day" aria-label={dayLabel(day.at)}>
            <h3 className="timeline-day-title">{dayLabel(day.at)}</h3>
            <ol className="timeline-list">
              {day.events.map((e) => (
                <li key={e.key} className={`timeline-item ${levelOf(e.kind)} is-${e.kind}${!archive && isNewSince(e, lastVisit) ? ' is-new' : ''}`}>
                  {HIGHLIGHT_KINDS.has(e.kind) && <span className="timeline-emoji" aria-hidden="true">{e.emoji}</span>}
                  <div className="timeline-body">
                    <p className="timeline-text">
                      {e.parts.map((p, i) =>
                        typeof p === 'string' ? (
                          <span key={i}>{p}</span>
                        ) : (
                          <a key={i} href={playerHref(p.handle)} className="player-page-link">
                            {nameOf(p.handle)}
                          </a>
                        )
                      )}
                    </p>
                    {(e.detail || e.tags) && (
                      <p className="timeline-detail">
                        {e.detail}
                        {e.tags?.map((t) => (
                          <span key={t} className="timeline-tag">{t}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  <span className="timeline-meta">
                    {e.score && <span className="timeline-score">{e.score}</span>}
                    <time dateTime={new Date(e.at).toISOString()}>{timeLabel(e.at)}</time>
                    {e.link && (
                      <a href={e.link.href} className="timeline-game-link">
                        {e.link.label}
                      </a>
                    )}
                    {e.gameId && (
                      <a href={`https://lichess.org/${e.gameId}`} target="_blank" rel="noopener noreferrer" className="timeline-game-link">
                        Partita
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
