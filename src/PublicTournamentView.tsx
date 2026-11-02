import React, { useState } from "react";
import { AppConfig, HistoryGame, LichessExportGame, TournamentMeta } from "./types";
import { extractGameId } from "./lib/utils";

interface PublicTournamentViewProps {
  config: AppConfig;
  tournamentMeta: TournamentMeta;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
}

export function PublicTournamentView({
  config,
  tournamentMeta,
  history,
  gameStates,
  nameOf,
}: PublicTournamentViewProps) {
  const [subTab, setSubTab] = useState<"standings" | "matches" | "crosstable" | "rules">("standings");
  const [filterRound, setFilterRound] = useState<string>("all");

  // Calculate Standings, Sonneborn-Berger and Crosstable Matrix
  const stats: Record<
    string,
    {
      played: number;
      won: number;
      drawn: number;
      lost: number;
      points: number;
      sb: number; // Sonneborn-Berger
    }
  > = {};

  config.players.forEach((p) => {
    stats[p.handle] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 };
  });

  // Crosstable: matrix[whiteHandle][blackHandle] = result string
  const crosstable: Record<string, Record<string, string>> = {};
  config.players.forEach((p1) => {
    crosstable[p1.handle] = {};
    config.players.forEach((p2) => {
      crosstable[p1.handle][p2.handle] = p1.handle === p2.handle ? "✕" : "-";
    });
  });

  // Track finished matches for Sonneborn-Berger
  const finishedList: Array<{ white: string; black: string; result: "1-0" | "0-1" | "½-½" }> = [];

  history.forEach((g) => {
    const id = extractGameId(g.url);
    const s = id ? gameStates[id] : undefined;
    const white = g.white;
    const black = g.black;

    if (!stats[white]) stats[white] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 };
    if (!stats[black]) stats[black] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, sb: 0 };

    if (!s || s.status === "created" || s.status === "started" || s.status === "aborted" || s.status === "noStart") {
      return;
    }

    stats[white].played++;
    stats[black].played++;

    if (s.winner === "white") {
      stats[white].won++;
      stats[white].points += 1;
      stats[black].lost++;
      crosstable[white][black] = "1";
      crosstable[black][white] = "0";
      finishedList.push({ white, black, result: "1-0" });
    } else if (s.winner === "black") {
      stats[black].won++;
      stats[black].points += 1;
      stats[white].lost++;
      crosstable[white][black] = "0";
      crosstable[black][white] = "1";
      finishedList.push({ white, black, result: "0-1" });
    } else {
      stats[white].drawn++;
      stats[white].points += 0.5;
      stats[black].drawn++;
      stats[black].points += 0.5;
      crosstable[white][black] = "½";
      crosstable[black][white] = "½";
      finishedList.push({ white, black, result: "½-½" });
    }
  });

  // Calculate Sonneborn-Berger: sum of defeated opponents' points + 0.5 * drawn opponents' points
  finishedList.forEach((m) => {
    if (m.result === "1-0") {
      stats[m.white].sb += stats[m.black].points;
    } else if (m.result === "0-1") {
      stats[m.black].sb += stats[m.white].points;
    } else if (m.result === "½-½") {
      stats[m.white].sb += stats[m.black].points * 0.5;
      stats[m.black].sb += stats[m.white].points * 0.5;
    }
  });

  const standings = config.players
    .map((p) => ({
      handle: p.handle,
      name: p.name,
      ...stats[p.handle],
    }))
    .sort((a, b) => b.points - a.points || b.sb - a.sb || b.won - a.won || a.name.localeCompare(b.name));

  const rounds = [...new Set(history.map((g) => g.round))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  let filteredGames = filterRound === "all" ? history : history.filter((g) => g.round === filterRound);

  // Preserve official schedule ordering
  if (config.schedule && config.schedule.length > 0) {
    filteredGames = [...filteredGames].sort((a, b) => {
      // First sort by round numeric value
      const roundDiff = a.round.localeCompare(b.round, undefined, { numeric: true });
      if (roundDiff !== 0) return roundDiff;

      // Then sort by position in schedule
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

  const [showStoryModal, setShowStoryModal] = useState(false);
  const masterPhoto = tournamentMeta.imageUrl || "assets/capablanca.jpg";

  return (
    <div className="public-tournament">
      {/* Tournament Header with Season & Master Badge */}
      <div className="tournament-hero">
        <div className="hero-top" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1 }}>
            {masterPhoto && (
              <div
                onClick={() => setShowStoryModal(true)}
                title="Clicca per scoprire la storia della stagione"
                style={{
                  cursor: "pointer",
                  position: "relative",
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "2px solid var(--accent)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  flexShrink: 0,
                  transition: "transform 0.15s ease",
                }}
              >
                <img
                  src={masterPhoto}
                  alt={tournamentMeta.masterName || "Maestro della Stagione"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    fontSize: 9,
                    padding: "1px 3px",
                    borderTopLeftRadius: 4,
                  }}
                >
                  🔍
                </span>
              </div>
            )}
            <div>
              {/* 1. Nome Principale del Torneo */}
              <h1 className="tournament-title" style={{ margin: "0 0 4px", fontSize: 24, lineHeight: 1.2 }}>
                {tournamentMeta.title}
              </h1>

              {/* 2. Badge Stagione & Link Scopri */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="tournament-tag" style={{ margin: 0 }}>
                  🏆 {tournamentMeta.season}
                </span>
                <button
                  type="button"
                  onClick={() => setShowStoryModal(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  📖 Info stagione ▾
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Card espansa con la presentazione e la foto del maestro */}
      {showStoryModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowStoryModal(false)}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowStoryModal(false)}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>

            <span className="tournament-tag" style={{ marginBottom: 6 }}>
              🏆 {tournamentMeta.season}
            </span>
            {tournamentMeta.subtitle && (
              <p style={{ margin: "4px 0 12px", fontStyle: "italic", fontSize: 16, color: "var(--accent)" }}>
                "{tournamentMeta.subtitle}"
              </p>
            )}

            {masterPhoto && (
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                  marginBottom: 16,
                  textAlign: "center",
                  background: "#000",
                }}
              >
                <img
                  src={masterPhoto}
                  alt={tournamentMeta.masterName || "Maestro della Stagione"}
                  style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block", margin: "0 auto" }}
                />
              </div>
            )}

            <div style={{ lineHeight: 1.6, fontSize: 14, whiteSpace: "pre-line", color: "var(--ink)" }}>
              {tournamentMeta.description ||
                "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite."}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                type="button"
                className="secondary"
                style={{ flex: 1, minHeight: 42 }}
                onClick={() => {
                  setShowStoryModal(false);
                  setSubTab("rules");
                }}
              >
                📜 Leggi anche il Regolamento
              </button>
              <button
                type="button"
                className="primary"
                style={{ flex: 1, minHeight: 42 }}
                onClick={() => setShowStoryModal(false)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Sub-Navigation */}
      <div className="public-subnav">
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "standings" ? "active" : ""}`}
          onClick={() => setSubTab("standings")}
        >
          📊 Classifica
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "crosstable" ? "active" : ""}`}
          onClick={() => setSubTab("crosstable")}
        >
          🔲 Tabellone Incrociato
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "matches" ? "active" : ""}`}
          onClick={() => setSubTab("matches")}
        >
          ♟️ Calendario Partite ({history.length})
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "rules" ? "active" : ""}`}
          onClick={() => setSubTab("rules")}
        >
          📜 Regolamento
        </button>
      </div>

      {/* 1. STANDINGS TAB */}
      {subTab === "standings" && (
        <div className="public-section">
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th>Giocatore</th>
                  <th style={{ textAlign: "center" }}>Punti</th>
                  <th style={{ textAlign: "center" }}>G</th>
                  <th style={{ textAlign: "center" }}>V</th>
                  <th style={{ textAlign: "center" }}>N</th>
                  <th style={{ textAlign: "center" }}>P</th>
                  <th style={{ textAlign: "center" }} title="Spareggio Sonneborn-Berger">SB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, idx) => {
                  const isLeader = idx === 0 && p.points > 0;
                  const isPodium = idx < 3 && p.points > 0;
                  return (
                    <tr key={p.handle} className={isLeader ? "row-leader" : isPodium ? "row-podium" : ""}>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <a
                            href={`https://lichess.org/@/${p.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="player-link"
                          >
                            @{p.handle} ↗
                          </a>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, fontSize: "16px", color: "var(--accent)" }}>
                        {p.points}
                      </td>
                      <td style={{ textAlign: "center" }}>{p.played}</td>
                      <td style={{ textAlign: "center", color: "#22c55e", fontWeight: 600 }}>{p.won}</td>
                      <td style={{ textAlign: "center", color: "#eab308" }}>{p.drawn}</td>
                      <td style={{ textAlign: "center", color: "#ef4444" }}>{p.lost}</td>
                      <td style={{ textAlign: "center", opacity: 0.8, fontSize: "12px" }}>{p.sb.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 8, fontSize: "12px" }}>
            * Criterio di spareggio tecnico: <strong>SB (Sonneborn-Berger)</strong>, seguito dal maggior numero di vittorie. I risultati si aggiornano direttamente con le partite Lichess.
          </p>
        </div>
      )}

      {/* 2. CROSSTABLE TAB */}
      {subTab === "crosstable" && (
        <div className="public-section">
          <div className="table-responsive">
            <table className="crosstable">
              <thead>
                <tr>
                  <th style={{ width: "32px" }}>#</th>
                  <th>Giocatore</th>
                  {standings.map((_, i) => (
                    <th key={i} style={{ width: "36px", textAlign: "center" }}>
                      {i + 1}
                    </th>
                  ))}
                  <th style={{ textAlign: "center" }}>Tot</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, rowIdx) => (
                  <tr key={p.handle}>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>{rowIdx + 1}</td>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</td>
                    {standings.map((opp, colIdx) => {
                      const res = crosstable[p.handle]?.[opp.handle] ?? "-";
                      const isSelf = rowIdx === colIdx;
                      return (
                        <td
                          key={opp.handle}
                          className={`cross-cell ${isSelf ? "self" : res === "1" ? "win" : res === "0" ? "loss" : res === "½" ? "draw" : "empty"}`}
                        >
                          {res}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>
                      {p.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MATCHES CALENDAR TAB */}
      {subTab === "matches" && (
        <div className="public-section">
          {rounds.length > 0 && (
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="filter-round" style={{ margin: 0, fontSize: 13, whiteSpace: "nowrap" }}>
                Filtra Turno:
              </label>
              <select
                id="filter-round"
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
                style={{ minHeight: 38, width: "auto" }}
              >
                <option value="all">Tutti i turni ({history.length} partite)</option>
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Turno {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredGames.length === 0 ? (
            <p className="note">Nessuna partita programmata o registrata per questo turno.</p>
          ) : (
            <div className="matches-grid">
              {filteredGames.map((g, idx) => {
                const id = extractGameId(g.url);
                const s = id ? gameStates[id] : undefined;
                let statusBadge = <span className="status-badge pending">⏳ In attesa</span>;
                let resultText = "vs";
                let movesText = "";

                if (s) {
                  const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
                  const moves = Math.ceil(plies / 2);
                  if (moves > 0) movesText = `${moves} mosse`;

                  if (s.status === "started") {
                    statusBadge = <span className="status-badge ongoing">⚔️ In corso</span>;
                  } else if (s.winner === "white") {
                    statusBadge = <span className="status-badge win">1 - 0</span>;
                    resultText = "1 - 0";
                  } else if (s.winner === "black") {
                    statusBadge = <span className="status-badge loss">0 - 1</span>;
                    resultText = "0 - 1";
                  } else if (s.status === "draw") {
                    statusBadge = <span className="status-badge draw">½ - ½</span>;
                    resultText = "½ - ½";
                  }
                }

                return (
                  <div key={`${g.url}-${idx}`} className="match-card">
                    <div className="match-card-header">
                      <span className="match-round">Turno {g.round}</span>
                      {statusBadge}
                    </div>

                    <div className="match-players">
                      <div className="player-row">
                        <span className="dot w" />
                        <span className="player-name">{nameOf(g.white)}</span>
                        {s?.winner === "white" && <span className="winner-crown">👑</span>}
                      </div>
                      <div className="player-row">
                        <span className="dot b" />
                        <span className="player-name">{nameOf(g.black)}</span>
                        {s?.winner === "black" && <span className="winner-crown">👑</span>}
                      </div>
                    </div>

                    <div className="match-footer">
                      <span className="opening-label">{s?.opening?.name || movesText || "Partita Lichess"}</span>
                      <a href={g.url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn">
                        Apri su Lichess ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. RULES & REGULATIONS TAB (Full Dossier) */}
      {subTab === "rules" && (
        <div className="public-section">
          {/* Master Presentation Card */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              {masterPhoto && (
                <div
                  style={{
                    width: 140,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid var(--accent)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                    flexShrink: 0,
                    margin: "0 auto",
                  }}
                >
                  <img
                    src={masterPhoto}
                    alt={tournamentMeta.masterName || "Maestro della Stagione"}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 260 }}>
                <span className="tournament-tag" style={{ marginBottom: 4 }}>
                  🏆 {tournamentMeta.season}
                </span>
                <h3 style={{ margin: "4px 0", fontSize: 20 }}>
                  {tournamentMeta.masterName || "José Raúl Capablanca"}
                </h3>
                {tournamentMeta.subtitle && (
                  <p style={{ margin: "0 0 10px", fontStyle: "italic", color: "var(--accent)", fontSize: 15 }}>
                    "{tournamentMeta.subtitle}"
                  </p>
                )}
                <div style={{ lineHeight: 1.6, fontSize: 14, whiteSpace: "pre-line", color: "var(--ink)", opacity: 0.9 }}>
                  {tournamentMeta.description ||
                    "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite."}
                </div>
              </div>
            </div>
          </div>

          {/* Albo d'Oro - Vincitori delle Edizioni */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
              🏆 Albo d'Oro del Torneo
            </h3>
            {tournamentMeta.winners && tournamentMeta.winners.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {tournamentMeta.winners.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--bg)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🥇</span>
                      <div>
                        <strong>{w.name}</strong>{" "}
                        <a
                          href={`https://lichess.org/@/${w.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                        >
                          @{w.handle} ↗
                        </a>
                        {w.notes && (
                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{w.notes}</div>
                        )}
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: 12, fontWeight: 700 }}>
                      {w.season}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="note" style={{ margin: 0 }}>
                Nessuna edizione precedente registrata.
              </p>
            )}
          </div>

          {/* Tournament How It Works & Fair Play Box */}
          <div className="rules-box">
            <h3 style={{ marginTop: 0 }}>♟️ Come funziona il torneo</h3>

            <h4 style={{ margin: "14px 0 6px", fontSize: 15, color: "var(--accent)" }}>Svolgimento</h4>
            {tournamentMeta.howItWorks ? (
              <div style={{ whiteSpace: "pre-line", lineHeight: 1.7, margin: "6px 0 16px" }}>
                {tournamentMeta.howItWorks}
              </div>
            ) : (
              <ol style={{ paddingLeft: 20, lineHeight: 1.7, margin: "6px 0 16px" }}>
                <li>
                  All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.
                </li>
                <li>
                  Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.
                </li>
              </ol>
            )}

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

            <h4 style={{ margin: "14px 0 6px", fontSize: 15, color: "var(--accent)" }}>🌈 Regole di fair play</h4>
            {tournamentMeta.fairPlayText ? (
              <div style={{ whiteSpace: "pre-line", lineHeight: 1.7, margin: "6px 0 16px" }}>
                {tournamentMeta.fairPlayText}
              </div>
            ) : (
              <ul style={{ paddingLeft: 20, lineHeight: 1.7, margin: "6px 0 16px" }}>
                <li>
                  Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.
                </li>
                <li>
                  In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.
                </li>
                <li>
                  Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore.
                </li>
              </ul>
            )}

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

            <h4 style={{ margin: "14px 0 6px", fontSize: 15, color: "var(--accent)" }}>⚙️ Parametri Tecnici Lichess</h4>
            <ul style={{ paddingLeft: 20, lineHeight: 1.6, margin: "6px 0" }}>
              <li><strong>Tempo di riflessione:</strong> 2 giorni per ciascuna mossa (modalità Corrispondenza).</li>
              <li><strong>Partite Rated:</strong> Le partite sono ufficiali e incidono sul tuo rating Elo Lichess.</li>
              <li><strong>Nessun rollback / No takeback:</strong> Per garantire parità e concentrazione sulla scacchiera.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
