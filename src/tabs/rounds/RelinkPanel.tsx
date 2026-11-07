import { useState } from 'react';
import { HistoryGame, Settings } from '../../types';
import { cancelChallenge, createChallenge, fetchGameStates } from '../../lib/lichess';
import { checkOwnGame, LinkState, relinkMessage } from '../../lib/relink';
import { errorMessage, extractGameId, formatDeadline } from '../../lib/utils';
import { replaceGameLink } from '../../firebaseService';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

const DAY_MS = 86400000;

// Under a game whose challenge expired, was aborted or is still waiting: a new challenge on Lichess
// with the same colors, or the link of a game the two players created themselves.
export function RelinkPanel({
  game,
  link,
  challengeName,
  settings,
  nameOf,
  flash,
  onReplaced,
  onMissingToken,
}: {
  game: HistoryGame;
  link: LinkState;
  challengeName: string;
  settings: Settings;
  nameOf: (handle: string) => string;
  flash: Flash;
  onReplaced: (next: HistoryGame) => void;
  onMissingToken: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState('');

  const status =
    link.kind === 'expired'
      ? `La sfida è scaduta ${formatDeadline(link.expiredAt)} senza essere accettata.`
      : link.kind === 'void'
        ? 'Lichess ha annullato la partita (nessuna mossa giocata): va rigiocata.'
        : link.kind === 'waiting'
          ? `La sfida non è ancora stata accettata: scade ${formatDeadline(link.expiresAt)}.`
          : '';

  const replace = async (next: HistoryGame, text: string, done: string) => {
    await replaceGameLink(game, next);
    onReplaced(next);
    setMessage(text);
    flash('ok', done);
  };

  const recreate = async () => {
    if (!settings.token) {
      onMissingToken();
      return flash('err', 'Aggiungi prima il token API Lichess in Impostazioni → Token Lichess.');
    }
    setBusy(true);
    try {
      const url = await createChallenge({ white: game.white, black: game.black, url: '' }, { round: game.round, settings, challengeName });
      // The old challenge, if still open, must not be accepted as well
      const oldId = extractGameId(game.url);
      if (oldId && link.kind === 'waiting') await cancelChallenge(oldId, settings.token);
      const createdAt = Date.now();
      await replace(
        { round: game.round, white: game.white, black: game.black, url, createdAt },
        relinkMessage(game.round, nameOf(game.white), nameOf(game.black), url, createdAt + settings.expiry * DAY_MS),
        'Nuova sfida creata su Lichess e salvata nel turno.'
      );
    } catch (e) {
      flash('err', 'Nuova sfida non creata: ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const usePasted = async () => {
    const id = extractGameId(pasted);
    if (!id) return flash('err', 'Incolla il link della partita su Lichess (lichess.org/…).');
    if (id === extractGameId(game.url)) return flash('err', 'È lo stesso link di prima.');
    setBusy(true);
    try {
      const state = (await fetchGameStates([id]))[id];
      let white = game.white;
      let black = game.black;
      let note = '';
      if (state) {
        const check = checkOwnGame(state, game.white, game.black);
        if ('error' in check) return flash('err', check.error);
        ({ white, black } = check);
        if (check.swapped) note = ' I colori sono invertiti rispetto al turno: il sito usa quelli della partita su Lichess.';
      } else {
        note = ` Lichess non la mostra ancora (sfida non accettata): controlla che il bianco sia ${nameOf(game.white)}.`;
      }
      const url = `https://lichess.org/${id}`;
      await replace(
        { round: game.round, white, black, url, createdAt: state?.createdAt ?? Date.now(), ...(state ? { lichess: state } : {}) },
        relinkMessage(game.round, nameOf(white), nameOf(black), url),
        'Link della partita salvato nel turno.' + note
      );
      setPasted('');
    } catch (e) {
      flash('err', 'Link non salvato: ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      flash('ok', 'Messaggio copiato: incollalo nel gruppo WhatsApp.');
    } catch (e) {
      flash('err', 'Copia non riuscita: ' + errorMessage(e));
    }
  };

  // The new link is a game already being played: only the message is left to send
  const done = link.kind === 'playing';

  return (
    <div className="relink">
      {status && <p className="note note-sm">{status}</p>}
      {!done && (
        <>
      <button type="button" className="secondary btn-block" disabled={busy} onClick={recreate}>
        {busy ? 'Un momento…' : '🔁 Ricrea la sfida su Lichess (stessi colori)'}
      </button>
      <label className="relink-label" htmlFor={`relink-${game.white}-${game.black}`}>
        Oppure, se l'hanno creata loro, incolla il link della partita:
      </label>
      <div className="relink-row">
        <input
          id={`relink-${game.white}-${game.black}`}
          type="url"
          placeholder="https://lichess.org/…"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button type="button" className="secondary" disabled={busy || !pasted.trim()} onClick={usePasted}>
          Usa questo link
        </button>
      </div>
        </>
      )}
      {message && (
        <div className="relink-message">
          <pre>{message}</pre>
          <button type="button" className="secondary" onClick={copy}>
            Copia per WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
