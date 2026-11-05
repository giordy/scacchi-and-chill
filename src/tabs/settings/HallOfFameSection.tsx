import React, { useState } from 'react';
import { Player, PodiumPlace, SeasonWinner, TournamentMeta } from '../../types';
import { MEDAL_EMOJI, podiumFromPicks } from '../../lib/honours';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

const EMPTY_FORM = { season: '', handle: '', notes: '', second: '', secondTie: '', third: '' };

// Manual corrections to the hall of fame: archiving a season already adds its champion and podium
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
  const [form, setForm] = useState(EMPTY_FORM);
  // Index of the entry being edited, null when adding a new one
  const [editing, setEditing] = useState<number | null>(null);
  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm((f) => ({ ...f, ...patch }));

  const nameOf = (handle: string, fallback?: string) => players.find((p) => p.handle === handle)?.name || fallback || handle;

  const save = (next: SeasonWinner[], message: string) => {
    onUpdateTournamentMeta({ winners: next });
    flash("ok", message);
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const submit = () => {
    const season = form.season.trim();
    if (!season || !form.handle) {
      flash("err", "Inserisci la stagione e scegli il campione.");
      return;
    }
    const old = editing !== null ? winners[editing] : undefined;
    const oldName = (h: string) => old?.podium?.find((p) => p.handle === h)?.name;
    const picks = podiumFromPicks([form.second, form.secondTie], [form.third]).filter((p) => p.handle !== form.handle);
    const podium: PodiumPlace[] = picks.map((p) => ({ ...p, name: nameOf(p.handle, oldName(p.handle)) }));
    const entry: SeasonWinner = {
      ...(old ?? {}),
      season,
      handle: form.handle,
      name: nameOf(form.handle, old?.handle === form.handle ? old.name : undefined),
      notes: form.notes.trim() || undefined,
      podium: podium.length > 0 ? podium : undefined,
    };
    if (editing !== null) {
      save(winners.map((w, i) => (i === editing ? entry : w)), `Albo d'Oro aggiornato: ${season}.`);
    } else {
      save([...winners, entry], `${entry.name} aggiunto all'Albo d'Oro.`);
    }
    reset();
  };

  const edit = (idx: number) => {
    const w = winners[idx];
    const seconds = (w.podium ?? []).filter((p) => p.place <= 2).map((p) => p.handle);
    const third = (w.podium ?? []).find((p) => p.place === 3)?.handle ?? '';
    setForm({ season: w.season, handle: w.handle, notes: w.notes ?? '', second: seconds[0] ?? '', secondTie: seconds[1] ?? '', third });
    setEditing(idx);
  };

  // Players of the current season, plus anyone already named in the entry being edited
  const known = new Map(players.map((p) => [p.handle, p.name]));
  if (editing !== null) {
    const w = winners[editing];
    if (!known.has(w.handle)) known.set(w.handle, w.name);
    (w.podium ?? []).forEach((p) => !known.has(p.handle) && known.set(p.handle, p.name));
  }
  const options = [...known].map(([handle, name]) => (
    <option key={handle} value={handle}>
      {name}
    </option>
  ));
  const select = (id: string, label: string, value: string, onChange: (v: string) => void, disabled = false) => (
    <div>
      <label htmlFor={id} className="label-sm">{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{disabled ? "—" : "Scegli…"}</option>
        {options}
      </select>
    </div>
  );

  return (
    <div className="subcard">
      <h4 className="subcard-title">Albo d'Oro</h4>
      <p className="note note-sm">
        Archiviando una stagione campione e podio vengono aggiunti da soli. Qui puoi correggere l'elenco a mano o
        aggiungere le stagioni passate. Con due secondi a pari merito non c'è un terzo posto.
      </p>

      {winners.length > 0 && (
        <div className="item-list tight">
          {winners.map((w, idx) => (
            <div key={`${w.season}-${idx}`} className="list-row small">
              <div>
                <strong>{w.season}:</strong> {MEDAL_EMOJI[1]} {w.name} (@{w.handle})
                {(w.podium ?? []).map((p) => (
                  <span key={p.handle}> · {MEDAL_EMOJI[p.place]} {p.name}</span>
                ))}
                {w.notes && <span className="muted-sm"> · {w.notes}</span>}
              </div>
              <span className="row-actions">
                <button type="button" className="secondary btn-mini btn-mini-edit" aria-label={`Modifica ${w.season}`} onClick={() => edit(idx)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="secondary btn-mini"
                  aria-label={`Rimuovi ${w.name} (${w.season})`}
                  onClick={() => {
                    if (window.confirm(`Rimuovere ${w.season} dall'Albo d'Oro?`)) {
                      save(winners.filter((_, i) => i !== idx), "Albo d'Oro aggiornato.");
                      if (editing === idx) reset();
                    }
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="add-form add-form-podium">
        <div>
          <label htmlFor="new-w-season" className="label-sm">Stagione</label>
          <input id="new-w-season" type="text" placeholder="es. Stagione 1" value={form.season} onChange={(e) => set({ season: e.target.value })} />
        </div>
        {select("new-w-handle", "🥇 Campione", form.handle, (v) => set({ handle: v }))}
        {select("new-w-second", "🥈 Secondo", form.second, (v) => set({ second: v }))}
        {select("new-w-second-tie", "🥈 Secondo a pari merito", form.secondTie, (v) => set({ secondTie: v, third: v ? "" : form.third }))}
        {select("new-w-third", "🥉 Terzo", form.third, (v) => set({ third: v }), !!form.secondTie)}
        <div>
          <label htmlFor="new-w-notes" className="label-sm">Note</label>
          <input id="new-w-notes" type="text" placeholder="opzionale" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </div>
      <div className="actions two flush">
        <button type="button" className="secondary" onClick={submit}>
          {editing !== null ? "Salva modifiche" : "Aggiungi all'Albo d'Oro"}
        </button>
        {editing !== null && (
          <button type="button" className="secondary" onClick={reset}>
            Annulla
          </button>
        )}
      </div>
    </div>
  );
}
