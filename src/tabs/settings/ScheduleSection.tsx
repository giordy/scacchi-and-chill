import React, { useState, useEffect } from 'react';
import { Player, ScheduledMatch } from '../../types';

export function ScheduleSection({
  players,
  schedule,
  flash,
  onUpdateSchedule,
}: {
  players: Player[];
  schedule?: ScheduledMatch[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const playersList = players;
  const [scheduleList, setScheduleList] = useState<ScheduledMatch[]>(schedule || []);
  const [newMatchRound, setNewMatchRound] = useState("1");
  const [newMatchWhite, setNewMatchWhite] = useState("");
  const [newMatchBlack, setNewMatchBlack] = useState("");

  useEffect(() => {
    if (schedule) setScheduleList(schedule);
  }, [schedule]);

  return (
    <div>
      <p className="note note-flush">
        Gli accoppiamenti preimpostati per ciascun turno. Selezionando il turno nella scheda <em>Partite</em>, questi incontri vengono caricati in automatico con 1 clic.
      </p>

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
