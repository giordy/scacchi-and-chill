import React, { useState } from 'react';
import { Player, PodiumPlace, SeasonWinner, TournamentMeta } from '../../types';
import { fullPodium, Medal, MEDAL_EMOJI, podiumError } from '../../lib/honours';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;
type Row = { place: Medal; handle: string };

const START_ROWS: Row[] = [
  { place: 1, handle: '' },
  { place: 2, handle: '' },
  { place: 3, handle: '' },
];

// Manual corrections to the hall of fame: archiving a season already adds its champion and podium.
// The list is in season order: new seasons go at the bottom.
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
  const [season, setSeason] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>(START_ROWS);
  // Index of the entry being edited, null when adding a new one
  const [editing, setEditing] = useState<number | null>(null);

  // Names: current players, then anyone already in the hall of fame (players who left keep theirs)
  const names = new Map<string, string>();
  winners.forEach((w) => fullPodium(w).forEach((p) => names.set(p.handle.toLowerCase(), p.name)));
  players.forEach((p) => names.set(p.handle.toLowerCase(), p.name));
  const known = new Map<string, string>();
  players.forEach((p) => known.set(p.handle, p.name));
  winners.forEach((w) => fullPodium(w).forEach((p) => !known.has(p.handle) && known.set(p.handle, p.name)));
  const canonical = (typed: string) => {
    const t = typed.trim().replace(/^@/, '');
    return [...known.keys()].find((h) => h.toLowerCase() === t.toLowerCase()) ?? t;
  };

  const save = (next: SeasonWinner[], message: string) => {
    onUpdateTournamentMeta({ winners: next });
    flash('ok', message);
  };

  const reset = () => {
    setSeason('');
    setNotes('');
    setRows(START_ROWS);
    setEditing(null);
  };

  const submit = () => {
    const name = season.trim();
    if (!name) {
      flash('err', 'Inserisci il nome della stagione.');
      return;
    }
    const filled = rows.filter((r) => r.handle.trim()).map((r) => ({ ...r, handle: canonical(r.handle) }));
    const error = podiumError(filled);
    if (error) {
      flash('err', error);
      return;
    }
    const podium: PodiumPlace[] = filled
      .sort((a, b) => a.place - b.place)
      .map((r) => ({ ...r, name: names.get(r.handle.toLowerCase()) ?? r.handle }));
    const [champion, ...others] = podium;
    const old = editing !== null ? winners[editing] : undefined;
    const entry: SeasonWinner = {
      ...(old ?? {}),
      season: name,
      handle: champion.handle,
      name: champion.name,
      notes: notes.trim() || undefined,
      podium: others.length > 0 ? others : undefined,
    };
    if (editing !== null) {
      save(winners.map((w, i) => (i === editing ? entry : w)), `Albo d'Oro aggiornato: ${name}.`);
    } else {
      save([...winners, entry], `${name} aggiunta all'Albo d'Oro.`);
    }
    reset();
  };

  const edit = (idx: number) => {
    const w = winners[idx];
    setSeason(w.season);
    setNotes(w.notes ?? '');
    setRows(fullPodium(w).map((p) => ({ place: p.place, handle: p.handle })));
    setEditing(idx);
  };

  const move = (idx: number, by: -1 | 1) => {
    const next = [...winners];
    [next[idx], next[idx + by]] = [next[idx + by], next[idx]];
    save(next, "Ordine dell'Albo d'Oro aggiornato.");
    if (editing !== null) reset();
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="subcard">
      <h4 className="subcard-title">Albo d'Oro</h4>
      <p className="note note-sm">
        Archiviando una stagione campione e podio vengono aggiunti da soli. Qui puoi correggerli o aggiungere le stagioni
        passate, dalla più vecchia alla più recente: l'ultima dà il campione in carica.
      </p>

      {winners.length > 0 && (
        <div className="item-list tight">
          {winners.map((w, idx) => (
            <div key={`${w.season}-${idx}`} className="list-row small">
              <div>
                <strong>{w.season}:</strong>{' '}
                {fullPodium(w).map((p, i) => (
                  <span key={p.handle}>
                    {i > 0 && ' · '}
                    {MEDAL_EMOJI[p.place]} {p.name}
                  </span>
                ))}
                {w.notes && <span className="muted-sm"> · {w.notes}</span>}
              </div>
              <span className="row-actions">
                <button type="button" className="secondary btn-mini btn-mini-edit" aria-label={`Sposta su ${w.season}`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                  ↑
                </button>
                <button type="button" className="secondary btn-mini btn-mini-edit" aria-label={`Sposta giù ${w.season}`} disabled={idx === winners.length - 1} onClick={() => move(idx, 1)}>
                  ↓
                </button>
                <button type="button" className="secondary btn-mini btn-mini-edit" aria-label={`Modifica ${w.season}`} onClick={() => edit(idx)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="secondary btn-mini"
                  aria-label={`Rimuovi ${w.season}`}
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

      <div className="podium-form">
        <div>
          <label htmlFor="hof-season" className="label-sm">Stagione</label>
          <input id="hof-season" type="text" placeholder={`es. Stagione ${winners.length + 1}`} value={season} onChange={(e) => setSeason(e.target.value)} />
        </div>
        <datalist id="hof-players">
          {[...known].map(([handle, name]) => (
            <option key={handle} value={handle}>
              {name}
            </option>
          ))}
        </datalist>
        {rows.map((r, i) => (
          <div key={i} className="podium-row">
            <select aria-label="Posizione" value={r.place} onChange={(e) => setRow(i, { place: Number(e.target.value) as Medal })}>
              {([1, 2, 3] as Medal[]).map((m) => (
                <option key={m} value={m}>
                  {MEDAL_EMOJI[m]} {m}°
                </option>
              ))}
            </select>
            <input
              type="text"
              aria-label="Giocatore (username Lichess)"
              list="hof-players"
              placeholder="username Lichess"
              value={r.handle}
              onChange={(e) => setRow(i, { handle: e.target.value })}
            />
            <button type="button" className="secondary btn-mini" aria-label="Togli riga" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="secondary btn-mini btn-mini-edit podium-add" onClick={() => setRows((rs) => [...rs, { place: rs[rs.length - 1]?.place ?? 1, handle: '' }])}>
          + Pari merito
        </button>
        <p className="note note-sm m-0">
          A pari merito i giocatori condividono il posto e quelli dopo scalano: due primi e poi un 3°, due secondi e nessun
          terzo. Si può scrivere anche lo username di chi non gioca più.
        </p>
        <div>
          <label htmlFor="hof-notes" className="label-sm">Note</label>
          <input id="hof-notes" type="text" placeholder="opzionale" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="actions two flush">
        <button type="button" className="secondary" onClick={submit}>
          {editing !== null ? 'Salva modifiche' : "Aggiungi all'Albo d'Oro"}
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
