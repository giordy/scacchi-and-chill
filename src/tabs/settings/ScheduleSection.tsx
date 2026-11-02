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
    <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
      <p className="note" style={{ margin: "0 0 12px" }}>
        Gli accoppiamenti preimpostati per ciascun turno. Selezionando il turno nella scheda <em>Partite</em>, questi incontri vengono caricati in automatico con 1 clic.
      </p>

      {scheduleList.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
          {scheduleList.map((m, idx) => {
            const wName = playersList.find((p) => p.handle === m.white)?.name || m.white;
            const bName = playersList.find((p) => p.handle === m.black)?.name || m.black;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <div>
                  <span className="badge" style={{ marginRight: 6 }}>T.{m.round}</span>
                  <strong>{wName}</strong> ⚪ vs <strong>{bName}</strong> ⚫
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: 11, padding: "2px 6px", color: "var(--danger)" }}
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

      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr auto", gap: 8, alignItems: "flex-end" }}>
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
          className="secondary"
          style={{ minHeight: 48, whiteSpace: "nowrap" }}
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
