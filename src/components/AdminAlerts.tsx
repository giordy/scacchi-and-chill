import React from 'react';
import { AdminAlert, alertsBadge, isInfo, isUrgent } from '../lib/adminAlerts';
import { tokenWarning } from '../lib/tokenCheck';
import { formatRoundEnd, waitText } from '../lib/roundDeadline';
import { overdueDaysOf } from '../lib/overdue';
import { SYNC_WORKFLOW_URL } from '../lib/syncHealth';
import { TournamentMeta } from '../types';
import { AutoSyncAlert } from './AutoSyncStatus';
import { FairPlayAlert } from './FairPlayAlert';

export const ALERTS_PANEL_ID = 'avvisi-panel';

// The 🔔 in the header of the organizer area: how many alerts are open, red when one is urgent
export function AlertsBell({ alerts, open, onToggle }: { alerts: AdminAlert[]; open: boolean; onToggle: () => void }) {
  const { count, urgent } = alertsBadge(alerts);
  return (
    <button
      type="button"
      className={`chip-link alerts-bell${open ? ' is-active' : ''}`}
      aria-expanded={open}
      aria-controls={ALERTS_PANEL_ID}
      aria-label={count === 0 ? 'Avvisi: nessuno' : `Avvisi: ${count}${urgent ? ', urgenti' : ''}`}
      title="Avvisi"
      onClick={onToggle}
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 && (
        <span className={`alerts-count${urgent ? ' is-urgent' : ''}`} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}

export interface AlertActions {
  openRound: (round: string) => void;
  openToken: () => void;
  // Fair play: the first cases acknowledged
  fairPlaySeen: string[];
  onFairPlaySeen: (ids: string[]) => void;
}

// The list behind the bell: each alert with where to act
export function AlertsPanel({
  alerts,
  actions,
  nameOf,
  meta,
  now = Date.now(),
}: {
  alerts: AdminAlert[];
  actions: AlertActions;
  nameOf: (handle: string) => string;
  meta?: TournamentMeta;
  now?: number;
}) {
  return (
    <section className="panel alerts-panel mb-14" id={ALERTS_PANEL_ID} aria-label="Avvisi">
      <h2 className="panel-title">🔔 Avvisi</h2>
      {alerts.length === 0 ? (
        <p className="note note-flush">Nessun avviso: tutto in ordine.</p>
      ) : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.kind} className={`alert-item${isUrgent(a) ? ' is-urgent' : isInfo(a) ? ' is-info' : ''}`}>
              <AlertBody alert={a} actions={actions} nameOf={nameOf} meta={meta} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OpenRound({ round, label = 'Apri il turno', onOpen }: { round: string; label?: string; onOpen: (round: string) => void }) {
  return (
    <button type="button" className="link-muted" onClick={() => onOpen(round)}>
      {label}
    </button>
  );
}

function AlertBody({
  alert: a,
  actions,
  nameOf,
  meta,
  now,
}: {
  alert: AdminAlert;
  actions: AlertActions;
  nameOf: (handle: string) => string;
  meta?: TournamentMeta;
  now: number;
}) {
  const pair = (g: { white: string; black: string }) => `${nameOf(g.white)} – ${nameOf(g.black)}`;
  switch (a.kind) {
    case 'token':
      return (
        <>
          🔑 {tokenWarning(a.check)}{' '}
          <button type="button" className="link-muted" onClick={actions.openToken}>
            Vai al token
          </button>
        </>
      );
    case 'sync':
      return (
        <>
          <AutoSyncAlert health={a.health} now={now} />{' '}
          <a href={SYNC_WORKFLOW_URL} target="_blank" rel="noopener noreferrer">
            Apri su GitHub ↗
          </a>
        </>
      );
    case 'fairPlay':
      return <FairPlayAlert cases={a.cases} seen={actions.fairPlaySeen} onSeen={actions.onFairPlaySeen} nameOf={nameOf} awardsBan={meta?.fairPlayAwardsBan} />;
    case 'staleLinks':
      return (
        <>
          🔗 {a.links.length === 1 ? 'Una sfida è da rifare:' : `${a.links.length} sfide sono da rifare:`}
          <ul>
            {a.links.map(({ game, kind }) => (
              <li key={`${game.round}|${game.white}|${game.black}`}>
                {pair(game)} (Turno {game.round}): {kind === 'expired' ? 'scaduta senza essere accettata' : 'annullata su Lichess'}{' '}
                <OpenRound round={game.round} onOpen={actions.openRound} />
              </li>
            ))}
          </ul>
          Nel turno, 🔁 accanto alla partita crea un nuovo link e prepara il messaggio per i due giocatori.
        </>
      );
    case 'overdue':
      return (
        <>
          ⏰ {a.games.length === 1 ? 'Una partita è andata' : `${a.games.length} partite sono andate`} oltre i {overdueDaysOf(meta)} giorni
          dall'inizio del turno:
          <ul>
            {a.games.map(({ game, limit }) => (
              <li key={`${game.round}|${game.white}|${game.black}`}>
                {pair(game)} (Turno {game.round}, limite {formatRoundEnd(limit)}) <OpenRound round={game.round} onOpen={actions.openRound} />
              </li>
            ))}
          </ul>
          Parla con i giocatori: se non si accordano, puoi registrare tu il risultato dalla partita (⚖️).
        </>
      );
    case 'round': {
      const e = a.expired;
      if (e.waitReason) {
        return (
          <>
            🗓️ Il Turno {e.round} si è chiuso {formatRoundEnd(e.end)}. {e.waitReason === 'final' ? 'Siamo alle ultime giornate: il' : 'Il'} Turno{' '}
            {e.next} parte {waitText({ reason: e.waitReason, count: e.waitFor.length })}.
          </>
        );
      }
      return (
        <>
          🗓️ Il Turno {e.round} è scaduto {formatRoundEnd(e.end)}: puoi creare il Turno {e.next}.{' '}
          {e.open.length === 0
            ? 'Le sue partite sono tutte concluse.'
            : `${e.open.length === 1 ? 'Continua' : 'Continuano'} accanto al nuovo turno: ${e.open.map(pair).join(', ')}.`}{' '}
          <OpenRound round={e.next} label={`Apri il Turno ${e.next}`} onOpen={actions.openRound} />
        </>
      );
    }
  }
}
