import React, { useState, useEffect } from 'react';
import { HistoryGame, Player, ScheduledMatch } from '../../types';
import { roundRobin, shuffled } from '../../lib/roundRobin';
import { completeSchedule } from '../../lib/completeSchedule';

export function ScheduleSection({
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
  const playersList = players;
  const [scheduleList, setScheduleList] = useState<ScheduledMatch[]>(schedule || []);
  const [newMatchRound, setNewMatchRound] = useState("1");
  const [newMatchWhite, setNewMatchWhite] = useState("");
  const [newMatchBlack, setNewMatchBlack] = useState("");

  const [doubleRound, setDoubleRound] = useState(false);

  useEffect(() => {
    if (schedule) setScheduleList(schedule);
  }, [schedule]);

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
    setScheduleList(res.schedule);
    onUpdateSchedule(res.schedule);
    flash("ok", `Calendario completato: ${res.added.length} partite aggiunte.`);
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
    setScheduleList(generated);
    onUpdateSchedule(generated);
    flash("ok", `Calendario generato: ${rounds} turni, ${generated.length} partite.`);
  };

  return (
    <div>
      <p className="note note-flush">
        Gli accoppiamenti previsti per ogni turno. Quando scegli il turno in <em>Turno → Accoppiamenti</em> vengono caricati da soli.
      </p>

      <div className="subcard">
        <h3 className="subcard-title">Girone all'italiana</h3>
        <p className="note note-sm">
          Ognuno incontra tutti gli altri, con bianco e nero alternati il più possibile. Se i giocatori sono dispari, a
          ogni turno uno riposa. Il calendario non crea link Lichess: le sfide nascono solo quando avvii il turno.
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

      {scheduleList.length > 0 && (
        <div className="item-list">
          {scheduleList.map((m, idx) => {
            const wName = playersList.find((p) => p.handle === m.white)?.name || m.white;
            const bName = playersList.find((p) => p.handle === m.black)?.name || m.black;
            return (
              <div
                key={idx}
                className="list-row small"
              >
                <div>
                  <span className="badge badge-gap">T.{m.round}</span>
                  <strong>{wName}</strong> ⚪ vs <strong>{bName}</strong> ⚫
                </div>
                <button
                  type="button"
                  className="secondary btn-mini"
                  onClick={() => {
                    const updated = scheduleList.filter((_, i) => i !== idx);
                    setScheduleList(updated);
                    onUpdateSchedule(updated);
                    flash("ok", "Accoppiamento rimosso dal calendario.");
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="add-form add-form-match">
        <div>
          <label htmlFor="new-m-round">Turno</label>
          <input
            id="new-m-round"
            type="text"
            inputMode="numeric"
            value={newMatchRound}
            onChange={(e) => setNewMatchRound(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-m-white">Bianco</label>
          <select
            id="new-m-white"
            value={newMatchWhite}
            onChange={(e) => setNewMatchWhite(e.target.value)}
          >
            <option value="">Seleziona...</option>
            {playersList.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-m-black">Nero</label>
          <select
            id="new-m-black"
            value={newMatchBlack}
            onChange={(e) => setNewMatchBlack(e.target.value)}
          >
            <option value="">Seleziona...</option>
            {playersList.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="secondary btn-add"
          onClick={() => {
            const r = newMatchRound.trim();
            if (!r || !newMatchWhite || !newMatchBlack) {
              flash("err", "Inserisci turno, giocatore bianco e giocatore nero.");
              return;
            }
            if (newMatchWhite === newMatchBlack) {
              flash("err", "Un giocatore non può sfidare se stesso.");
              return;
            }
            const updated = [
              ...scheduleList,
              { round: r, white: newMatchWhite, black: newMatchBlack },
            ];
            setScheduleList(updated);
            onUpdateSchedule(updated);
            setNewMatchWhite("");
            setNewMatchBlack("");
            flash("ok", `Partita aggiunta al Turno ${r}!`);
          }}
        >
          + Inserisci
        </button>
      </div>
    </div>
  );
}
