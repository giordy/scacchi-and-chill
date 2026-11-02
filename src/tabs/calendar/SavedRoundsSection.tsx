import React from 'react';
import { HistoryGame } from '../../types';
import { deleteGamesFromFirebase } from '../../firebaseService';
import { errorMessage } from '../../lib/utils';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Rounds already created on Lichess: reload one into the pairings, or delete it if created by mistake
export function SavedRoundsSection({
  history,
  setHistory,
  onLoadIntoActivePairs,
  flash,
}: {
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  onLoadIntoActivePairs: (round: string, games: HistoryGame[]) => void;
  flash: Flash;
}) {
  const rounds = [...new Set(history.map((g) => g.round))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const deleteRound = async (r: string) => {
    if (!window.confirm(`Eliminare tutte le partite del Turno ${r}? Spariranno anche dalla pagina pubblica.`)) return;
    try {
      // Delete on Firestore first: otherwise the next sync would bring the games back
      await deleteGamesFromFirebase(history.filter((g) => g.round === r));
      setHistory((prev) => prev.filter((g) => g.round !== r));
      flash("ok", `Turno ${r} eliminato.`);
    } catch (e) {
      flash("err", `Eliminazione non riuscita: ${errorMessage(e)}`);
    }
  };

  if (rounds.length === 0) {
    return <p className="note">Nessun turno ancora creato su Lichess.</p>;
  }

  return (
    <div className="item-list tight">
      {rounds.map((r) => {
        const games = history.filter((g) => g.round === r);
        return (
          <div key={r} className="list-row">
            <span>
              <strong>Turno {r}</strong>{" "}
              <span className="muted-sm">
                · {games.length} {games.length === 1 ? "partita" : "partite"}
              </span>
            </span>
            <div className="header-actions">
              <button className="secondary btn-sm" type="button" onClick={() => onLoadIntoActivePairs(r, games)}>
                Apri
              </button>
              <button className="danger btn-sm" type="button" onClick={() => deleteRound(r)}>
                Elimina
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
