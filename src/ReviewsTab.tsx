import React, { useState, useEffect } from "react";
import { AppConfig, HistoryGame, LichessExportGame, NoticeState, PlayerStanding } from "./types";
import { WhatsAppPreview } from "./WhatsAppPreview";

interface ReviewsTabProps {
  history: HistoryGame[];
  config: AppConfig;
  nameOf: (handle: string) => string;
  triggerToast?: (msg: string) => void;
}

export type ReviewMoment = "andata" | "volata" | "finale";

export function ReviewsTab({ history, config, nameOf, triggerToast }: ReviewsTabProps) {
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

  // Build the sober, witty, feel-good AI prompt
  const buildPrompt = () => {
    let p = `Sei il cronista amichevole del torneo di scacchi tra amici "${tournamentTitle}".\n`;
    p += `Devi scrivere un resoconto per il nostro gruppo WhatsApp.\n\n`;

    p += `REGOLE FONDAMENTALI DI SPIRITO E TONO (CRITICHE):\n`;
    p += `1. ATMOSFERA "FEEL-GOOD" E ZERO DERISIONE (NO SHAMING):\n`;
    p += `   - Il torneo si chiama "${tournamentTitle}": è un gruppo di amici e colleghi che giocano per passione, divertimento e relax.\n`;
    p += `   - NESSUN GIUDIZIO MORTIFICANTE, NESSUNA DERISIONE, NESSUNA UMILIAZIONE.\n`;
    p += `   - Ogni singolo giocatore – dal primo all'ultimo in classifica – deve finire di leggere la sua pagella con un sorriso, sentendosi valorizzato e felice di partecipare.\n`;
    p += `   - L'ironia deve essere affettuosa, complice e calorosa (come una battuta al bar tra amici che si vogliono bene), MAI tagliente, MAI sprezzante.\n`;
    p += `   - VIETATE categoricamente espressioni condescendenti o offensive (ad es. NON usare: "non sa muovere i cavalli", "da arresto immediato", "sfida tra disperati", "il nickname dice tutto", "martire", "a secco").\n\n`;

    p += `2. L'ELO COME METRO DI CORAGGIO E HANDICAP (NON COME PRETESTO DI CRITICA):\n`;
    p += `   - Nel torneo convivono giocatori con Elo molto differenti (da circa 700 a oltre 1850).\n`;
    p += `   - Chi ha un Elo più basso (ad es. Stefano ~779) e gioca contro avversari con 700-1000 punti in più di Elo è l'eroe coraggioso del torneo: durare 30 o più mosse contro chi è molto più esperto è una prova di grandissimo carattere e grinta! Celebrane l'audacia, lo spirito sportivo e la tenacia, senza mai rimarcarne la sconfitta in modo negativo.\n`;
    p += `   - Chi ha impegni personali gravosi (es. paternità, notti insonni, biberon per Giordano) va elogiato per la passione e la dedizione con cui continua a giocare nonostante la stanchezza.\n`;
    p += `   - Chi vince con Elo alto va riconosciuto con rispetto, ma senza sminuire chi ha lottato dall'altra parte della scacchiera.\n\n`;

    p += `3. NIENTE VOTI NUMERICI – ASSEGNA IL "PEZZO GUIDA" E IL "PREMIO DEL GIRONE":\n`;
    p += `   - NON usare MAI voti numerici (NON scrivere mai "Voto: 6", "Voto: 7.5", "Voto: 10", ecc.). I numeri scolastici sono freddi, sterili e creano gerarchie mortificanti.\n`;
    p += `   - Al posto del voto, per OGNI giocatore assegna due elementi scacchistici divertenti, positivi e memorabili:\n`;
    p += `     a) ♟️ *Pezzo Guida*: un parallelo con un pezzo degli scacchi che ne rispecchia lo stile di gioco o l'atteggiamento, con una breve motivazione ironica e affettuosa tra parentesi.\n`;
    p += `        (Esempi: *Il Pedone Passato* che avanza a testa alta contro i giganti; *La Torre da Assedio* per chi costruisce difese eterne e maratone da 60 mosse; *Il Cavallo Imprevedibile* che muove a sorpresa e crea il caos creativo; *La Regina d'Assalto* per chi attacca sempre senza paura; *L'Alfiere Campestre* per chi scova diagonali invisibili da lontano; *Il Re Guerriero* che difende il castello senza dormire da mesi).\n`;
    p += `     b) 🎖️ *Premio Speciale*: un riconoscimento personalizzato, brillante e caloroso (stile "Oscar del torneo").\n`;
    p += `        (Esempi: *Premio "Davide contro Golia"* per chi affronta avversari con centinaia di punti Elo in più vendendo cara la pelle; *Premio "Catenaccio d'Oro"* per la difesa più ostinata; *Premio "Papà & Scacchiere"* per chi gioca con un biberon in mano; *Premio "Maratona dei Finali"* per la partita più lunga; *Premio "Fedeltà alla Bandiera"* per chi gioca sempre con coerenza la propria apertura preferita).\n\n`;

    p += `4. FORMATTAZIONE WHATSAPP:\n`;
    p += `   - Testo pulito, chiaro, con *grassetto*, _corsivo_ per i riconoscimenti, emoji gradevoli e sobrie, spaziature naturali tra i paragrafi.\n\n`;

    if (reviewType === "andata") {
      p += `CONTESTO SPECIFICO: GIRO DI BOA / FINE GIRONE D'ANDATA (7 partite disputate)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo accogliente: 🔄 *Giro di boa: Il bilancio dell'andata di "${tournamentTitle}"*\n`;
      p += `2. Premessa breve e calorosa: si chiude il girone di andata tra grandi battaglie, belle giocate e tanto divertimento.\n`;
      p += `3. Per OGNI giocatore della classifica (dal primo all'ultimo):\n`;
      p += `   * *#Posizione Nome (@handle) – Titolo simpatico e affettuoso*\n`;
      p += `   * Paragrafo brillante che valorizza il suo percorso: i punti fatti, le difese ostinate, le partite lottate fino all'ultimo tratto, il confronto positivo con il proprio Elo e gli aneddoti di vita reale integrati con simpatia.\n`;
      p += `   * ♟️ *Pezzo Guida:* [Pezzo degli scacchi con spiegazione tra parentesi]\n`;
      p += `   * 🎖️ *Premio del Girone:* [Premio speciale personalizzato e caloroso]\n`;
      p += `4. Chiusura stimolante e amichevole in vista del girone di ritorno.\n\n`;
    } else if (reviewType === "volata") {
      p += `CONTESTO SPECIFICO: VOLATA FINALE (mancano pochissime partite alla conclusione)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo: ⏱️ *Volata Finale: Le ultime sfide decisive di "${tournamentTitle}"*\n`;
      p += `2. Introduzione appassionante e sportiva: mancano solo ${ongoingMatches.length || "2-3"} partite per completare il campionato.\n`;
      p += `3. Panoramica positiva per zone della classifica:\n`;
      p += `   * 🥇 *Corsa al vertice*: chi guida e quale traguardo può tagliare.\n`;
      p += `   * 🥈 *Volata podio*: le belle sfide a distanza per le medaglie d'argento e bronzo.\n`;
      p += `   * 📊 *Centro classifica*: i duelli tra chi ha dato vita a partite tiratissime.\n`;
      p += `   * 🛡️ *Sfide d'orgoglio*: chi scende sulla scacchiera per regalare e regalarsi un'ultima bella prestazione.\n`;
      p += `4. Cita con precisione le partite ancora da completare e i giocatori coinvolti con il loro spirito di gioco.\n`;
      p += `5. Augurio caloroso di buon gioco a tutti per gli ultimi tratti.\n\n`;
    } else {
      p += `CONTESTO SPECIFICO: FINE TORNEO / PAGELLE CONCLUSIVE (tutte le partite concluse)\n`;
      p += `Istruzioni per il messaggio:\n`;
      p += `1. Titolo: 🏆 *Le Pagelle Finali di "${tournamentTitle}"*\n`;
      p += `2. Introduzione calorosa: si chiude ufficialmente questa splendida edizione del torneo tra amici.\n`;
      p += `3. Per OGNI giocatore (in rigoroso ordine di classifica dal 1° all'ultimo):\n`;
      p += `   * *#Posizione Nome (@handle) – Soprannome d'onore affettuoso*\n`;
      p += `   * Giudizio complessivo che esalta i momenti migliori, le partite più belle, la costanza, il coraggio rispetto all'Elo e gli aneddoti personali.\n`;
      p += `   * ♟️ *Pezzo Guida:* [Pezzo degli scacchi con spiegazione celebrativa]\n`;
      p += `   * 🎖️ *Premio Speciale del Campionato:* [Premio speciale personalizzato e celebrativo]\n`;
      p += `4. Saluto finale e grande applauso corale a tutti per aver reso speciale il torneo.\n\n`;
    }

    if (generalNotes.trim()) {
      p += `NOTE DELL'ORGANIZZATORE:\n${generalNotes.trim()}\n\n`;
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
      if (triggerToast) {
        triggerToast("Testo della recensione copiato negli appunti! 📋");
      }
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
            <span className="review-moment-sub">Giro di boa: bilancio delle prime 7 sfide, Pezzi Guida e riconoscimenti.</span>
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
            <span className="review-moment-sub">Chiusura definitiva con verdetti, Pezzo Guida e premi speciali del torneo.</span>
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
          {/* WhatsApp formatted live chat bubble */}
          <WhatsAppPreview text={generatedReview} title="Anteprima WhatsApp (Recensione Generata)" />

          <details style={{ marginTop: 8, marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
              Modifica testo grezzo prima dell'invio
            </summary>
            <div style={{ marginTop: 8 }}>
              <textarea
                id="generated-review-text"
                value={generatedReview}
                onChange={(e) => setGeneratedReview(e.target.value)}
                rows={12}
                style={{ minHeight: 220, fontFamily: "inherit" }}
              />
            </div>
          </details>

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
