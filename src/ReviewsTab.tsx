import React, { useState, useEffect } from "react";
import { AppConfig, HistoryGame, LichessExportGame, NoticeState, PlayerStanding } from "./types";

interface ReviewsTabProps {
  history: HistoryGame[];
  config: AppConfig;
  nameOf: (handle: string) => string;
}

export type ReviewMoment = "andata" | "volata" | "finale";

export function ReviewsTab({ history, config, nameOf }: ReviewsTabProps) {
  const [reviewType, setReviewType] = useState<ReviewMoment>("finale");
  const [tournamentTitle, setTournamentTitle] = useState("Scacchi & Chill");
  const [generalNotes, setGeneralNotes] = useState("");
  
  // Anecdotes per player: handle -> note
  const [anecdotes, setAnecdotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("scacchi.anecdotes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Ratings per player: handle -> rating
  const [ratings, setRatings] = useState<Record<string, string | number | null>>(() => {
    try {
      const saved = localStorage.getItem("scacchi.ratings");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [gameStates, setGameStates] = useState<Record<string, LichessExportGame>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [generatedReview, setGeneratedReview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isFetchingElo, setIsFetchingElo] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [showAnecdotes, setShowAnecdotes] = useState(false);
  const [showStandingsTable, setShowStandingsTable] = useState(false);

  // Save anecdotes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("scacchi.anecdotes", JSON.stringify(anecdotes));
    } catch {}
  }, [anecdotes]);

  // Save ratings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("scacchi.ratings", JSON.stringify(ratings));
    } catch {}
  }, [ratings]);

  // Extract game ID helper
  const extractGameId = (url: string) => {
    const m = url.match(/lichess\.org\/(?:(?:game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})/);
    return m ? m[1] : null;
  };

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
          text: "Nessuna partita salvata nello storico. Crea o carica prima dei turni nella scheda Partite o Stato.",
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
    } catch (e: any) {
      setNotice({
        kind: "warning",
        text: "Impossibile scaricare gli stati da Lichess: " + e.message,
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
        let data: any = null;
        try {
          const directRes = await fetch(
            `https://lichess.org/api/user/${encodeURIComponent(player.handle)}`,
            { headers: { Accept: "application/json" } }
          );
          if (directRes.ok) {
            data = await directRes.json();
          }
        } catch {}

        if (!data) {
          try {
            const proxyRes = await fetch(`/api/lichess-user/${encodeURIComponent(player.handle)}`);
            if (proxyRes.ok) {
              data = await proxyRes.json();
            }
          } catch {}
        }

        if (data) {
          const perfs = data.perfs || {};
          const corr = perfs.correspondence;
          const rap = perfs.rapid;
          const clas = perfs.classical;

          if (corr && typeof corr.rating === "number") {
            const provSuffix = corr.prov ? "?" : "";
            updated[player.handle] = `${corr.rating}${provSuffix}`;
            successCount++;
          } else if (rap && typeof rap.rating === "number" && rap.games > 0) {
            const provSuffix = rap.prov ? "?" : "";
            updated[player.handle] = `${rap.rating}${provSuffix} [rapid]`;
            successCount++;
          } else if (clas && typeof clas.rating === "number" && clas.games > 0) {
            const provSuffix = clas.prov ? "?" : "";
            updated[player.handle] = `${clas.rating}${provSuffix} [classical]`;
            successCount++;
          } else {
            updated[player.handle] = null;
          }
        }
      } catch (err: any) {
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
    finishedMatches: Array<{ white: string; black: string; result: string; winner?: string; moves?: number; opening?: string }>;
    ongoingMatches: Array<{ white: string; black: string; round: string }>;
  } => {
    const stats: Record<
      string,
      { played: number; won: number; drawn: number; lost: number; points: number }
    > = {};

    config.players.forEach((p) => {
      stats[p.handle] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
    });

    const finishedMatches: Array<{
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

      if (!stats[white]) stats[white] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
      if (!stats[black]) stats[black] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };

      if (!s) {
        ongoingMatches.push({ white, black, round: g.round });
        return;
      }

      if (s.status === "created" || s.status === "started") {
        ongoingMatches.push({ white, black, round: g.round });
      } else if (s.status !== "aborted" && s.status !== "noStart") {
        stats[white].played++;
        stats[black].played++;

        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const moves = Math.ceil(plies / 2);
        const opening = s.opening?.name;

        if (s.winner === "white") {
          stats[white].won++;
          stats[white].points += 1;
          stats[black].lost++;
          finishedMatches.push({ white, black, result: "1-0", winner: white, moves, opening });
        } else if (s.winner === "black") {
          stats[black].won++;
          stats[black].points += 1;
          stats[white].lost++;
          finishedMatches.push({ white, black, result: "0-1", winner: black, moves, opening });
        } else {
          stats[white].drawn++;
          stats[white].points += 0.5;
          stats[black].drawn++;
          stats[black].points += 0.5;
          finishedMatches.push({ white, black, result: "½-½", moves, opening });
        }
      }
    });

    const standings: PlayerStanding[] = config.players
      .map((p) => ({
        handle: p.handle,
        name: p.name,
        played: stats[p.handle]?.played ?? 0,
        won: stats[p.handle]?.won ?? 0,
        drawn: stats[p.handle]?.drawn ?? 0,
        lost: stats[p.handle]?.lost ?? 0,
        points: stats[p.handle]?.points ?? 0,
        rating: ratings[p.handle],
        anecdote: anecdotes[p.handle] || "",
      }))
      .sort((a, b) => b.points - a.points || b.won - a.won || a.name.localeCompare(b.name));

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

  // Build the sober, witty, non-sensationalist AI prompt
  const buildPrompt = () => {
    let p = `Sei il cronista del torneo amatoriale di scacchi tra amici "${tournamentTitle}".\n`;
    p += `Devi scrivere un resoconto per il nostro gruppo WhatsApp.\n\n`;

    p += `LINEE GUIDA GENERALI SU TONO E STILE:\n`;
    p += `- Tono: Sobrio, pungente, autoironico e brillante tra amici. NIENTE sensazionalismo finto, niente enfasi da circo o trailer cinematografici ("epico torneo", "campionato che passerà alla storia", "tiranno crudele"). Mantieni i piedi per terra: siamo un gruppo di amici che giocano a scacchi online.\n`;
    p += `- Umorismo: arguto, sottile, con battute su sviste scacchistiche reali, pezzi regalati, partite durate 50 mosse, orari notturni e aneddoti di vita quotidiana (es. notti insonni, paternità, impegni).\n`;
    p += `- Formattazione: WhatsApp pulita (*grassetto*, _corsivo_ per i voti, emoji sobrie e mirate, elenchi ben spaziati).\n\n`;

    if (reviewType === "andata") {
      p += `CONTESTO SPECIFICO: GIRO DI BOA / FINE GIRONE D'ANDATA (7 partite disputate)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo sobrio ed efficace: 🔄 *Giro di boa: Il bilancio dell'andata di "${tournamentTitle}"*\n`;
      p += `2. Breve premessa di 2-3 righe: si è chiusa l'andata, un primo sguardo a chi ha sorpreso e a chi deve ancora ingranare.\n`;
      p += `3. Per OGNI giocatore della classifica (dal primo all'ultimo):\n`;
      p += `   * *#Posizione Nome (@handle) – Soprannome spiritoso e realistico*\n`;
      p += `   * Breve paragrafo con commento pacato e ironico: punti fatti, solidità, aperture giocate, confronto con il suo Elo, e inserisci con naturalezza gli aneddoti personali forniti.\n`;
      p += `   * _Voto: [da 5 a 9] (Giudizio sintetico in 1-2 parole)_\n`;
      p += `4. Chiusura in 2 righe sul girone di ritorno che sta per iniziare.\n\n`;
    } else if (reviewType === "volata") {
      p += `CONTESTO SPECIFICO: VOLATA FINALE (mancano pochissime partite alla conclusione)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo: ⏱️ *Volata Finale: Le ultime sfide decisive di "${tournamentTitle}"*\n`;
      p += `2. Introduzione asciutta: mancano solo ${ongoingMatches.length || "2-3"} partite per chiudere i conti del torneo. Ecco cosa c'è ancora in gioco.\n`;
      p += `3. Suddivisione lucida per zone della classifica:\n`;
      p += `   * 🥇 *Primo posto*: chi guida la classifica e cosa gli serve per blindare il titolo (vittoria matematica, mezzo punto, ecc.).\n`;
      p += `   * 🥈 *Lotta per il podio*: distacchi tra il 2° e il 3° posto e duelli a distanza.\n`;
      p += `   * 📊 *Centro classifica*: sfide per stabilire le posizioni intermedie.\n`;
      p += `   * 🛡️ *Finale d'orgoglio*: chi gioca per chiudere a testa alta o strappare punti prestigiosi.\n`;
      p += `4. Cita con precisione le partite rimanenti con i nomi dei giocatori.\n`;
      p += `5. Breve augurio di buona partita a chi deve ancora muovere.\n\n`;
    } else {
      p += `CONTESTO SPECIFICO: FINE TORNEO / PAGELLE CONCLUSIVE (tutte le partite concluse)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo: 🏆 *Le Pagelle Finali di "${tournamentTitle}"*\n`;
      p += `2. Breve introduzione amichevole: il torneo è ufficialmente terminato ed ecco il verdetto definitivo delle scacchiere.\n`;
      p += `3. Per OGNI giocatore (in rigoroso ordine di classifica dal 1° all'ultimo):\n`;
      p += `   * *#Posizione Nome (@handle) – Nomignolo azzeccato*\n`;
      p += `   * Giudizio complessivo: vittorie chiave, momenti no, costanza, aperture predilette e integrazione sobria degli aneddoti personali.\n`;
      p += `   * _Voto: [da 5 a 9.5, 10 solo al vincitore indiscusso] (Definizione)_\n`;
      p += `4. Saluto finale affettuoso e ringraziamento a tutti i partecipanti per la bella sfida.\n\n`;
    }

    if (generalNotes.trim()) {
      p += `NOTE AGGIUNTIVE DELL'ORGANIZZATORE:\n${generalNotes.trim()}\n\n`;
    }

    p += `DATI CLASSIFICA GIOCATORI:\n`;
    standings.forEach((s, idx) => {
      const eloStr = s.rating ? `[Elo: ~${s.rating}]` : `[Elo: n/d]`;
      const anecStr = s.anecdote ? ` | Aneddoto/Nota: "${s.anecdote}"` : "";
      p += `${idx + 1}. ${s.name} (@${s.handle}) – Punti: ${s.points} (Vinte: ${s.won}, Patte: ${s.drawn}, Perse: ${s.lost}, Giocate: ${s.played}) ${eloStr}${anecStr}\n`;
    });

    p += `\nPARTITE CONCLUSE:\n`;
    if (finishedMatches.length === 0) {
      p += `Nessuna partita ancora conclusa nello storico.\n`;
    } else {
      finishedMatches.forEach((m) => {
        const opStr = m.opening ? ` (Apertura: ${m.opening})` : "";
        const movStr = m.moves ? ` in ${m.moves} mosse` : "";
        p += `- ${nameOf(m.white)} (@${m.white}) vs ${nameOf(m.black)} (@${m.black}): ${m.result}${movStr}${opStr}\n`;
      });
    }

    if (ongoingMatches.length > 0) {
      p += `\nPARTITE ANCORA APERTE / IN CORSO:\n`;
      ongoingMatches.forEach((m) => {
        p += `- Turno ${m.round}: ${nameOf(m.white)} (@${m.white}) vs ${nameOf(m.black)} (@${m.black})\n`;
      });
    }

    return p;
  };

  // Copy full prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      const prompt = buildPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torneo-${tournamentTitle.toLowerCase().replace(/\s+/g, "-")}-dati.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate review in-app with Gemini
  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    setNotice(null);
    const prompt = buildPrompt();

    try {
      const res = await fetch("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          // GitHub Pages static hosting cannot handle POST requests
          await navigator.clipboard.writeText(prompt).catch(() => {});
          setNotice({
            kind: "warning",
            text: "Su GitHub Pages (hosting statico) non è presente un backend server per la generazione in-app (HTTP 405). Il prompt con tutti i dati è stato COPIATO automaticamente nei tuoi appunti: incollalo su Claude o ChatGPT!",
          });
          return;
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Errore HTTP ${res.status}`);
      }

      const data = await res.json();
      setGeneratedReview(data.text || "");
      setNotice({ kind: "ok", text: "✨ Recensione generata con successo da Gemini!" });
    } catch (e: any) {
      // Auto-copy prompt as fallback
      await navigator.clipboard.writeText(prompt).catch(() => {});
      setNotice({
        kind: "warning",
        text: `${e.message} Prompt copiato negli appunti: incollalo direttamente su Claude o ChatGPT!`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy generated review
  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(generatedReview);
      setCopiedReview(true);
      setTimeout(() => setCopiedReview(false), 2500);
    } catch {}
  };

  const recommended = getRecommendedMoment();

  return (
    <section>
      <h2>✨ Recensioni & Pagelle del Torneo</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        Genera il bilancio del girone d'andata, la volata delle ultime sfide o le pagelle finali, con tono sobrio e arguto tra amici.
      </p>

      {notice && (
        <div className={`notice ${notice.kind}`} style={{ marginBottom: 14 }}>
          {notice.text}
        </div>
      )}

      {/* QUADRO STATO DATI TORNEO */}
      <div className="sync-dashboard">
        <div className="sync-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 14 }}>📊 Stato Dati Torneo</strong>
            <span className={`sync-badge ${lastSyncTime ? "synced" : "pending"}`}>
              {lastSyncTime ? `● Sincronizzato alle ${lastSyncTime}` : "⏳ Da sincronizzare"}
            </span>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={isFetchingData}
            onClick={loadGameStates}
            style={{ padding: "4px 10px", fontSize: 13, minHeight: 32 }}
          >
            {isFetchingData ? "Aggiornamento in corso…" : "🔄 Sincronizza Partite"}
          </button>
        </div>

        <div className="stat-pills">
          <div className="stat-pill">
            <span className="stat-pill-label">Partite Totali</span>
            <span className="stat-pill-val">
              {history.length} <small style={{ fontWeight: "normal", color: "var(--muted)" }}>({finishedMatches.length} finite, {ongoingMatches.length} in corso)</small>
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Elo Lichess</span>
            <span className="stat-pill-val">
              {ratedCount} / {config.players.length} <small style={{ fontWeight: "normal", color: "var(--muted)" }}>giocatori</small>
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Fase Rilevata</span>
            <span className="stat-pill-val" style={{ color: "var(--accent)" }}>
              {recommended === "finale" ? "🏆 Concluso" : recommended === "volata" ? "⏱️ Volata" : "🔄 Andata"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button
            type="button"
            className="secondary"
            disabled={isFetchingElo}
            onClick={fetchAllRatings}
            style={{ padding: "4px 8px", fontSize: 12, minHeight: 28 }}
          >
            {isFetchingElo ? "Recupero Elo in corso..." : "♟️ Scarica Elo da Lichess"}
          </button>
          <button
            type="button"
            onClick={() => setShowStandingsTable(!showStandingsTable)}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {showStandingsTable ? "Nascondi classifica rapida ▲" : "Vedi classifica calcolata ▼"}
          </button>
        </div>

        {/* Quick Standings Table */}
        {showStandingsTable && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <p className="note" style={{ margin: "0 0 6px", fontSize: 12 }}>
              Classifica calcolata dalle partite salvate nello storico:
            </p>
            <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 13 }}>
              {standings.map((s, idx) => (
                <div
                  key={s.handle}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    borderBottom: "1px dotted var(--line)",
                  }}
                >
                  <span>
                    <strong>{idx + 1}. {s.name}</strong> <small style={{ color: "var(--muted)" }}>({s.handle})</small>
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
      <div style={{ marginBottom: 14 }}>
        <label>Momento del Torneo</label>
        <div className="review-types-3">
          <button
            type="button"
            className={`review-moment-btn ${reviewType === "andata" ? "active" : ""}`}
            onClick={() => setReviewType("andata")}
          >
            <span className="review-moment-title">🔄 Fine Andata</span>
            <span className="review-moment-sub">Giro di boa: bilancio delle prime 7 sfide e promossi/rimandati.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "volata" ? "active" : ""}`}
            onClick={() => setReviewType("volata")}
          >
            <span className="review-moment-title">⏱️ Volata Finale</span>
            <span className="review-moment-sub">Mancano 2-3 partite: calcoli per il podio e le sfide decisive.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "finale" ? "active" : ""}`}
            onClick={() => setReviewType("finale")}
          >
            <span className="review-moment-title">🏆 Fine Torneo</span>
            <span className="review-moment-sub">Chiusura definitiva con pagelle, voti dal 5 al 10 e nomignoli.</span>
          </button>
        </div>
      </div>

      {/* Tournament Settings */}
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div>
          <label htmlFor="rev-tournament-title">Nome del Torneo</label>
          <input
            id="rev-tournament-title"
            type="text"
            value={tournamentTitle}
            onChange={(e) => setTournamentTitle(e.target.value)}
            placeholder="es. Scacchi & Chill"
          />
        </div>
        <div>
          <label htmlFor="rev-general-notes">Note extra dell'organizzatore (opzionale)</label>
          <input
            id="rev-general-notes"
            type="text"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="es. Tante partite decise all'ultima mossa, ritmo rilassato..."
          />
        </div>
      </div>

      {/* Accordion for Player Anecdotes & Elo */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ margin: 0 }}>Aneddoti personali dei giocatori ({config.players.length})</label>
          <button
            type="button"
            className="secondary"
            style={{ padding: "4px 8px", fontSize: 12, minHeight: 30 }}
            onClick={() => setShowAnecdotes(!showAnecdotes)}
          >
            {showAnecdotes ? "Chiudi note ▲" : "Modifica note ▼"}
          </button>
        </div>

        {showAnecdotes && (
          <div className="anecdote-grid">
            <p className="note" style={{ margin: "0 0 6px", fontSize: 13 }}>
              Inserisci piccoli fatti della vita reale o battute di gioco per ciascun giocatore (es. paternità, orari notturni, ritiri, cambi di apertura):
            </p>
            {standings.map((p) => (
              <div key={p.handle} className="anecdote-card">
                <div className="anecdote-card-header">
                  <strong>
                    {p.name} <span style={{ color: "var(--muted)", fontWeight: "normal" }}>({p.handle})</span>
                  </strong>
                  <span className="rating-badge">
                    {p.rating ? `Elo ~${p.rating}` : "Elo n/d"} · {p.points} pt
                  </span>
                </div>
                <input
                  type="text"
                  className="anecdote-input"
                  value={anecdotes[p.handle] || ""}
                  onChange={(e) =>
                    setAnecdotes((prev) => ({
                      ...prev,
                      [p.handle]: e.target.value,
                    }))
                  }
                  placeholder={`Aneddoto per ${p.name} (es. papà da poco, gioca solo di notte...)`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons: Copia Prompt is the primary frictionless action */}
      <div className="actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="primary"
          onClick={handleCopyPrompt}
          style={{ minHeight: 48 }}
        >
          {copiedPrompt ? "✅ Prompt Copiato!" : "📋 Copia Prompt per Claude / ChatGPT"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isGenerating}
          onClick={handleGenerateWithAI}
          style={{ minHeight: 48 }}
        >
          {isGenerating ? "Generazione in corso… 🧠" : "✨ Genera con AI"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p className="note" style={{ margin: 0, fontSize: 12 }}>
          💡 Il pulsante <strong>Copia Prompt</strong> funziona al 100% ovunque, pronto da incollare nella tua chat AI abituale.
        </p>
        <button
          type="button"
          onClick={handleDownloadJson}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            whiteSpace: "nowrap",
          }}
        >
          💾 Scarica JSON
        </button>
      </div>

      {/* Generated Result Area (when generated via AI) */}
      {generatedReview && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="generated-review-text">Testo Generato (pronto da inviare o ritoccare)</label>
          <textarea
            id="generated-review-text"
            value={generatedReview}
            onChange={(e) => setGeneratedReview(e.target.value)}
            rows={14}
            style={{ minHeight: 280, fontFamily: "inherit" }}
          />
          <div className="actions two" style={{ marginTop: 10 }}>
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
        </div>
      )}
    </section>
  );
}
