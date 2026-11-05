import { useState, useEffect } from 'react';
import { AppConfig, HistoryGame } from '../../types';
import { errorMessage, extractGameId } from '../../lib/utils';
import { buildBulletin } from '../../lib/bulletin';
import { fetchGameStates } from '../../lib/lichess';
import { applyWithdrawals } from '../../lib/withdrawals';
import { gameProgress } from '../../lib/progress';
import { WhatsAppPreview } from '../../WhatsAppPreview';

// Round bulletin: state of the round's games on Lichess and the WhatsApp update message
export function BulletinSection({
  round,
  history: rawHistory,
  config,
  expiryDays,
  triggerToast,
}: {
  round: string;
  history: HistoryGame[];
  config: AppConfig;
  // Validity of the Lichess links, to tell when a game not started yet will expire
  expiryDays: number;
  triggerToast?: (msg: string) => void;
}) {
  // Games annulled or won by forfeit after a withdrawal, as on the site
  const history = applyWithdrawals(rawHistory, config.tournament?.withdrawals);

  const [text, setText] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });

  const loadStatusForRound = async (targetRound: string) => {
    let games = history.filter((g) => g.round === targetRound);
    if (games.length === 0) {
      setText("");
      setIsRoundComplete(false);
      return;
    }

    // Sort games in the exact order defined in the tournament schedule
    if (config.schedule && config.schedule.length > 0) {
      games = [...games].sort((a, b) => {
        const idxA = config.schedule!.findIndex(
          (m) => m.round === a.round && m.white === a.white && m.black === a.black
        );
        const idxB = config.schedule!.findIndex(
          (m) => m.round === b.round && m.white === b.white && m.black === b.black
        );
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    setStatus({ busy: true, error: "", info: "" });
    try {
      // Finished games are final and already stored: Lichess is asked only about the open ones
      const ids = games
        .filter((g) => gameProgress(g.lichess) !== "finished")
        .map((g) => extractGameId(g.url))
        .filter((id): id is string => Boolean(id));
      const states = ids.length > 0 ? await fetchGameStates(ids) : {};
      const built = buildBulletin({ round, games, states, history, config, expiryDays });
      setText(built.text);
      setDetails(built.details);
      setIsRoundComplete(built.isComplete);
      setStatus({ busy: false, error: "", info: "" });
    } catch (e) {
      setStatus({
        busy: false,
        info: "",
        error:
          e instanceof TypeError
            ? "Errore di connessione di rete verso Lichess."
            : errorMessage(e),
      });
    }
  };

  // Automatically update status whenever round is chosen or games change
  useEffect(() => {
    if (round) {
      loadStatusForRound(round);
    }
  }, [round, history.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus((s) => ({ ...s, info: "Messaggio copiato negli appunti." }));
      if (triggerToast) {
        triggerToast("Messaggio di stato copiato negli appunti! 📋");
      }
    } catch {
      setStatus((s) => ({ ...s, info: "Impossibile copiare automaticamente: seleziona il testo e copia a mano." }));
    }
  };

  return (
    <section>
      <button
        className="secondary btn-block"
        type="button"
        disabled={status.busy}
        onClick={() => loadStatusForRound(round)}
      >
        {status.busy ? "Verifica in corso…" : "🔄 Aggiorna da Lichess"}
      </button>

      {status.error && <div className="notice err">{status.error}</div>}

      {status.busy && (
        <div className="notice ok mb-14">
          ⏳ Recupero stati, aperture e mosse delle partite da Lichess…
        </div>
      )}

      {text && (
        <>
          {isRoundComplete && (
            <div className="notice ok my-10-12">
              🏁 <strong>Turno {round} completato!</strong> Tutte le partite sono terminate. Il messaggio contiene i risultati finali.
            </div>
          )}

          {/* WhatsApp Live Bubble Preview */}
          <WhatsAppPreview text={text} title={`Anteprima WhatsApp (Stato Turno ${round})`} />

          <div className="actions two mt-12">
            <a
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={"https://wa.me/?text=" + encodeURIComponent(text)}
            >
              📲 Condividi su WhatsApp
            </a>
            <button className="secondary" type="button" onClick={copy}>
              📋 Copia testo
            </button>
          </div>

          {status.info && <div className="notice ok mt-8">{status.info}</div>}

          <details className="raw-text mt-12">
            <summary>
              ✏️ Modifica testo prima dell'invio
            </summary>
            <div className="raw-text-body">
              <textarea
                aria-label="Messaggio di aggiornamento"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="ta-lg"
              />
            </div>
          </details>

          {details.length > 0 && (
            <details className="raw-text mt-12">
              <summary>🔍 Dati letti da Lichess</summary>
              <div className="raw-text-body">
                <ul className="bulletin-details">
                  {details.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
