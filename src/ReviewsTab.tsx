import React, { useState, useEffect } from "react";
import { AppConfig, HistoryGame, LichessExportGame, NoticeState, PlayerStanding } from "./types";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { errorMessage, extractGameId } from "./lib/utils";
import { computeStandings } from "./lib/standings";
import type { LichessUserProfile } from "./types";
import type { OrganizerStore } from "./hooks/useOrganizerData";

interface ReviewsTabProps {
  history: HistoryGame[];
  config: AppConfig;
  nameOf: (handle: string) => string;
  triggerToast?: (msg: string) => void;
  organizer: OrganizerStore;
}

export type ReviewMoment = "andata" | "volata" | "finale";

export function ReviewsTab({ history, config, nameOf, triggerToast, organizer }: ReviewsTabProps) {
  const [reviewType, setReviewType] = useState<ReviewMoment>("finale");
  const tournamentTitle = config.tournament?.title || "Scacchi & Chill";
  const [generalNotes, setGeneralNotes] = useState("");
  
  // Anecdotes and ratings live in the private Firestore document (see useOrganizerData)
  const { anecdotes, ratings, setAnecdote, setRatings } = organizer;

  const [gameStates, setGameStates] = useState<Record<string, LichessExportGame>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [generatedReview, setGeneratedReview] = useState("");
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isFetchingElo, setIsFetchingElo] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [showAnecdotes, setShowAnecdotes] = useState(false);
  const [showStandingsTable, setShowStandingsTable] = useState(false);

  // Fetch Lichess game states for all saved games
  const loadGameStates = async () => {
    setIsFetchingData(true);
    setNotice(null);
    try {
      const ids = history
        .map((g) => extractGameId(g.url))
        .filter((id): id is string => Boolean(id));

      if (ids.length === 0) {
        setIsFetchingData(false);
        setNotice({
          kind: "warning",
          text: "Nessuna partita salvata nello storico. Crea prima i link di un turno in Turni.",
        });
        return;
      }

      const res = await fetch(
        "https://lichess.org/api/games/export/_ids?pgnInJson=false&lastFen=true&opening=true",
        {
          method: "POST",
          headers: { "Content-Type": "text/plain", Accept: "application/x-ndjson" },
          body: ids.join(","),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const states: Record<string, LichessExportGame> = {};
      text
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => {
          try {
            const g = JSON.parse(line);
            if (g.id) states[g.id] = g;
          } catch {}
        });

      setGameStates(states);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setLastSyncTime(timeStr);
      setNotice({
        kind: "ok",
        text: `Dati di ${Object.keys(states).length} partite sincronizzati con successo da Lichess (ore ${timeStr}).`,
      });
    } catch (e) {
      setNotice({
        kind: "warning",
        text: "Impossibile scaricare gli stati da Lichess: " + errorMessage(e),
      });
    } finally {
      setIsFetchingData(false);
    }
  };

  // Auto-fetch game states on first load if we have history
  useEffect(() => {
    if (history.length > 0 && Object.keys(gameStates).length === 0) {
      loadGameStates();
    }
  }, [history.length]);

  // Fetch correspondence Elo for all players directly from Lichess API (CORS enabled)
  const fetchAllRatings = async () => {
    setIsFetchingElo(true);
    setNotice(null);
    const updated: Record<string, string | number | null> = { ...ratings };
    let successCount = 0;

    for (const player of config.players) {
      try {
        let data: LichessUserProfile | null = null;
        try {
          const directRes = await fetch(
            `https://lichess.org/api/user/${encodeURIComponent(player.handle)}`,
            { headers: { Accept: "application/json" } }
          );
          if (directRes.ok) {
            data = await directRes.json();
          }
        } catch {}

        if (data) {
          const perfs = data.perfs || {};
          const corr = perfs.correspondence;
          const rap = perfs.rapid;
          const clas = perfs.classical;

          if (corr && typeof corr.rating === "number") {
            const provSuffix = corr.prov ? "?" : "";
            updated[player.handle] = `${corr.rating}${provSuffix}`;
            successCount++;
          } else if (rap && typeof rap.rating === "number" && (rap.games ?? 0) > 0) {
            const provSuffix = rap.prov ? "?" : "";
            updated[player.handle] = `${rap.rating}${provSuffix} [rapid]`;
            successCount++;
          } else if (clas && typeof clas.rating === "number" && (clas.games ?? 0) > 0) {
            const provSuffix = clas.prov ? "?" : "";
            updated[player.handle] = `${clas.rating}${provSuffix} [classical]`;
            successCount++;
          } else {
            updated[player.handle] = null;
          }
        }
      } catch (err) {
        console.warn(`Errore recupero Elo per ${player.handle}:`, err);
      }
    }

    setRatings(updated);
    setIsFetchingElo(false);
    if (successCount > 0) {
      setNotice({
        kind: "ok",
        text: `Elo Lichess aggiornato per ${successCount} su ${config.players.length} giocatori.`,
      });
    } else {
      setNotice({
        kind: "warning",
        text: "Nessun dato Elo recuperato da Lichess. Verifica la connessione a internet.",
      });
    }
  };

  // Calculate Standings & Game Summary
  const calculateStandings = (): {
    standings: PlayerStanding[];
    finishedMatches: Array<{ round: string; white: string; black: string; result: string; winner?: string; moves?: number; opening?: string }>;
    ongoingMatches: Array<{ white: string; black: string; round: string }>;
  } => {
    const finishedMatches: Array<{
      round: string;
      white: string;
      black: string;
      result: string;
      winner?: string;
      moves?: number;
      opening?: string;
    }> = [];

    const ongoingMatches: Array<{ white: string; black: string; round: string }> = [];

    history.forEach((g) => {
      const id = extractGameId(g.url);
      const s = id ? gameStates[id] : undefined;
      const white = g.white;
      const black = g.black;

      if (!s) {
        ongoingMatches.push({ white, black, round: g.round });
        return;
      }

      if (s.status === "created" || s.status === "started") {
        ongoingMatches.push({ white, black, round: g.round });
      } else if (s.status !== "aborted" && s.status !== "noStart") {
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const moves = Math.ceil(plies / 2);
        const opening = s.opening?.name;

        if (s.winner === "white") {
          finishedMatches.push({ round: g.round, white, black, result: "1-0", winner: white, moves, opening });
        } else if (s.winner === "black") {
          finishedMatches.push({ round: g.round, white, black, result: "0-1", winner: black, moves, opening });
        } else {
          finishedMatches.push({ round: g.round, white, black, result: "½-½", moves, opening });
        }
      }
    });

    // Same order as the public standings (points, Sonneborn-Berger, wins, name)
    const official = computeStandings(config.players, history, gameStates).standings;
    const standings: PlayerStanding[] = official.map((p) => ({
      handle: p.handle,
      name: p.name,
      played: p.played,
      won: p.won,
      drawn: p.drawn,
      lost: p.lost,
      points: p.points,
      rating: ratings[p.handle],
      anecdote: anecdotes[p.handle] || "",
    }));

    return { standings, finishedMatches, ongoingMatches };
  };

  const { standings, finishedMatches, ongoingMatches } = calculateStandings();

  // Count players with loaded rating
  const ratedCount = standings.filter((s) => s.rating).length;

  // Recommended moment based on match numbers
  const getRecommendedMoment = (): ReviewMoment => {
    if (ongoingMatches.length === 0 && finishedMatches.length > 0) return "finale";
    if (ongoingMatches.length > 0 && ongoingMatches.length <= 3) return "volata";
    return "andata";
  };

  // Prompt for the review: a friend telling the season, sober and kind to every player.
  // Short, positive instructions and no catalog of examples (models copy them verbatim);
  // personal facts come only from the organizer's notes, never from this code.
  const buildPrompt = () => {
    const lines: string[] = [];
    const add = (...l: string[]) => lines.push(...l);

    add(
      `Scrivi un messaggio WhatsApp per il gruppo del torneo di scacchi tra amici "${tournamentTitle}".`,
      `Racconta la stagione come farebbe un amico del gruppo, non un telecronista.`,
      ``,
      `TONO`,
      `- Ironia leggera e affettuosa, frasi asciutte. Niente superlativi in serie, niente parole come "epico", "leggenda", "eroe", "impresa storica".`,
      `- Ogni giocatore, dal primo all'ultimo, deve potersi rileggere volentieri. Racconta cosa è successo sulla scacchiera, non giudicare le persone.`,
      `- Parla dei risultati per quello che sono (una patta combattuta, una partita lunga, una vittoria netta, una rimonta). Non dividere i giocatori in forti e deboli e non usare la retorica dello sfavorito.`,
      `- L'Elo qui sotto è solo contesto per te: non citarlo e non fare confronti di Elo nel testo.`,
      `- Gli aneddoti personali vanno usati solo se scritti nelle note, al massimo uno per giocatore e solo se si inserisce in modo naturale.`,
      `- Poche emoji, e mai numeri in stile voto.`,
      ``,
      `IL PEZZO DI OGNI GIOCATORE`,
      `- Accanto al nome metti il simbolo di un pezzo (♔ ♕ ♖ ♗ ♘ ♙) che gli somiglia per come ha giocato in questa stagione, letto dai dati: partite lunghe, aperture ricorrenti, attacchi, patte, costanza.`,
      `- Non scrivere "pezzo guida" né spiegare il simbolo in un'etichetta: il motivo deve capirsi da mezza frase dentro il testo.`,
      `- Pezzi diversi per giocatori diversi quando possibile; il Re non è riservato al primo.`,
      ``,
      `FORMATO`,
      `- Testo per WhatsApp: *grassetto* per i nomi, _corsivo_ con parsimonia, paragrafi brevi separati da una riga vuota.`,
      `- Per ogni giocatore 2 o 3 frasi, nell'ordine della classifica, con la riga: <simbolo> *Posizione. Nome*`,
    );

    if (reviewType === "andata") {
      add(
        ``,
        `MOMENTO: fine del girone d'andata.`,
        `- Apri con una riga di titolo e una o due frasi su come è andata l'andata nel complesso.`,
        `- Poi i giocatori, come sopra.`,
        `- Chiudi con una frase sul ritorno, senza promesse di grandi emozioni.`,
      );
    } else if (reviewType === "volata") {
      add(
        ``,
        `MOMENTO: ultime partite della stagione (${ongoingMatches.length || "poche"} ancora da finire).`,
        `- Niente schede per giocatore: racconta in pochi paragrafi cosa è ancora in gioco in testa, per il podio e nel resto della classifica.`,
        `- Cita le partite ancora aperte qui sotto e i giocatori coinvolti, senza caricare le attese su chi le gioca.`,
        `- Chiudi con un augurio di buon gioco, in una frase.`,
      );
    } else {
      add(
        ``,
        `MOMENTO: fine della stagione, tutte le partite concluse.`,
        `- Apri con una riga di titolo e una o due frasi sulla stagione, poi il campione in una frase semplice.`,
        `- Poi i giocatori, come sopra.`,
        `- In fondo, se i dati lo permettono, al massimo 2 o 3 menzioni per tutto il gruppo (per esempio la partita più lunga o la patta più combattuta), preferibilmente non per i primi tre.`,
        `- Chiudi con un grazie a tutti, in una frase.`,
      );
    }

    if (generalNotes.trim()) add(``, `NOTE DELL'ORGANIZZATORE`, generalNotes.trim());

    add(``, `CLASSIFICA (ordine ufficiale del sito, spareggio Sonneborn-Berger)`);
    standings.forEach((st, idx) => {
      const elo = st.rating ? `Elo ~${st.rating}` : `Elo n/d`;
      const note = st.anecdote ? ` | Nota: "${st.anecdote}"` : "";
      add(`${idx + 1}. ${st.name} (@${st.handle}) – ${st.points} punti: ${st.won} vinte, ${st.drawn} patte, ${st.lost} perse su ${st.played} giocate [${elo}]${note}`);
    });

    add(``, `PARTITE CONCLUSE`);
    if (finishedMatches.length === 0) add(`Nessuna partita ancora conclusa.`);
    finishedMatches.forEach((m) => {
      const op = m.opening ? `, apertura ${m.opening}` : "";
      const mv = m.moves ? `, ${m.moves} mosse` : "";
      add(`- Turno ${m.round}: ${nameOf(m.white)} (bianco) – ${nameOf(m.black)} (nero) ${m.result}${mv}${op}`);
    });

    if (ongoingMatches.length > 0) {
      add(``, `PARTITE ANCORA APERTE`);
      ongoingMatches.forEach((m) => add(`- Turno ${m.round}: ${nameOf(m.white)} – ${nameOf(m.black)}`));
    }

    return lines.join("\n") + "\n";
  };

  // Copy full prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      const prompt = buildPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      if (triggerToast) {
        triggerToast("Prompt copiato negli appunti! 📋 Pronto per Claude/ChatGPT");
      }
      setNotice({
        kind: "ok",
        text: "📋 Prompt completo copiato negli appunti! Ora puoi incollarlo direttamente nella tua chat con Claude o ChatGPT.",
      });
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      setNotice({ kind: "err", text: "Impossibile copiare automaticamente il prompt negli appunti." });
    }
  };

  // Download raw JSON
  const handleDownloadJson = () => {
    const data = {
      tournament: tournamentTitle,
      reviewType,
      exportedAt: new Date().toISOString(),
      standings,
      finishedMatches,
      ongoingMatches,
      generalNotes,
    };
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torneo-${tournamentTitle.toLowerCase().replace(/\s+/g, "-")}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy generated review
  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(generatedReview);
      setCopiedReview(true);
      if (triggerToast) {
        triggerToast("Testo della recensione copiato negli appunti! 📋");
      }
      setTimeout(() => setCopiedReview(false), 2500);
    } catch {}
  };

  const recommended = getRecommendedMoment();

  return (
    <section>
      <h2>✨ Il racconto della stagione</h2>
      <p className="note mb-14">
        Prepara il racconto di fine andata, delle ultime partite o di fine stagione: tono sobrio e affettuoso, senza voti né classifiche di bravura.
      </p>

      {notice && (
        <div className={`notice ${notice.kind} mb-14`}>
          {notice.text}
        </div>
      )}

      {/* QUADRO STATO DATI TORNEO */}
      <div className="sync-dashboard">
        <div className="sync-header">
          <div className="inline-row">
            <strong className="fs-14">📊 Stato Dati Torneo</strong>
            <span className={`sync-badge ${lastSyncTime ? "synced" : "pending"}`}>
              {lastSyncTime ? `● Sincronizzato alle ${lastSyncTime}` : "⏳ Da sincronizzare"}
            </span>
          </div>
          <button
            type="button"
            className="secondary btn-compact"
            disabled={isFetchingData}
            onClick={loadGameStates}
          >
            {isFetchingData ? "Aggiornamento in corso…" : "🔄 Sincronizza Partite"}
          </button>
        </div>

        <div className="stat-pills">
          <div className="stat-pill">
            <span className="stat-pill-label">Partite Totali</span>
            <span className="stat-pill-val">
              {history.length} <small className="muted-normal">({finishedMatches.length} finite, {ongoingMatches.length} in corso)</small>
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Elo Lichess</span>
            <span className="stat-pill-val">
              {ratedCount} / {config.players.length} <small className="muted-normal">giocatori</small>
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Fase Rilevata</span>
            <span className="stat-pill-val accent">
              {recommended === "finale" ? "🏆 Concluso" : recommended === "volata" ? "⏱️ Volata" : "🔄 Andata"}
            </span>
          </div>
        </div>

        <div className="space-row mt-8">
          <button
            type="button"
            className="secondary btn-compact xs"
            disabled={isFetchingElo}
            onClick={fetchAllRatings}
          >
            {isFetchingElo ? "Recupero Elo in corso..." : "♟️ Scarica Elo da Lichess"}
          </button>
          <button
            type="button"
            className="link-muted"
            onClick={() => setShowStandingsTable(!showStandingsTable)}
          >
            {showStandingsTable ? "Nascondi classifica rapida ▲" : "Vedi classifica calcolata ▼"}
          </button>
        </div>

        {/* Quick Standings Table */}
        {showStandingsTable && (
          <div className="quick-standings">
            <p className="note note-xs">
              Classifica calcolata dalle partite salvate nello storico:
            </p>
            <div className="quick-standings-list">
              {standings.map((s, idx) => (
                <div
                  key={s.handle}
                  className="quick-standings-row"
                >
                  <span>
                    <strong>{idx + 1}. {s.name}</strong> <small className="muted">({s.handle})</small>
                  </span>
                  <span>
                    <strong>{s.points} pt</strong> ({s.won}V {s.drawn}N {s.lost}P) · {s.rating ? `~${s.rating}` : "no elo"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOMENTO DEL TORNEO (3 PULSANTI CHIAVE) */}
      <div className="mb-14">
        <label>Momento del Torneo</label>
        <div className="review-types-3">
          <button
            type="button"
            className={`review-moment-btn ${reviewType === "andata" ? "active" : ""}`}
            onClick={() => setReviewType("andata")}
          >
            <span className="review-moment-title">🔄 Fine Andata</span>
            <span className="review-moment-sub">Com'è andata l'andata, due o tre frasi per giocatore.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "volata" ? "active" : ""}`}
            onClick={() => setReviewType("volata")}
          >
            <span className="review-moment-title">⏱️ Volata Finale</span>
            <span className="review-moment-sub">Cosa resta in gioco nelle ultime partite.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "finale" ? "active" : ""}`}
            onClick={() => setReviewType("finale")}
          >
            <span className="review-moment-title">🏆 Fine Torneo</span>
            <span className="review-moment-sub">Il racconto finale, il campione e poche menzioni per il gruppo.</span>
          </button>
        </div>
      </div>

      {/* Tournament Settings */}
      <div className="mb-12">
        <div>
          <label htmlFor="rev-general-notes">Note extra dell'organizzatore (opzionale)</label>
          <input
            id="rev-general-notes"
            type="text"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="es. Tante partite decise nel finale, ritmo rilassato..."
          />
        </div>
      </div>

      {/* Accordion for Player Anecdotes & Elo */}
      <div className="mb-18">
        <div className="space-row mb-6">
          <label className="m-0">Aneddoti personali dei giocatori ({config.players.length})</label>
          <button
            type="button"
            className="secondary btn-compact xs"
            onClick={() => setShowAnecdotes(!showAnecdotes)}
          >
            {showAnecdotes ? "Chiudi note ▲" : "Modifica note ▼"}
          </button>
        </div>

        {showAnecdotes && (
          <div className="anecdote-grid">
            <p className="note note-13">
              Piccoli fatti o battute che il giocatore sarebbe contento di rileggere nel gruppo (es. gioca solo di notte, ha cambiato apertura). Vengono usati solo se si inseriscono in modo naturale:
            </p>
            {standings.map((p) => (
              <div key={p.handle} className="anecdote-card">
                <div className="anecdote-card-header">
                  <strong>
                    {p.name} <span className="muted-normal">({p.handle})</span>
                  </strong>
                  <span className="rating-badge">
                    {p.rating ? `Elo ~${p.rating}` : "Elo n/d"} · {p.points} pt
                  </span>
                </div>
                <input
                  type="text"
                  className="anecdote-input"
                  value={anecdotes[p.handle] || ""}
                  onChange={(e) => setAnecdote(p.handle, e.target.value)}
                  placeholder={`Aneddoto per ${p.name} (es. papà da poco, gioca solo di notte...)`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons: Copia Prompt is the primary frictionless action */}
      <div className="actions mb-12">
        <button
          type="button"
          className="primary"
          onClick={handleCopyPrompt}
        >
          {copiedPrompt ? "✅ Prompt Copiato!" : "📋 Copia Prompt per Claude / ChatGPT"}
        </button>
      </div>

      <div className="space-row mb-16">
        <p className="note sync-note">
          💡 Copia il prompt, incollalo nella tua chat AI abituale e poi incolla qui sotto la recensione ottenuta per vedere l'anteprima WhatsApp.
        </p>
        <button
          type="button"
          className="link-muted nowrap"
          onClick={handleDownloadJson}
        >
          💾 Scarica JSON
        </button>
      </div>

      {/* Review pasted from the AI chat: preview and share */}
      <div className="mt-16">
        <label htmlFor="generated-review-text">Recensione ricevuta dall'AI</label>
        <textarea
          id="generated-review-text"
          value={generatedReview}
          onChange={(e) => setGeneratedReview(e.target.value)}
          rows={10}
          className="ta-xl"
          placeholder="Incolla qui il testo generato da Claude o ChatGPT…"
        />

        {generatedReview.trim() && (
          <>
            <WhatsAppPreview text={generatedReview} title="Anteprima WhatsApp" />

            <div className="actions two mt-10">
              <a
                className="primary"
                target="_blank"
                rel="noopener noreferrer"
                href={"https://wa.me/?text=" + encodeURIComponent(generatedReview)}
              >
                📲 Condividi su WhatsApp
              </a>
              <button type="button" className="secondary" onClick={handleCopyReview}>
                {copiedReview ? "✅ Copiato!" : "📋 Copia Testo"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
