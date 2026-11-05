import React, { useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, Player, ScheduledMatch, TournamentMeta } from '../../types';
import { deleteGamesFromFirebase } from '../../firebaseService';
import { planWithdrawal, withdrawPlayer } from '../../lib/withdrawals';
import { errorMessage } from '../../lib/utils';
import { plural } from '../../lib/games';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// "la partita rimasta va" / "le 3 partite rimaste vanno"
const leftGo = (n: number) => (n === 1 ? "l'unica partita rimasta va" : `le ${n} partite rimaste vanno`);
const leftPlays = (n: number) => (n === 1 ? "l'unica partita rimasta" : `le ${n} partite rimaste`);

// Withdrawal of a player during the season, with the half rule of the "Ritiri" section of the
// rules, or with a substitute who takes the place
export function WithdrawalSection({
  config,
  history,
  setHistory,
  gameStates,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  config: AppConfig;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  gameStates: Record<string, LichessExportGame>;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const withdrawals = config.tournament?.withdrawals ?? [];
  const schedule = config.schedule ?? [];
  const [handle, setHandle] = useState('');
  const [withSub, setWithSub] = useState(false);
  // Exclusion for cheating: every game annulled, whatever the number played
  const [exclusion, setExclusion] = useState(false);
  const [subName, setSubName] = useState('');
  const [subHandle, setSubHandle] = useState('');
  const [busy, setBusy] = useState(false);

  // Players still playing: not already withdrawn with forfeits
  const active = config.players.filter((p) => !withdrawals.some((w) => w.mode === 'forfeit' && w.handle === p.handle));
  const player = active.find((p) => p.handle === handle);
  const basePlan = player ? planWithdrawal(player.handle, history, schedule, gameStates) : null;
  const plan = basePlan && exclusion && !withSub ? { ...basePlan, mode: 'annulled' as const } : basePlan;
  const openCreated = plan?.created.filter((g) => g.url).length ?? 0;

  const reset = () => {
    setHandle('');
    setWithSub(false);
    setExclusion(false);
    setSubName('');
    setSubHandle('');
  };

  const confirmWithdrawal = async () => {
    if (!player || !plan) return;
    let substitute: Player | undefined;
    if (withSub) {
      const h = subHandle.trim().toLowerCase();
      const n = subName.trim();
      if (!h || !n) return flash('err', 'Inserisci nome e nickname Lichess del nuovo giocatore.');
      if (config.players.some((p) => p.handle.toLowerCase() === h)) return flash('err', `${h} è già nel torneo.`);
      substitute = { handle: h, name: n };
    }
    const what = substitute
      ? `${substitute.name} prende il posto di ${player.name}: eredita i suoi punti e gioca ${leftPlays(plan.open.length)}.` +
        (openCreated > 0 ? `\n\n${plural(openCreated, 'partita già creata', 'partite già create')} su Lichess ${openCreated === 1 ? 'esce' : 'escono'} dal torneo e va ricreata per ${substitute.name} dal turno.` : '')
      : plan.mode === 'annulled'
      ? `${player.name} esce dal torneo e tutte le sue partite vengono annullate (ne ha giocate ${plan.played} su ${plan.total})${exclusion ? ', per fair play' : ''}.`
      : `${player.name} resta in classifica con i risultati ottenuti; ${leftGo(plan.open.length)} a tavolino agli avversari.`;
    if (!window.confirm(`${what}\n\nConfermi?`)) return;

    const changes = withdrawPlayer(player, plan, config.players, schedule, substitute);
    setBusy(true);
    try {
      if (changes.deleteGames.length > 0) {
        await deleteGamesFromFirebase(changes.deleteGames);
        setHistory((prev) => prev.filter((g) => !changes.deleteGames.includes(g)));
      }
      onUpdatePlayers(changes.players);
      onUpdateSchedule(changes.schedule);
      onUpdateTournamentMeta({ withdrawals: [...withdrawals, changes.withdrawal] });
      flash('ok', substitute ? `${substitute.name} subentra a ${player.name}.` : `Ritiro di ${player.name} registrato.`);
      reset();
    } catch (e) {
      flash('err', `Ritiro non registrato: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const undoLast = () => {
    const last = withdrawals[withdrawals.length - 1];
    if (!last?.undo) return;
    if (!window.confirm(`Annullare il ritiro di ${last.name}? Giocatori e calendario tornano com'erano prima del ritiro.`)) return;
    onUpdatePlayers(last.undo.players);
    onUpdateSchedule(last.undo.schedule);
    onUpdateTournamentMeta({ withdrawals: withdrawals.slice(0, -1) });
    flash('ok', `Ritiro di ${last.name} annullato.`);
  };

  const describe = (w: (typeof withdrawals)[number]) =>
    w.mode === 'replaced'
      ? `sostituito da ${w.replacedBy?.name ?? '?'}`
      : w.mode === 'annulled'
      ? `partite annullate (${w.played} giocate su ${w.total})`
      : `${plural(w.forfeits?.length ?? 0, 'partita', 'partite')} a tavolino (${w.played} giocate su ${w.total})`;

  return (
    <div className="subcard">
      <h4 className="subcard-title">Ritiri e sostituzioni</h4>
      <p className="note note-sm">
        Applica la regola della metà del regolamento: chi ha giocato meno di metà delle sue partite esce e tutte le sue
        partite vengono annullate; da metà in poi i risultati restano e le partite rimaste vanno a tavolino. Con un
        sostituto, il nuovo giocatore prende il suo posto con i punti già fatti.
      </p>

      {withdrawals.length > 0 && (
        <div className="item-list tight">
          {withdrawals.map((w, i) => (
            <div key={`${w.handle}-${i}`} className="list-row small">
              <div>
                <strong>{w.name}</strong> <span className="muted-sm">({w.handle})</span>: {describe(w)}
              </div>
              {i === withdrawals.length - 1 && w.undo && (
                <button type="button" className="secondary btn-mini" onClick={undoLast}>
                  Annulla
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="wd-player" className="label-sm">Giocatore che si ritira</label>
        <select id="wd-player" value={handle} onChange={(e) => setHandle(e.target.value)}>
          <option value="">Scegli…</option>
          {active.map((p) => (
            <option key={p.handle} value={p.handle}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {player && plan && (
        <>
          <p className="note">
            Ha giocato {plan.played} {plan.played === 1 ? 'partita' : 'partite'} su {plan.total}.{' '}
            {withSub
              ? `Il sostituto eredita punti e partite giocate, e gioca ${leftPlays(plan.open.length)}.`
              : exclusion
              ? 'Esclusione per fair play: esce dal torneo e tutte le sue partite vengono annullate, comunque ne abbia giocate.'
              : plan.mode === 'annulled'
              ? 'Meno di metà: esce dal torneo e tutte le sue partite vengono annullate.'
              : `Almeno metà: i risultati restano e ${leftGo(plan.open.length)} a tavolino agli avversari.`}
            {openCreated > 0 &&
              (withSub
                ? ` ${plural(openCreated, 'partita già creata', 'partite già create')} su Lichess ${openCreated === 1 ? 'esce' : 'escono'} dal torneo: si ricreano per il sostituto dal turno.`
                : ` Ha ${plural(openCreated, 'partita aperta', 'partite aperte')} su Lichess: chiedi ai giocatori di chiuderle.`)}
          </p>
          <div className="inline">
            <input
              id="wd-exclusion"
              type="checkbox"
              checked={exclusion}
              disabled={withSub}
              onChange={(e) => setExclusion(e.target.checked)}
            />
            <label htmlFor="wd-exclusion">Esclusione per fair play (annulla tutte le sue partite)</label>
          </div>
          <div className="inline">
            <input id="wd-sub" type="checkbox" checked={withSub} disabled={exclusion} onChange={(e) => setWithSub(e.target.checked)} />
            <label htmlFor="wd-sub">Al suo posto entra un nuovo giocatore</label>
          </div>
          {withSub && (
            <div className="add-form add-form-player">
              <div>
                <label htmlFor="wd-sub-name" className="label-sm">Nome WhatsApp</label>
                <input id="wd-sub-name" type="text" value={subName} onChange={(e) => setSubName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="wd-sub-handle" className="label-sm">Nickname Lichess</label>
                <input id="wd-sub-handle" type="text" value={subHandle} onChange={(e) => setSubHandle(e.target.value)} />
              </div>
            </div>
          )}
          <button type="button" className="danger" disabled={busy} onClick={confirmWithdrawal}>
            {withSub ? 'Registra la sostituzione' : 'Registra il ritiro'}
          </button>
        </>
      )}
    </div>
  );
}
