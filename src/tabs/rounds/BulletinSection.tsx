import { useState, useEffect } from 'react';
import {
  AppConfig,
  HistoryGame,
  LichessExportGame,
} from '../../types';
import { errorMessage, fill, extractGameId, formatDeadline, HOW_WIN, HOW_DRAW, tidy, getApproxMoves } from '../../lib/utils';
import { leaderLine, roundDeadline, roundSummary } from '../../lib/bulletin';
import { computeStandings } from '../../lib/standings';
import { fetchGameStates } from '../../lib/lichess';
import { gamePhase, GamePhase } from '../../lib/phase';
import { upsetOf } from '../../lib/upset';
import { applyWithdrawals } from '../../lib/withdrawals';
import { summitGames, summitKey } from '../../lib/summit';

const PHASE_TEXT: Record<GamePhase, string> = {
  opening: 'in apertura',
  middlegame: 'nel mediogioco',
  endgame: 'nel finale',
};
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
  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;
  const idToHandle = (id?: string) =>
    config.players.find((p) => p.handle.toLowerCase() === String(id ?? "").toLowerCase())?.handle;

  const [text, setText] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });

  const buildStatusMessageInternal = (games: HistoryGame[], states: Record<string, LichessExportGame>) => {
    const count = { finished: 0, ongoing: 0, pending: 0 };
    const detailsList: string[] = [];
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

    // Deadline of the links not accepted yet (from the round's oldest created challenge)
    const deadlineMs = roundDeadline(games, expiryDays);
    const linkExpired = Date.now() > deadlineMs;

    // Saved results plus the fresh ones, for the standings
    const allStates: Record<string, LichessExportGame> = {};
    history.forEach((g) => {
      const gid = extractGameId(g.url);
      if (gid && g.lichess) allStates[gid] = g.lichess;
    });
    Object.assign(allStates, states);
    // Scontro al vertice: same rule as the badge on the site
    const summits = summitGames(config.players, history, allStates);

    const blocks = games.map((g, i) => {
      const id = extractGameId(g.url);
      // A game won by forfeit after a withdrawal has no Lichess link: its result is stored with it
      const s = id ? states[id] : g.lichess;
      const white = idToHandle(s?.players?.white?.user?.id) ?? g.white;
      const black = idToHandle(s?.players?.black?.user?.id) ?? g.black;
      const head = `${config.numberEmojis[i] ?? i + 1 + "."} *${nameOf(white)}* ⚪ vs *${nameOf(black)}* ⚫`;
      let body: string;
      const summit = summits.get(summitKey(g));

      if (!s) {
        count.pending++;
        body = linkExpired
          ? "Link scaduto: la sfida va ricreata 🔁"
          : fill(pickFor("pending"), { deadline: formatDeadline(deadlineMs) });
        detailsList.push(`${i + 1}. ${id}: non ancora trovata su Lichess (sfida non ancora accettata)`);
      } else if (s.status === "created" || s.status === "started") {
        count.ongoing++;
        // Lichess shows ongoing games 3 plies late (anti-cheat): whose turn it is and the deadline
        // cannot be known reliably, so the message gives only an approximate number of moves.
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const approx = getApproxMoves(plies);
        const lichessPhase = gamePhase(s);

        body = fill(pickFor("ongoing"), {
          approxMoves: approx.approxMoves,
          movesBand: approx.movesBand,
          // Lichess' own phase when available, the estimate from the number of moves otherwise
          phase: lichessPhase ? PHASE_TEXT[lichessPhase] : approx.phase,
          // Moves band plus the phase, the latter only when Lichess sent it
          progress: [approx.approxMoves, lichessPhase && PHASE_TEXT[lichessPhase]].filter(Boolean).join(", "),
        });

        detailsList.push(
          `${i + 1}. ${id}: bianco=${s.players?.white?.user?.name ?? "?"}, nero=${s.players?.black?.user?.name ?? "?"}, ` +
            `semimosse visibili via API=${plies} (Lichess ne nasconde fino a 3), ~${approx.approxMoves}, fase Lichess=${lichessPhase ?? "n/d"}`
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

        // Colpaccio: same rule as the badge on the site
        const upset = upsetOf(s);
        if (upset) {
          const winnerHandle = upset.winner === "white" ? white : black;
          const loserHandle = upset.winner === "white" ? black : white;
          const line = fill(pickFor("upset") || "💥 Colpaccio: {gap} punti Elo di differenza", {
            winner: nameOf(winnerHandle),
            loser: nameOf(loserHandle),
            gap: upset.gap,
          });
          body = `${body}\n${line}`;
        }

        detailsList.push(
          `${i + 1}. ${id}: stato ${s.status}, vincitore ${s.winner ?? "nessuno"}, mosse ${moves}, Elo bianco ${s.players?.white?.rating ?? "?"}${s.players?.white?.provisional ? "?" : ""}, Elo nero ${s.players?.black?.rating ?? "?"}${s.players?.black?.provisional ? "?" : ""}, apertura ${
            opening || "n/d"
          }`
        );
      }
      const summitLine = summit
        ? fill(pickFor("summit") || "🔝 Scontro al vertice: {positions} in classifica", { positions: summit })
        : "";
      return [head, summitLine, body].filter(Boolean).join("\n");
    });

    const isRoundComplete = games.length > 0 && count.finished === games.length;

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

    // At the end of the round, who leads (as on the site), from the saved results plus the fresh ones
    let leader = "";
    if (isRoundComplete) {
      leader = leaderLine(computeStandings(config.players, history, allStates).standings);
    }

    const vars = { round, ...count, summary: roundSummary(count) };
    const textResult = [
      fill(headerTemplate, vars),
      ...blocks,
      fill(footerTemplate, vars),
      leader,
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
