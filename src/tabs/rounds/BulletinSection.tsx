import { useMemo, useRef, useState } from 'react';
import { AppConfig, HistoryGame, SeasonArchive } from '../../types';
import { errorMessage, extractGameId } from '../../lib/utils';
import { buildBulletin } from '../../lib/bulletin';
import { fetchGameStates } from '../../lib/lichess';
import { applyWithdrawals } from '../../lib/withdrawals';
import { gameProgress } from '../../lib/progress';
import { WhatsAppPreview } from '../../WhatsAppPreview';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Round bulletin: state of the round's games on Lichess and the WhatsApp update message. It keeps
// itself up to date, with no button: built when the round opens, again as soon as the stored results
// change (the sync at the top of the area, a new game), and every 5 minutes from Lichess while the page
// is visible (as the public page). A text edited by hand is not overwritten.
export function BulletinSection({
  round,
  history: rawHistory,
  config,
  expiryDays,
  triggerToast,
  seasons = [],
}: {
  round: string;
  history: HistoryGame[];
  config: AppConfig;
  // Validity of the Lichess links, to tell when a game not started yet will expire
  expiryDays: number;
  triggerToast?: (msg: string) => void;
  seasons?: SeasonArchive[]; // archived seasons, for the Elo del torneo of the colpacci
}) {
  // Games annulled or won by forfeit after a withdrawal, as on the site
  const history = applyWithdrawals(rawHistory, config.tournament?.withdrawals);

  const [text, setText] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // The round whose text was changed by hand: later updates do not overwrite it, until the organizer
  // asks (a ref, read by the update that is running when the round changes)
  const editedRound = useRef<string | null>(null);
  // The fresh text, while the edited one is kept, with its round
  const [newer, setNewer] = useState<{ round: string; text: string } | null>(null);

  // What the bulletin is built from: when the stored results of the round change, it is built again at once
  const roundKey = useMemo(
    () =>
      round +
      "|" +
      rawHistory
        .filter((g) => g.round === round)
        .map((g) => `${g.url}:${g.lichess?.status ?? ""}:${g.lichess?.moves?.length ?? 0}`)
        .join(",") +
      "|" +
      rawHistory.length,
    [round, rawHistory]
  );

  const loadStatusForRound = async (targetRound: string): Promise<boolean> => {
    let games = history.filter((g) => g.round === targetRound);
    if (games.length === 0) {
      setText("");
      setIsRoundComplete(false);
      return true;
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
      const built = buildBulletin({
        round, games, states, history, config, expiryDays, seasons,
        matchesUrl: `${window.location.origin}${window.location.pathname}#/partite`,
      });
      if (editedRound.current === targetRound) setNewer(built.text === text ? null : { round: targetRound, text: built.text });
      else {
        editedRound.current = null;
        setNewer(null);
        setText(built.text);
      }
      setDetails(built.details);
      setIsRoundComplete(built.isComplete);
      setUpdatedAt(new Date());
      setStatus((st) => ({ ...st, busy: false, error: "" }));
      return true;
    } catch (e) {
      setStatus((st) => ({
        ...st,
        busy: false,
        error:
          e instanceof TypeError
            ? "Errore di connessione di rete verso Lichess."
            : errorMessage(e),
      }));
      return false;
    }
  };

  useVisiblePolling(() => loadStatusForRound(round), roundKey, Boolean(round));

  const useNewer = () => {
    if (newer) setText(newer.text);
    setNewer(null);
    editedRound.current = null;
  };

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
      {status.error && (
        <div className="notice err">
          {status.error}{" "}
          <button type="button" className="link-inline" disabled={status.busy} onClick={() => loadStatusForRound(round)}>
            Riprova
          </button>
        </div>
      )}

      {/* Only the first time: later updates happen quietly, under the text already shown */}
      {status.busy && !text && (
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

          {updatedAt && (
            <p className="note note-13">
              {status.busy ? "Aggiornamento da Lichess…" : `Aggiornato da Lichess alle ${hhmm(updatedAt)}`}
            </p>
          )}

          {newer?.round === round && (
            <div className="notice ok mb-12">
              Ci sono risultati nuovi, ma hai modificato il testo a mano: non l'ho toccato.{" "}
              <button type="button" className="link-inline" onClick={useNewer}>
                Usa il testo aggiornato
              </button>
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
                onChange={(e) => {
                  setText(e.target.value);
                  editedRound.current = round;
                }}
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
