import React, { useState } from 'react';
import { Player } from '../../types';

export function PlayersSection({
  players,
  flash,
  onUpdatePlayers,
}: {
  players: Player[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdatePlayers: (players: Player[]) => void;
}) {
  const playersList = players;
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerHandle, setNewPlayerHandle] = useState("");

  return (
    <div>
      <p className="note note-flush">
        Modifica i partecipanti e i loro nickname Lichess. Le modifiche vengono salvate in tempo reale nel database cloud.
      </p>

      <div className="item-list">
        {playersList.map((p, idx) => (
          <div
            key={idx}
            className="list-row"
          >
            <div>
              <strong>{p.name}</strong> <span className="muted-sm">({p.handle})</span>
            </div>
            <button
              type="button"
              className="secondary btn-mini"
              onClick={() => {
                const updated = playersList.filter((_, i) => i !== idx);
                onUpdatePlayers(updated);
                flash("ok", `Giocatore ${p.name} rimosso.`);
              }}
            >
              Rimuovi
            </button>
          </div>
        ))}
      </div>

      <div className="add-form add-form-player">
        <div>
          <label htmlFor="new-p-name">Nome WhatsApp</label>
          <input
            id="new-p-name"
            type="text"
            placeholder="es. Marco"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-p-handle">Nickname Lichess</label>
          <input
            id="new-p-handle"
            type="text"
            placeholder="es. marco_chess"
            value={newPlayerHandle}
            onChange={(e) => setNewPlayerHandle(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="secondary btn-add"
          onClick={() => {
            const name = newPlayerName.trim();
            const handle = newPlayerHandle.trim().toLowerCase();
            if (!name || !handle) {
              flash("err", "Inserisci sia il nome che il nickname Lichess.");
              return;
            }
            if (playersList.some((p) => p.handle.toLowerCase() === handle)) {
              flash("err", `Esiste già un giocatore con handle '${handle}'.`);
              return;
            }
            const updated = [...playersList, { name, handle }];
            onUpdatePlayers(updated);
            setNewPlayerName("");
            setNewPlayerHandle("");
            flash("ok", `Giocatore ${name} aggiunto con successo!`);
          }}
        >
          + Aggiungi
        </button>
      </div>
    </div>
  );
}
