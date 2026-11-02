import React, { useState, useEffect } from 'react';
import {
  AppConfig,
  HistoryGame,
  LichessExportGame,
} from '../types';
import { errorMessage, fill, extractGameId, formatDeadline, HOW_WIN, HOW_DRAW, tidy, getApproxMoves } from '../lib/utils';
import { fetchGameStates } from '../lib/lichess';
import { WhatsAppPreview } from '../WhatsAppPreview';

export function StatusTab({
  history,
  setHistory,
  defaultDays,
  config,
  onLoadIntoActivePairs,
  triggerToast,
}: {
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  defaultDays: number;
  config: AppConfig;
  onLoadIntoActivePairs: (round: string, games: HistoryGame[]) => void;
  triggerToast?: (msg: string) => void;
}) {
  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;
  const idToHandle = (id?: string) =>
    config.players.find((p) => p.handle.toLowerCase() === String(id ?? "").toLowerCase())?.handle;

  const rounds = [...new Set(history.map((g) => g.round))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const [chosen, setChosen] = useState("");
  const round = rounds.includes(chosen) ? chosen : rounds[rounds.length - 1] ?? "";
  const [text, setText] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });
  const [showManage, setShowManage] = useState(false);

  const handleDeleteRound = (roundToDelete: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare tutte le partite del Turno ${roundToDelete}?`)) {
      setHistory((prev) => prev.filter((g) => g.round !== roundToDelete));
      if (chosen === roundToDelete) setChosen("");
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Attenzione: questo cancellerà TUTTO lo storico delle partite salvate. Continuare?")) {
      setHistory([]);
      setChosen("");
      setText("");
    }
  };

  const buildStatusMessageInternal = (games: HistoryGame[], states: Record<string, LichessExportGame>) => {
    const count = { finished: 0, ongoing: 0, pending: 0 };
    const detailsList: string[] = [];
    const finishedInfo: Array<{ names: string; moves: number }> = [];
    const finishedOpenings = new Map<string, string>();

    const used: Record<string, Set<number>> = {};
    const pickFor = (key: string): string => {
      const list = config.statusPhrases[key] ?? [];
      if (!list || list.length === 0) return "";
      const seen = (used[key] ??= new Set());
      if (seen.size >= list.length) seen.clear();
      let i: number;
      do {
        i = Math.floor(Math.random() * list.length);
      } while (seen.has(i));
      seen.add(i);
      return list[i];
    };

    const blocks = games.map((g, i) => {
      const id = extractGameId(g.url);
      const s = id ? states[id] : undefined;
      const white = idToHandle(s?.players?.white?.user?.id) ?? g.white;
      const black = idToHandle(s?.players?.black?.user?.id) ?? g.black;
      const head = `${config.numberEmojis[i] ?? i + 1 + "."} *${nameOf(white)}* ⚪ vs *${nameOf(black)}* ⚫`;
      let body: string;

      if (!s) {
        count.pending++;
        body = pickFor("pending");
        detailsList.push(`${i + 1}. ${id}: non ancora trovata su Lichess (sfida non ancora accettata)`);
      } else if (s.status === "created" || s.status === "started") {
        count.ongoing++;
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const fen = typeof s.lastFen === "string" ? s.lastFen.trim().split(/\s+/) : [];
        const hasFen = fen[1] === "w" || fen[1] === "b";
        const whiteToMove = hasFen ? fen[1] === "w" : plies % 2 === 0;
        const fenMove = parseInt(fen[5], 10);
        const move = hasFen && Number.isFinite(fenMove) ? fenMove : Math.floor(plies / 2) + 1;
        const days = s.daysPerTurn ?? defaultDays;
        const deadlineMs = (s.lastMoveAt ?? s.createdAt ?? Date.now()) + days * 86400000;

        const approx = getApproxMoves(plies);

        body = fill(pickFor("ongoing"), {
          move,
          turn: nameOf(whiteToMove ? white : black),
          approxMoves: approx.approxMoves,
          movesBand: approx.movesBand,
          phase: approx.phase,
          deadline: deadlineMs < Date.now() ? "adesso (tempo scaduto)" : formatDeadline(deadlineMs),
        });

        detailsList.push(
          `${i + 1}. ${id}: bianco=${s.players?.white?.user?.name ?? "?"}, nero=${s.players?.black?.user?.name ?? "?"}, ` +
            `semi-mosse=${plies} (~${approx.approxMoves}), tocca a=${whiteToMove ? "bianco" : "nero"}, ` +
            `ultimo movimento: ${s.lastMoveAt ? new Date(s.lastMoveAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "?"}`
        );
      } else if (s.status === "aborted" || s.status === "noStart") {
        body = pickFor("aborted");
        detailsList.push(`${i + 1}. ${id}: stato ${s.status}`);
      } else {
        count.finished++;
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const moves = Math.ceil(plies / 2);
        const movesText = moves > 0 ? `in ${moves} ${moves === 1 ? "mossa" : "mosse"}` : "";
        const opening = s.opening?.name ?? "";
        const mainOpening = opening.split(":")[0].trim();
        if (mainOpening) {
          const studyUrl = `https://lichess.org/study/search?q=${encodeURIComponent(mainOpening)}&order=popular`;
          finishedOpenings.set(mainOpening, studyUrl);
        }
        const openingNote = opening ? `♟️ Apertura: ${opening}` : "";
        const common = { moves, opening, mainOpening, openingNote };
        const won = s.winner === "white" || s.winner === "black";

        if (won) {
          const winnerHandle = s.winner === "white" ? white : black;
          const loserHandle = s.winner === "white" ? black : white;
          const color = s.winner === "white" ? "col bianco" : "col nero";
          const how = HOW_WIN[s.status] ?? "";
          body = tidy(
            fill(pickFor("win"), {
              ...common,
              winner: nameOf(winnerHandle),
              loser: nameOf(loserHandle),
              result: s.winner === "white" ? "1-0" : "0-1",
              color,
              how,
              details: [color, how, movesText].filter(Boolean).join(" "),
            })
          );
        } else {
          const how = HOW_DRAW[s.status] ?? "";
          body = tidy(
            fill(pickFor("draw"), {
              ...common,
              result: "½-½",
              how,
              details: [how, movesText].filter(Boolean).join(" "),
            })
          );
        }

        // Guarantee opening is included whenever Lichess detected it
        if (opening && !body.includes(opening)) {
          body = `${body}\n${openingNote}`;
        }

        finishedInfo.push({ names: `${nameOf(white)}–${nameOf(black)}`, moves });
        detailsList.push(
          `${i + 1}. ${id}: stato ${s.status}, vincitore ${s.winner ?? "nessuno"}, mosse ${moves}, apertura ${
            opening || "n/d"
          }`
        );
      }
      return `${head}\n${body}`;
    });

    const isRoundComplete = games.length > 0 && count.finished === games.length;

    let highlight = "";
    const timed = finishedInfo.filter((x) => x.moves > 0).sort((a, b) => a.moves - b.moves);
    if (
      isRoundComplete &&
      config.statusPhrases.highlight &&
      timed.length >= 2 &&
      timed[0].moves !== timed[timed.length - 1].moves
    ) {
      const label = (x: { names: string; moves: number }) => `${x.names} (${x.moves} mosse)`;
      highlight = fill(pickFor("highlight"), {
        longest: label(timed[timed.length - 1]),
        shortest: label(timed[0]),
      });
    }

    const headerTemplate =
      isRoundComplete && config.statusPhrases.roundEndHeader && config.statusPhrases.roundEndHeader.length > 0
        ? pickFor("roundEndHeader")
        : pickFor("header");

    const footerTemplate =
      isRoundComplete && config.statusPhrases.roundEndFooter && config.statusPhrases.roundEndFooter.length > 0
        ? pickFor("roundEndFooter")
        : pickFor("footer");

    let studiesAppendix = "";
    if (isRoundComplete && finishedOpenings.size > 0) {
      const items = Array.from(finishedOpenings.entries()).map(
        ([name, url]) => `• ${name}: ${url}`
      );
      studiesAppendix = `📚 *Studi consigliati per le aperture del turno:*\n${items.join("\n")}`;
    }

    const textResult = [
      fill(headerTemplate, { round, ...count }),
      ...blocks,
      fill(footerTemplate, { round, ...count }),
      highlight,
      config.statusPhrases.closing && config.statusPhrases.closing.length > 0 ? pickFor("closing") : "",
      studiesAppendix,
      isRoundComplete && config.statusPhrases.infoLine ? config.statusPhrases.infoLine : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return { text: textResult, details: detailsList, isComplete: isRoundComplete };
  };

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
      const ids = games.map((g) => extractGameId(g.url)).filter((id): id is string => Boolean(id));
      const states = await fetchGameStates(ids);
      const built = buildStatusMessageInternal(games, states);
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
      <h2>Stato e Risultati Partite</h2>
      {rounds.length === 0 ? (
        <p className="note">
          Nessuna partita memorizzata. Crea un turno nella scheda <strong>Partite</strong> per monitorarne lo stato in tempo reale.
        </p>
      ) : (
        <>
          <div className="round-picker-row status-picker">
            <div className="flex-1">
              <label htmlFor="status-round">Seleziona Turno</label>
              <select id="status-round" value={round} onChange={(e) => setChosen(e.target.value)}>
                {rounds.map((r) => {
                  const count = history.filter((g) => g.round === r).length;
                  return (
                    <option key={r} value={r}>
                      Turno {r} ({count} {count === 1 ? 'partita' : 'partite'})
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              className="secondary btn-add"
              type="button"
              disabled={status.busy}
              onClick={() => loadStatusForRound(round)}
            >
              {status.busy ? "Verifica in corso…" : "🔄 Aggiorna da Lichess"}
            </button>
          </div>

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
            </>
          )}
        </>
      )}

      {/* Archivio Compatto turni salvati */}
      {rounds.length > 0 && (
        <details className="manage-rounds" open={showManage} onToggle={(e) => setShowManage((e.target as HTMLDetailsElement).open)}>
          <summary className="summary-muted">
            🗂️ Archivio e pulizia turni ({rounds.length} {rounds.length === 1 ? 'turno' : 'turni'})
          </summary>
          <div className="body mt-10">
            {rounds.map((r) => {
              const roundGames = history.filter((g) => g.round === r);
              return (
                <div key={r} className="round-card mb-10">
                  <div className="round-header">
                    <strong>Turno {r}</strong>
                    <div className="header-actions">
                      <button
                        className="secondary btn-sm"
                        type="button"
                        onClick={() => onLoadIntoActivePairs(r, roundGames)}
                      >
                        Carica in Partite
                      </button>
                      <button
                        className="danger btn-sm"
                        type="button"
                        onClick={() => handleDeleteRound(r)}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="reset-row mt-12">
              <button
                type="button"
                className="link-danger sm"
                onClick={handleClearAllHistory}
              >
                Cancella tutto lo storico salvato
              </button>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
