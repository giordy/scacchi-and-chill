import React, { useState } from 'react';
import { Player, SeasonWinner, TournamentMeta } from '../../types';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Manual corrections to the hall of fame: archiving a season already adds its champion
export function HallOfFameSection({
  winners,
  players,
  flash,
  onUpdateTournamentMeta,
}: {
  winners: SeasonWinner[];
  players: Player[];
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const [season, setSeason] = useState("");
  const [handle, setHandle] = useState("");
  const [notes, setNotes] = useState("");

  const save = (next: SeasonWinner[], message: string) => {
    onUpdateTournamentMeta({ winners: next });
    flash("ok", message);
  };

  const add = () => {
    const s = season.trim();
    if (!s || !handle) {
      flash("err", "Inserisci la stagione e scegli il vincitore.");
      return;
    }
    const p = players.find((pl) => pl.handle === handle);
    save(
      [...winners, { season: s, handle, name: p?.name || handle, notes: notes.trim() || undefined }],
      `${p?.name || handle} aggiunto all'Albo d'Oro.`
    );
    setSeason("");
    setHandle("");
    setNotes("");
  };

  return (
    <div className="subcard">
      <h4 className="subcard-title">Albo d'Oro</h4>
      <p className="note note-sm">
        Archiviando una stagione il campione viene aggiunto da solo. Qui puoi correggere l'elenco a mano.
      </p>

      {winners.length > 0 && (
        <div className="item-list tight">
          {winners.map((w, idx) => (
            <div key={`${w.season}-${idx}`} className="list-row small">
              <div>
                <strong>{w.season}:</strong> {w.name} (@{w.handle})
                {w.notes && <span className="muted-sm"> · {w.notes}</span>}
              </div>
              <button
                type="button"
                className="secondary btn-mini"
                aria-label={`Rimuovi ${w.name} (${w.season})`}
                onClick={() => {
                  if (window.confirm(`Rimuovere ${w.name} (${w.season}) dall'Albo d'Oro?`)) {
                    save(winners.filter((_, i) => i !== idx), "Albo d'Oro aggiornato.");
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="add-form add-form-winner">
        <div>
          <label htmlFor="new-w-season" className="label-sm">Stagione</label>
          <input id="new-w-season" type="text" placeholder="es. Stagione 1" value={season} onChange={(e) => setSeason(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new-w-handle" className="label-sm">Vincitore</label>
          <select id="new-w-handle" value={handle} onChange={(e) => setHandle(e.target.value)}>
            <option value="">Scegli…</option>
            {players.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-w-notes" className="label-sm">Note</label>
          <input id="new-w-notes" type="text" placeholder="opzionale" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="button" className="secondary btn-add compact" onClick={add}>
          Aggiungi
        </button>
      </div>
    </div>
  );
}
