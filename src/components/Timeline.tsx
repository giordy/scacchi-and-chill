import { useEffect, useMemo, useState } from 'react';
import { HistoryGame, LichessExportGame, MasterAnecdote, Player, ScheduledMatch, SeasonArchive, Withdrawal } from '../types';
import { ActivityEvent, archivedSeasonActivity, currentSeasonActivity, isNewSince } from '../lib/activity';
import { EloReport } from '../lib/tournamentElo';
import { playerHref } from '../lib/routes';

interface TimelineProps {
  season: string;
  masterName?: string;
  masterOpening?: string;
  masterAnecdotes?: MasterAnecdote[];
  players: Player[];
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  schedule?: ScheduledMatch[];
  withdrawals?: Withdrawal[];
  seasons: SeasonArchive[];
  elo?: EloReport;
  nameOf: (handle: string) => string;
}

const LAST_VISIT_KEY = 'scacchi-cronaca-visita';

// When the visitor last opened the cronaca (before this visit), to mark what is new; the time of
// this visit is saved for the next one. Nothing when the browser keeps no data.
function useLastVisit(): number | undefined {
  const [last] = useState<number | undefined>(() => {
    try {
      const n = Number(localStorage.getItem(LAST_VISIT_KEY));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
      return undefined;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);
  return last;
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

const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Public "Cronaca": what happened in the tournament, newest first and by day, read from the games
export function Timeline(props: TimelineProps) {
  const { season, seasons, elo, nameOf } = props;
  const lastVisit = useLastVisit();
  const archives = useMemo(() => [...seasons].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)), [seasons]);
  const [selected, setSelected] = useState<string>('current');

  const current = useMemo(
    () =>
      currentSeasonActivity({
        season,
        masterName: props.masterName,
        masterOpening: props.masterOpening,
        players: props.players,
        history: props.history,
        gameStates: props.gameStates,
        schedule: props.schedule,
        withdrawals: props.withdrawals,
        masterAnecdotes: props.masterAnecdotes,
        elo,
      }),
    [season, props.masterName, props.masterOpening, props.masterAnecdotes, props.players, props.history, props.gameStates, props.schedule, props.withdrawals, elo]
  );
  const archive = archives.find((a) => a.id === selected);
  const events = useMemo(() => (archive ? archivedSeasonActivity(archive, elo) : current), [archive, elo, current]);

  const days: { key: string; at: number; events: ActivityEvent[] }[] = [];
  events.forEach((e) => {
    const key = dayKey(e.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.events.push(e);
    else days.push({ key, at: e.at, events: [e] });
  });
  const fresh = archive ? 0 : events.filter((e) => isNewSince(e, lastVisit)).length;

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
                <li key={e.key} className={`timeline-item is-${e.kind}${!archive && isNewSince(e, lastVisit) ? ' is-new' : ''}`}>
                  <span className="timeline-emoji" aria-hidden="true">{e.emoji}</span>
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
