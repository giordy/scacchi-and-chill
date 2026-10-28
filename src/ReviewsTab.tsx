import React, { useState, useEffect } from "react";
import { AppConfig, HistoryGame, LichessExportGame, NoticeState, PlayerStanding } from "./types";

interface ReviewsTabProps {
  history: HistoryGame[];
  config: AppConfig;
  nameOf: (handle: string) => string;
}

export function ReviewsTab({ history, config, nameOf }: ReviewsTabProps) {
  const [reviewType, setReviewType] = useState<"gala" | "volata">("gala");
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
  const [generatedReview, setGeneratedReview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isFetchingElo, setIsFetchingElo] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [showAnecdotes, setShowAnecdotes] = useState(false);

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
      setNotice({ kind: "ok", text: `Dati di ${Object.keys(states).length} partite aggiornati con successo da Lichess.` });
    } catch (e: any) {
      setNotice({
        kind: "warning",
        text: "Impossibile scaricare gli stati da Lichess (verranno usati i dati locali salvati): " + e.message,
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

  // Fetch correspondence Elo for all players directly from Lichess API (CORS enabled for all origins)
  const fetchAllRatings = async () => {
    setIsFetchingElo(true);
    setNotice(null);
    const updated: Record<string, string | number | null> = { ...ratings };
    let successCount = 0;

    for (const player of config.players) {
      try {
        let data: any = null;

        // 1. Direct call to Lichess API (supported in browser on GitHub Pages, dev server, mobile)
        try {
          const directRes = await fetch(
            `https://lichess.org/api/user/${encodeURIComponent(player.handle)}`,
            { headers: { Accept: "application/json" } }
          );
          if (directRes.ok) {
            data = await directRes.json();
          }
        } catch {}

        // 2. Fallback to local Express proxy if direct call was blocked
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
        text: `Elo Lichess aggiornato con successo per ${successCount} su ${config.players.length} giocatori.`,
      });
    } else {
      setNotice({
        kind: "warning",
        text: "Impossibile contattare Lichess al momento. Verifica la connessione a internet o i nickname.",
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

  // Build the complete AI prompt
  const buildPrompt = () => {
    const isGala = reviewType === "gala";

    let p = `Sei il cronista ufficiale e comico del torneo amatoriale di scacchi tra amici "${tournamentTitle}".\n`;
    
    if (isGala) {
      p += `Devi scrivere il "Gran Galà delle Pagelle": un resoconto finale o di metà campionato irriverente, goliardico, arguto ma sempre affettuoso e rispettoso verso tutti i partecipanti.\n\n`;
      p += `REGOLE DI STILE E FORMATTAZIONE:\n`;
      p += `- Usa la formattazione WhatsApp (*grassetto*, _corsivo_, emoji).\n`;
      p += `- Titolo trionfale in apertura (es. 🏆 *Gran Galà di Chiusura: "${tournamentTitle}"* 🏆).\n`;
      p += `- Breve introduzione teatrale sul torneo appena concluso.\n`;
      p += `- Per OGNI giocatore della classifica, scrivi una pagella dedicata con:\n`;
      p += `  1. *#Posizione Nome (nickname_lichess) – Titolo Onorifico Ironico* 🤖\n`;
      p += `  2. Un paragrafo divertente che commenta i suoi punti, le sue vittorie, le sconfitte, le aperture giocate, il confronto con l'Elo Lichess e soprattutto INTEGRA con naturalezza le note personali e gli aneddoti forniti (es. nascite, notti insonni, ritiri, battaglie).\n`;
      p += `  3. _Voto: [da 1 a 10 e lode o 11] (Definizione comica)_\n`;
      p += `- Chiudi con un brindisi caloroso e arrivederci alla prossima edizione.\n\n`;
    } else {
      p += `Mancano pochissime partite alla conclusione e devi scrivere il messaggio della "Volata Finale" per presentare le sfide decisive e creare entusiasmo e sana rivalità nel gruppo WhatsApp!\n\n`;
      p += `REGOLE DI STILE E FORMATTAZIONE:\n`;
      p += `- Usa la formattazione WhatsApp (*grassetto*, emoji scacchistiche).\n`;
      p += `- Introduzione carica di hype (es. "Mancano solo le ultime sfide per far calare il sipario: ecco cosa c'è ancora in ballo! 🔥").\n`;
      p += `- Suddividi in sezioni strategiche per zone calde della classifica:\n`;
      p += `  * 🏆 Primo Posto & Invincibilità: chi è in testa o campione matematico, e cosa deve difendere.\n`;
      p += `  * 🥈 Volata Podio / Argento: chi si contende il secondo e terzo posto a distanza.\n`;
      p += `  * 📊 Zona Media Classifica: duelli punto a punto per le posizioni centrali.\n`;
      p += `  * 🛡️ Finale d'Orgoglio: le partite per evitare il fondo o per togliere punti ai primi.\n`;
      p += `- Per ogni zona cita esplicitamente i giocatori coinvolti, i punti attuali e le partite rimanenti da giocare.\n`;
      p += `- Concludi con un augurio di buona fortuna e buona battaglia sulle scacchiere.\n\n`;
    }

    if (generalNotes.trim()) {
      p += `NOTE GENERALI SUL TORNEO FORNITE DALL'ORGANIZZATORE:\n${generalNotes.trim()}\n\n`;
    }

    p += `CLASSIFICA ATTUALE DEI GIOCATORI:\n`;
    standings.forEach((s, idx) => {
      const eloStr = s.rating ? `[Elo Corrispondenza: ~${s.rating}]` : `[Elo: n/d]`;
      const anecStr = s.anecdote ? ` | Aneddoto/Nota personale: "${s.anecdote}"` : "";
      p += `${idx + 1}. ${s.name} (@${s.handle}) – Punti: ${s.points} (Giocate: ${s.played}, Vinte: ${s.won}, Patte: ${s.drawn}, Perse: ${s.lost}) ${eloStr}${anecStr}\n`;
    });

    p += `\nPARTITE CONCLUSE NEL TORNEO:\n`;
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
      p += `\nPARTITE ANCORA IN CORSO / DA COMPLETARE:\n`;
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
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      setNotice({ kind: "err", text: "Impossibile copiare il prompt automaticamente." });
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
    try {
      const prompt = buildPrompt();
      const res = await fetch("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Errore HTTP ${res.status}`);
      }

      const data = await res.json();
      setGeneratedReview(data.text || "");
      setNotice({ kind: "ok", text: "✨ Recensione generata con successo da Gemini!" });
    } catch (e: any) {
      setNotice({
        kind: "err",
        text: `Errore nella generazione diretta: ${e.message}. Puoi comunque usare il pulsante "Copia Prompt Completo" per incollarlo su Claude o ChatGPT.`,
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

  return (
    <section>
      <h2>✨ Recensioni & Pagelle del Torneo</h2>
      <p className="note" style={{ marginBottom: 16 }}>
        Genera pagelle comiche di fine andata/torneo o il bollettino di volata finale per le ultime sfide, integrando risultati, aperture, Elo Lichess e aneddoti personali.
      </p>

      {notice && (
        <div className={`notice ${notice.kind}`} style={{ marginBottom: 14 }}>
          {notice.text}
        </div>
      )}

      {/* Select Review Type */}
      <div style={{ marginBottom: 14 }}>
        <label>Tipo di Messaggio Speciale</label>
        <div className="review-types">
          <button
            type="button"
            className={`review-type-btn ${reviewType === "gala" ? "active" : ""}`}
            onClick={() => setReviewType("gala")}
          >
            🏆 Gran Galà & Pagelle
          </button>
          <button
            type="button"
            className={`review-type-btn ${reviewType === "volata" ? "active" : ""}`}
            onClick={() => setReviewType("volata")}
          >
            🔥 Volata Finale (Ultime sfide)
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
          <label>Dati Lichess Partite</label>
          <button
            type="button"
            className="secondary"
            disabled={isFetchingData}
            onClick={loadGameStates}
            style={{ width: "100%", minHeight: 48 }}
          >
            {isFetchingData ? "Aggiornamento in corso…" : "🔄 Sincronizza Partite"}
          </button>
        </div>
      </div>

      {/* General notes */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="rev-general-notes">Note generali sul torneo (facoltativo)</label>
        <textarea
          id="rev-general-notes"
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          placeholder="es. Prima edizione con 8 partecipanti, torneo combattuto con tante sorprese e un'atmosfera molto rilassata."
          rows={2}
          style={{ minHeight: 70 }}
        />
      </div>

      {/* Accordion for Player Anecdotes & Elo */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ margin: 0 }}>Aneddoti personali & Elo giocatori ({config.players.length})</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="secondary"
              style={{ padding: "4px 8px", fontSize: 12, minHeight: 30 }}
              disabled={isFetchingElo}
              onClick={fetchAllRatings}
            >
              {isFetchingElo ? "Recupero..." : "🔄 Scarica Elo da Lichess"}
            </button>
            <button
              type="button"
              className="secondary"
              style={{ padding: "4px 8px", fontSize: 12, minHeight: 30 }}
              onClick={() => setShowAnecdotes(!showAnecdotes)}
            >
              {showAnecdotes ? "Nascondi note ▲" : "Modifica note ▼"}
            </button>
          </div>
        </div>

        {showAnecdotes && (
          <div className="anecdote-grid">
            <p className="note" style={{ margin: "0 0 6px", fontSize: 13 }}>
              Scrivi una breve nota o fatto curioso per ciascun giocatore (es. paternità, insonnia, ritiri, battute di gioco):
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

      {/* Action Buttons */}
      <div className="actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className="primary"
          disabled={isGenerating}
          onClick={handleGenerateWithAI}
          style={{ minHeight: 48 }}
        >
          {isGenerating ? "Generazione in corso… 🧠" : "✨ Genera con AI"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={handleCopyPrompt}
          style={{ minHeight: 48 }}
        >
          {copiedPrompt ? "✅ Prompt Copiato!" : "📋 Copia Prompt Completo"}
        </button>
      </div>

      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleDownloadJson}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          💾 Scarica dati e classifica in JSON
        </button>
      </div>

      {/* Generated Result Area */}
      {generatedReview && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="generated-review-text">Recensione Generata (pronta da inviare o modificare)</label>
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
