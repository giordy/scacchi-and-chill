import { useState } from 'react';
import { HistoryGame, Player, ScheduledMatch } from '../../types';
import { roundRobin, shuffled } from '../../lib/roundRobin';
import { completeSchedule } from '../../lib/completeSchedule';

// Automatic round robin: generate the whole season or complete the rounds that are missing
export function GeneratorSection({
  players,
  schedule,
  played,
  flash,
  onUpdateSchedule,
}: {
  players: Player[];
  // Games already created on Lichess this season: completing keeps them, regenerating ignores them
  played: HistoryGame[];
  schedule?: ScheduledMatch[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const scheduleList = schedule ?? [];
  const [doubleRound, setDoubleRound] = useState(false);

  const hasGames = played.length > 0;
  // What is already planned or played: the starting point for "Completa i turni mancanti"
  const existing: ScheduledMatch[] = [
    ...scheduleList,
    ...played.map((g) => ({ round: g.round, white: g.white, black: g.black })),
  ];
  const existingRounds = new Set(existing.map((m) => m.round)).size;

  const complete = () => {
    const res = completeSchedule(
      players.map((p) => p.handle),
      existing,
      { double: doubleRound }
    );
    if (!res.ok) {
      flash("err", res.reason);
      return;
    }
    if (res.added.length === 0) {
      flash("ok", "Il girone è già completo: non mancano turni.");
      return;
    }
    if (
      !window.confirm(
        `Aggiungere ${res.added.length} partite${res.newRounds.length ? ` in ${res.newRounds.length} turni nuovi (${res.newRounds[0]}–${res.newRounds[res.newRounds.length - 1]})` : ""}?\n\n` +
          (existingRounds === 1 ? "Il turno già presente resta com'è" : `I ${existingRounds} turni già presenti restano come sono`) +
          (res.added.length > res.newRounds.length * Math.floor(players.length / 2) ? "; quelli incompleti vengono riempiti." : ".")
      )
    ) {
      return;
    }
    onUpdateSchedule(res.schedule);
    flash("ok", `Turni completati: ${res.added.length} partite aggiunte.`);
  };

  const generate = () => {
    if (players.length < 2) {
      flash("err", "Servono almeno due giocatori.");
      return;
    }
    const generated = roundRobin(shuffled(players.map((p) => p.handle)), { double: doubleRound });
    const rounds = new Set(generated.map((m) => m.round)).size;
    const warnings = [
      scheduleList.length > 0 ? `Il calendario attuale (${scheduleList.length} partite) verrà sostituito.` : "",
      hasGames ? "Ci sono già partite create in questa stagione: il nuovo calendario non terrà conto di chi si è già affrontato." : "",
    ].filter(Boolean);
    if (
      !window.confirm(
        `Generare un girone ${doubleRound ? "di andata e ritorno" : "all'italiana"} per ${players.length} giocatori: ` +
          `${rounds} turni, ${generated.length} partite, ordine casuale?` +
          (warnings.length ? "\n\n" + warnings.join("\n") : "")
      )
    ) {
      return;
    }
    onUpdateSchedule(generated);
    flash("ok", `Turni generati: ${rounds} turni, ${generated.length} partite.`);
  };

  return (
    <div>
      <div>
        <p className="note note-sm">
          Ognuno incontra tutti gli altri, con bianco e nero alternati il più possibile. Se i giocatori sono dispari, a
          ogni turno uno riposa. I turni generati non hanno ancora link Lichess: li crei dal turno, quando lo avvii.
        </p>
        <div className="inline">
          <input id="rr-double" type="checkbox" checked={doubleRound} onChange={(e) => setDoubleRound(e.target.checked)} />
          <label htmlFor="rr-double">Andata e ritorno</label>
        </div>
        {existing.length > 0 ? (
          <div className="actions flush">
            <button className="primary" type="button" onClick={complete}>
              Completa i turni mancanti
            </button>
            <p className="note note-sm m-0">
              {existingRounds === 1 ? "Tiene il turno già presente" : `Tiene i ${existingRounds} turni già presenti`}
              {hasGames ? ", comprese le partite già create," : ""} e aggiunge solo le partite che mancano.
            </p>
            <button className="danger" type="button" onClick={generate}>
              Rigenera tutto da zero
            </button>
          </div>
        ) : (
          <button className="primary" type="button" onClick={generate}>
            Genera calendario ({players.length} giocatori)
          </button>
        )}
      </div>
    </div>
  );
}
