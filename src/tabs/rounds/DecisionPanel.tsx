import { useState } from 'react';
import { GameResult, HistoryGame, LichessExportGame } from '../../types';
import { DECISION_RESULTS, decisionLabel } from '../../lib/decisions';
import { saveGameDecision } from '../../firebaseService';
import { gameProgress } from '../../lib/progress';
import { errorMessage, getApproxMoves } from '../../lib/utils';
import { pliesOf } from '../../lib/games';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

const day = (ms: number) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' }).format(new Date(ms));

// What Lichess says of the game now: the organizer decides knowing it
export function lichessSummary(state: LichessExportGame | undefined): string {
  const progress = gameProgress(state);
  if (progress === 'pending') return 'la sfida non è ancora stata accettata';
  if (progress === 'ongoing') {
    const plies = pliesOf(state);
    return plies === 0 ? 'iniziata, ma nessuno ha ancora mosso' : `in corso, ${getApproxMoves(plies).approxMoves}`;
  }
  const result = state?.winner === 'white' ? '1-0' : state?.winner === 'black' ? '0-1' : '½-½';
  return `già finita (${result}): il risultato deciso la sostituisce`;
}

// Under a game: the result the organizer decides in place of Lichess' (lib/decisions.ts), for a game
// past the time allowed without an agreement, or one never started. It can be taken back.
export function DecisionPanel({
  game,
  state,
  nameOf,
  flash,
  onSaved,
}: {
  game: HistoryGame;
  state?: LichessExportGame; // fresh from Lichess
  nameOf: (handle: string) => string;
  flash: Flash;
  onSaved: (next: HistoryGame) => void;
}) {
  const decision = game.decision;
  const [result, setResult] = useState<GameResult | ''>(decision?.result ?? '');
  const [note, setNote] = useState(decision?.note ?? '');
  const [busy, setBusy] = useState(false);
  const white = nameOf(game.white);
  const black = nameOf(game.black);
  const pairing = `${white} – ${black}`;
  const changed = result !== '' && (result !== decision?.result || note.trim() !== (decision?.note ?? ''));

  const save = async () => {
    if (!result) return;
    if (
      !window.confirm(
        `Registrare per ${pairing}: ${decisionLabel(result, white, black)}?\n\n` +
          'Vale al posto del risultato di Lichess in classifica e in tutto il sito. Non conta per l’Elo del torneo. Si può annullare.'
      )
    )
      return;
    setBusy(true);
    try {
      const next = { result, at: decision?.at ?? Date.now(), ...(note.trim() ? { note: note.trim() } : {}) };
      await saveGameDecision(game, next);
      onSaved({ ...game, decision: next });
      flash('ok', `Risultato registrato: ${pairing}, ${decisionLabel(result, white, black)}.`);
    } catch (e) {
      flash('err', `Salvataggio non riuscito: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Togliere il risultato deciso di ${pairing}? Torna a valere quello di Lichess.`)) return;
    setBusy(true);
    try {
      await saveGameDecision(game, null);
      const { decision: _gone, ...rest } = game;
      onSaved(rest);
      setResult('');
      setNote('');
      flash('ok', `${pairing}: torna a valere il risultato di Lichess.`);
    } catch (e) {
      flash('err', `Salvataggio non riuscito: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relink">
      {decision ? (
        <p className="note">
          ⚖️ Deciso il {day(decision.at)}: <strong>{decisionLabel(decision.result, white, black)}</strong>.
          {decision.note ? ` Nota: ${decision.note}` : ''}
        </p>
      ) : (
        <p className="note">
          Su Lichess la partita è {lichessSummary(state)}. Se i giocatori non si accordano, puoi registrare qui il risultato.
        </p>
      )}
      <fieldset className="decision-choices" disabled={busy}>
        <legend className="relink-label">Risultato deciso dall'organizzatore</legend>
        {DECISION_RESULTS.map((r) => (
          <div className="inline" key={r}>
            <input
              id={`decision-${game.round}-${game.white}-${r}`}
              type="radio"
              name={`decision-${game.round}-${game.white}`}
              checked={result === r}
              onChange={() => setResult(r)}
            />
            <label htmlFor={`decision-${game.round}-${game.white}-${r}`}>{decisionLabel(r, white, black)}</label>
          </div>
        ))}
      </fieldset>
      <label className="relink-label" htmlFor={`decision-note-${game.round}-${game.white}`}>
        Nota (solo per te, facoltativa)
      </label>
      <input
        id={`decision-note-${game.round}-${game.white}`}
        type="text"
        value={note}
        maxLength={200}
        disabled={busy}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Es. nessun accordo, analisi della posizione al 15 dicembre"
      />
      <div className="actions two">
        <button type="button" className="primary" disabled={busy || !changed} onClick={save}>
          {decision ? 'Salva la modifica' : 'Registra il risultato'}
        </button>
        {decision && (
          <button type="button" className="secondary" disabled={busy} onClick={remove}>
            Torna al risultato di Lichess
          </button>
        )}
      </div>
    </div>
  );
}
