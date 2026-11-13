import React, { useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, MessageTemplates, ScheduledMatch, SeasonArchive, Settings } from '../../types';
import { RoundMatch, RoundSummary, addMatch, removeMatch, removeRound, swapColors } from '../../lib/rounds';
import { createChallenge } from '../../lib/lichess';
import { errorMessage } from '../../lib/utils';
import { deleteGamesFromFirebase } from '../../firebaseService';
import { LaunchMessage } from './LaunchMessage';
import { BulletinSection } from './BulletinSection';
import { RelinkPanel } from './RelinkPanel';
import { canRelink, linkState } from '../../lib/relink';
import { stateOf } from '../../lib/games';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;
type Panel = 'launch' | 'bulletin' | null;

// One round: its games (planned or created), the Lichess links and the WhatsApp messages
export function RoundDetail({
  round,
  summary,
  prev,
  next,
  onOpen,
  onBack,
  config,
  settings,
  templates,
  history,
  setHistory,
  gameStates = {},
  schedule,
  onUpdateSchedule,
  onCreated,
  nameOf,
  flash,
  triggerToast,
  onMissingToken,
  seasons = [],
  missingPledges = [],
}: {
  round: string;
  summary?: RoundSummary;
  prev?: string;
  next?: string;
  onOpen: (round: string) => void;
  onBack: () => void;
  config: AppConfig;
  settings: Settings;
  templates: MessageTemplates;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  // Fresh Lichess states from the sync, to tell an accepted challenge from an expired one
  gameStates?: Record<string, LichessExportGame>;
  schedule: ScheduledMatch[];
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  // Saves the games just created on Lichess in the tournament; false if saving failed
  onCreated: (games: HistoryGame[]) => Promise<boolean>;
  nameOf: (handle: string) => string;
  flash: Flash;
  triggerToast: (msg: string) => void;
  onMissingToken: () => void;
  seasons?: SeasonArchive[]; // archived seasons, for the Elo del torneo in the bulletin
  missingPledges?: string[]; // who has not accepted the rules yet (lib/pledges.ts): a confirmation, not a block
}) {
  const matches = summary?.matches ?? [];
  const created = summary?.created ?? 0;
  const todo = matches.filter((m) => !m.url);

  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  // The game whose link is being replaced, by its two players (the colors may change)
  const [relinking, setRelinking] = useState("");
  const pairKey = (m: { white: string; black: string }) => [m.white, m.black].sort().join("|");
  const [white, setWhite] = useState("");
  const [black, setBlack] = useState("");

  const used = new Set(matches.flatMap((m) => [m.white, m.black]));
  // A player who withdrew keeping the results is not resting: they no longer play
  const withdrawn = new Set((config.tournament?.withdrawals ?? []).filter((w) => w.mode === 'forfeit').map((w) => w.handle));
  const free = config.players.filter((p) => !used.has(p.handle) && !withdrawn.has(p.handle));
  const byes = free.map((p) => p.name);

  const add = () => {
    if (!white || !black) return flash("err", "Scegli il giocatore bianco e quello nero.");
    if (white === black) return flash("err", "Un giocatore non può sfidare se stesso.");
    onUpdateSchedule(addMatch(schedule, { round, white, black }));
    setWhite("");
    setBlack("");
    flash("ok", `Partita aggiunta al Turno ${round}.`);
  };

  const remove = async (m: RoundMatch) => {
    if (m.game) {
      if (
        !window.confirm(
          `Togliere ${nameOf(m.white)} – ${nameOf(m.black)} dal Turno ${round}?\n\n` +
            "La partita sparisce dal torneo e dalla pagina pubblica. La sfida su Lichess resta comunque aperta."
        )
      ) {
        return;
      }
      try {
        // Delete on Firestore first: otherwise the next sync would bring the game back
        await deleteGamesFromFirebase([m.game]);
        setHistory((prev) => prev.filter((g) => g !== m.game));
      } catch (e) {
        return flash("err", `Eliminazione non riuscita: ${errorMessage(e)}`);
      }
    } else if (!window.confirm(`Togliere ${nameOf(m.white)} – ${nameOf(m.black)} dal Turno ${round}?`)) {
      return;
    }
    if (m.scheduled) onUpdateSchedule(removeMatch(schedule, { round, white: m.white, black: m.black }));
    flash("ok", "Partita tolta dal turno.");
  };

  const deleteRound = async () => {
    const games = matches.flatMap((m) => (m.game ? [m.game] : []));
    if (
      !window.confirm(
        `Eliminare il Turno ${round} con tutte le sue ${matches.length} partite?` +
          (games.length ? "\n\nLe partite già create spariranno anche dalla pagina pubblica (su Lichess restano aperte)." : "")
      )
    ) {
      return;
    }
    try {
      if (games.length) {
        await deleteGamesFromFirebase(games);
        setHistory((prev) => prev.filter((g) => g.round !== round));
      }
      onUpdateSchedule(removeRound(schedule, round));
      flash("ok", `Turno ${round} eliminato.`);
      onBack();
    } catch (e) {
      flash("err", `Eliminazione non riuscita: ${errorMessage(e)}`);
    }
  };

  const createLinks = async () => {
    if (todo.length === 0) return;
    if (!settings.token) {
      onMissingToken();
      return flash("err", "Aggiungi prima il token API Lichess in Impostazioni → Token Lichess.");
    }
    if (
      missingPledges.length > 0 &&
      !window.confirm(
        `Non hanno ancora accettato il regolamento: ${missingPledges.join(", ")}.\n\nCreare lo stesso le sfide del Turno ${round}?`
      )
    )
      return;
    const games: HistoryGame[] = [];
    const errors: string[] = [];
    for (const [i, m] of todo.entries()) {
      setBusy(`Creazione partita ${i + 1} di ${todo.length} su Lichess…`);
      try {
        const url = await createChallenge(
          { white: m.white, black: m.black, url: "" },
          { round, settings, challengeName: config.challengeName }
        );
        games.push({ round, white: m.white, black: m.black, url, createdAt: Date.now() });
      } catch (e) {
        errors.push(
          `${nameOf(m.white)} – ${nameOf(m.black)}: ` +
            (e instanceof TypeError
              ? "errore di rete. Controlla la connessione a Internet o eventuali blocchi del browser."
              : errorMessage(e))
        );
      }
    }
    // Save what was created even if some challenges failed
    setBusy("Salvataggio nel torneo…");
    const saved = await onCreated(games);
    setBusy("");
    if (!saved) return;
    if (errors.length) {
      return flash(
        "err",
        "Alcune partite non sono state create. Correggi l'errore e premi di nuovo «Crea link Lichess»: quelle già create sono salvate.",
        errors
      );
    }
    flash("ok", "Link Lichess creati e salvati nel torneo.");
    setPanel("launch");
  };

  const status =
    matches.length === 0
      ? "Nessuna partita"
      : created === 0
        ? `${matches.length} ${matches.length === 1 ? "partita" : "partite"}, nessun link ancora`
        : created < matches.length
          ? `${created} di ${matches.length} partite con il link`
          : `${matches.length} ${matches.length === 1 ? "partita" : "partite"}, tutte su Lichess`;

  return (
    <section>
      <div className="round-nav">
        <button type="button" className="chip-link" onClick={onBack}>
          ← Tutti i turni
        </button>
        <div className="header-actions">
          <button type="button" className="chip-link" disabled={!prev} onClick={() => prev && onOpen(prev)} aria-label="Turno precedente">
            ‹
          </button>
          <button type="button" className="chip-link" disabled={!next} onClick={() => next && onOpen(next)} aria-label="Turno successivo">
            ›
          </button>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title">
          Turno {round} <span className="muted-normal">· {status}</span>
        </h2>

        {matches.length === 0 && (
          <p className="note note-flush">Turno nuovo: aggiungi le partite qui sotto. Viene salvato con la prima partita.</p>
        )}

        <div className="round-matches">
          {matches.map((m) => {
            const link = m.game && m.url ? linkState(m.game, stateOf(m.game, gameStates), settings.expiry) : null;
            // Stays open after a change, also when the new link is a game already started (to copy the message)
            const open = !!link && relinking === pairKey(m);
            return (
            <React.Fragment key={pairKey(m)}>
            <div className="list-row round-match">
              <div className="round-match-players">
                <span className="round-match-player">
                  <span className="dot w" aria-label="Bianco" /> {nameOf(m.white)}
                </span>
                <span className="round-match-player">
                  <span className="dot b" aria-label="Nero" /> {nameOf(m.black)}
                </span>
              </div>
              <div className="header-actions">
                {link && (link.kind === 'expired' || link.kind === 'void') && (
                  <span className="status-badge loss">{link.kind === 'expired' ? 'Scaduta' : 'Annullata'}</span>
                )}
                {link && canRelink(link) && (
                  <button
                    type="button"
                    className={`secondary btn-mini btn-mini-edit${open ? ' is-active' : ''}`}
                    title="Nuovo link"
                    aria-expanded={open}
                    aria-label={`Nuovo link per ${nameOf(m.white)} – ${nameOf(m.black)}`}
                    onClick={() => setRelinking(open ? "" : pairKey(m))}
                  >
                    🔁
                  </button>
                )}
                {m.url ? (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn">
                    Lichess ↗
                  </a>
                ) : (
                  <button
                    type="button"
                    className="secondary btn-mini"
                    title="Scambia i colori"
                    aria-label={`Scambia i colori di ${nameOf(m.white)} – ${nameOf(m.black)}`}
                    onClick={() => onUpdateSchedule(swapColors(schedule, { round, white: m.white, black: m.black }))}
                  >
                    ⇅
                  </button>
                )}
                <button
                  type="button"
                  className="secondary btn-mini"
                  title="Togli dal turno"
                  aria-label={`Togli ${nameOf(m.white)} – ${nameOf(m.black)} dal turno`}
                  onClick={() => remove(m)}
                >
                  ✕
                </button>
              </div>
            </div>
            {open && m.game && link && (
              <RelinkPanel
                game={m.game}
                link={link}
                challengeName={config.challengeName}
                settings={settings}
                nameOf={nameOf}
                flash={flash}
                onMissingToken={onMissingToken}
                onReplaced={(nextGame) =>
                  setHistory((prev) => [...prev.filter((g) => g !== m.game && g.url !== m.game!.url), nextGame])
                }
              />
            )}
            </React.Fragment>
            );
          })}
        </div>

        {matches.length > 0 && byes.length > 0 && <p className="note note-sm">Riposa: {byes.join(", ")}</p>}

        {free.length >= 2 && (
          <div className="add-form add-form-pair">
            <div>
              <label htmlFor="add-white">Bianco</label>
              <select id="add-white" value={white} onChange={(e) => setWhite(e.target.value)}>
                <option value="">Scegli…</option>
                {free.filter((p) => p.handle !== black).map((p) => (
                  <option key={p.handle} value={p.handle}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-black">Nero</label>
              <select id="add-black" value={black} onChange={(e) => setBlack(e.target.value)}>
                <option value="">Scegli…</option>
                {free.filter((p) => p.handle !== white).map((p) => (
                  <option key={p.handle} value={p.handle}>{p.name}</option>
                ))}
              </select>
            </div>
            <button type="button" className="secondary btn-add" onClick={add}>
              + Aggiungi
            </button>
          </div>
        )}
      </section>

      {todo.length > 0 && (
        <button className="primary btn-block mt-12" type="button" disabled={!!busy} onClick={createLinks}>
          {busy || `Crea link Lichess (${todo.length} ${todo.length === 1 ? "partita" : "partite"})`}
        </button>
      )}

      {created > 0 && (
        <>
          <div className="actions two">
            <button
              type="button"
              className={panel === 'launch' ? 'primary' : 'secondary'}
              aria-pressed={panel === 'launch'}
              onClick={() => setPanel(panel === 'launch' ? null : 'launch')}
            >
              💬 Messaggio con i link
            </button>
            <button
              type="button"
              className={panel === 'bulletin' ? 'primary' : 'secondary'}
              aria-pressed={panel === 'bulletin'}
              onClick={() => setPanel(panel === 'bulletin' ? null : 'bulletin')}
            >
              📊 Bollettino
            </button>
          </div>
          {panel === 'launch' && (
            <div className="result">
              <LaunchMessage
                round={round}
                matches={matches}
                byes={byes}
                config={config}
                settings={settings}
                templates={templates}
                nameOf={nameOf}
                flash={flash}
              />
            </div>
          )}
          {panel === 'bulletin' && (
            <div className="result">
              <BulletinSection
                round={round}
                history={history}
                config={config}
                expiryDays={settings.expiry}
                triggerToast={triggerToast}
                seasons={seasons}
              />
            </div>
          )}
        </>
      )}

      {matches.length > 0 && (
        <div className="actions">
          <button className="danger" type="button" onClick={deleteRound}>
            Elimina turno {round}
          </button>
        </div>
      )}
    </section>
  );
}
