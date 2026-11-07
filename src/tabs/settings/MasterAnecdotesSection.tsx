import React, { useEffect, useState } from 'react';
import { TournamentMeta } from '../../types';
import { anecdotesFromText, anecdotesToText } from '../../lib/masterAnecdotes';

// Anecdotes about the master of the season: anecdote #N closes the message of round N and then
// shows on the public page
export function MasterAnecdotesSection({
  meta,
  flash,
  onUpdateTournamentMeta,
}: {
  meta?: TournamentMeta;
  flash: (kind: 'ok' | 'err', text: string) => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const saved = anecdotesToText(meta?.masterAnecdotes);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  return (
    <div className="subcard">
      <h4 className="subcard-title">Aneddoti del maestro ({meta?.masterAnecdotes?.length ?? 0})</h4>
      <p className="note note-sm">
        Uno per turno, nell'ordine: l'aneddoto #N chiude il messaggio di creazione delle partite del Turno N e da quel
        momento compare anche sul sito. Prima riga il titolo, poi il testo; separa gli aneddoti con una riga con solo{' '}
        <code>---</code>. Vale la formattazione di WhatsApp (<code>*grassetto*</code>, <code>_corsivo_</code>).
      </p>
      <textarea
        aria-label="Aneddoti del maestro"
        className="ta-lg"
        rows={12}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="button"
        className="secondary"
        disabled={draft === saved}
        onClick={() => {
          const list = anecdotesFromText(draft);
          const before = meta?.masterAnecdotes?.length ?? 0;
          // Fewer anecdotes than before: some are being deleted
          if (list.length < before && !window.confirm(`Salvare ${list.length} aneddoti invece di ${before}? Quelli tolti vengono cancellati.`)) return;
          onUpdateTournamentMeta({ masterAnecdotes: list });
          flash('ok', `Aneddoti salvati: ${list.length}.`);
        }}
      >
        Salva aneddoti
      </button>
    </div>
  );
}
