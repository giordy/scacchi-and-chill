import React, { useState, useEffect } from 'react';
import { Player, ScheduledMatch } from '../../types';
import { roundRobin, shuffled } from '../../lib/roundRobin';

export function ScheduleSection({
  players,
  schedule,
  hasGames,
  flash,
  onUpdateSchedule,
}: {
  players: Player[];
  // Games already created this season: regenerating would not match them any more
  hasGames: boolean;
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
        <h3 className="subcard-title">Genera girone all'italiana</h3>
        <p className="note note-sm">
          Ognuno incontra tutti gli altri, con bianco e nero alternati il più possibile. Se i giocatori sono dispari, a
          ogni turno uno riposa.
        </p>
        <div className="inline">
          <input id="rr-double" type="checkbox" checked={doubleRound} onChange={(e) => setDoubleRound(e.target.checked)} />
          <label htmlFor="rr-double">Andata e ritorno</label>
        </div>
        <button className="secondary btn-block" type="button" onClick={generate}>
          Genera calendario ({players.length} giocatori)
        </button>
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
