import React, { useState } from "react";
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from "./types";
import { SeasonsHistory } from "./components/SeasonsHistory";
import { playerHref } from "./lib/routes";
import { computeStandings } from "./lib/standings";
import { extractGameId } from "./lib/utils";

interface PublicTournamentViewProps {
  config: AppConfig;
  tournamentMeta: TournamentMeta;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  seasons?: SeasonArchive[];
}

export function PublicTournamentView({
  config,
  tournamentMeta,
  history,
  gameStates,
  nameOf,
  seasons = [],
}: PublicTournamentViewProps) {
  const [subTab, setSubTab] = useState<"standings" | "matches" | "crosstable" | "rules" | "history">("standings");
  const [filterRound, setFilterRound] = useState<string>("all");

  const { standings, crosstable } = computeStandings(config.players, history, gameStates);

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
  // Default photo only for the original Capablanca season: a new master without a photo shows none
  const masterName = tournamentMeta.masterName ?? "";
  const masterPhoto =
    tournamentMeta.imageUrl || (!masterName || /capablanca/i.test(masterName) ? "assets/capablanca.jpg" : "");

  return (
    <div className="public-tournament">
      {/* Tournament Header with Season & Master Badge */}
      <div className="tournament-hero">
        <div className="hero-top centered">
          <div className="hero-identity">
            {masterPhoto && (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowStoryModal(true); }}
                onClick={() => setShowStoryModal(true)}
                title="Clicca per scoprire la storia della stagione"
                className="master-thumb"
              >
                <img
                  src={masterPhoto}
                  alt={tournamentMeta.masterName || "Maestro della Stagione"}
                  className="master-thumb-img"
                />
                <span className="master-thumb-zoom">
                  🔍
                </span>
              </div>
            )}
            <div>
              {/* 1. Nome Principale del Torneo */}
              <h1 className="tournament-title hero-title">
                {tournamentMeta.title}
              </h1>

              {/* 2. Badge Stagione & Link Scopri */}
              <div className="hero-tags">
                <span className="tournament-tag m-0">
                  🏆 {tournamentMeta.season}
                </span>
                <button
                  type="button"
                  className="link-accent"
                  onClick={() => setShowStoryModal(true)}
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
          className="modal-backdrop"
          onClick={() => setShowStoryModal(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Storia della stagione"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Chiudi"
              onClick={() => setShowStoryModal(false)}
            >
              ✕
            </button>

            <span className="tournament-tag mb-6">
              🏆 {tournamentMeta.season}
            </span>
            {tournamentMeta.subtitle && (
              <p className="story-subtitle">
                "{tournamentMeta.subtitle}"
              </p>
            )}

            {masterPhoto && (
              <div className="story-photo">
                <img
                  src={masterPhoto}
                  alt={tournamentMeta.masterName || "Maestro della Stagione"}
                  className="story-photo-img"
                />
              </div>
            )}

            <div className="story-text">
              {tournamentMeta.description ||
                "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite."}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
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
                onClick={() => setShowStoryModal(false)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Sub-Navigation */}
      <div className="public-subnav" role="tablist" aria-label="Sezioni del torneo">
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "standings" ? "active" : ""}`}
          role="tab"
          id="pub-tab-standings"
          aria-selected={subTab === "standings"}
          aria-controls="pub-panel-standings"
          onClick={() => setSubTab("standings")}
        >
          📊 Classifica
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "crosstable" ? "active" : ""}`}
          role="tab"
          id="pub-tab-crosstable"
          aria-selected={subTab === "crosstable"}
          aria-controls="pub-panel-crosstable"
          onClick={() => setSubTab("crosstable")}
        >
          🔲 Tabellone Incrociato
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "matches" ? "active" : ""}`}
          role="tab"
          id="pub-tab-matches"
          aria-selected={subTab === "matches"}
          aria-controls="pub-panel-matches"
          onClick={() => setSubTab("matches")}
        >
          ♟️ Calendario Partite ({history.length})
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${subTab === "rules" ? "active" : ""}`}
          role="tab"
          id="pub-tab-rules"
          aria-selected={subTab === "rules"}
          aria-controls="pub-panel-rules"
          onClick={() => setSubTab("rules")}
        >
          📜 Regolamento
        </button>
        {seasons.length > 0 && (
          <button
            type="button"
            className={`pub-tab-btn ${subTab === "history" ? "active" : ""}`}
            role="tab"
            id="pub-tab-history"
            aria-selected={subTab === "history"}
            aria-controls="pub-panel-history"
            onClick={() => setSubTab("history")}
          >
            🏛️ Storico
          </button>
        )}
      </div>

      {/* 1. STANDINGS TAB */}
      {subTab === "standings" && (
        <div className="public-section" role="tabpanel" id="pub-panel-standings" aria-labelledby="pub-tab-standings">
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="sticky-col">Giocatore</th>
                  <th className="col-center">Punti</th>
                  <th className="col-center">G</th>
                  <th className="col-center">V</th>
                  <th className="col-center">N</th>
                  <th className="col-center">P</th>
                  <th className="col-center" title="Spareggio Sonneborn-Berger">SB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, idx) => {
                  const isLeader = idx === 0 && p.points > 0;
                  const isPodium = idx < 3 && p.points > 0;
                  return (
                    <tr key={p.handle} className={isLeader ? "row-leader" : isPodium ? "row-podium" : ""}>
                      <td className="col-center col-strong">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </td>
                      <td className="sticky-col">
                        <div className="player-cell">
                          <a href={playerHref(p.handle)} className="player-name player-page-link">{p.name}</a>
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
                      <td className="col-center col-points">
                        {p.points}
                      </td>
                      <td className="col-center">{p.played}</td>
                      <td className="col-center stat-won">{p.won}</td>
                      <td className="col-center stat-drawn">{p.drawn}</td>
                      <td className="col-center stat-lost">{p.lost}</td>
                      <td className="col-center stat-sb">{p.sb.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note note-top-xs">
            * Criterio di spareggio tecnico: <strong>SB (Sonneborn-Berger)</strong>, seguito dal maggior numero di vittorie. I risultati si aggiornano direttamente con le partite Lichess.
          </p>
        </div>
      )}

      {/* 2. CROSSTABLE TAB */}
      {subTab === "crosstable" && (
        <div className="public-section" role="tabpanel" id="pub-panel-crosstable" aria-labelledby="pub-tab-crosstable">
          <div className="table-responsive">
            <table className="crosstable">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="sticky-col">Giocatore</th>
                  {standings.map((_, i) => (
                    <th key={i} className="col-cross">
                      {i + 1}
                    </th>
                  ))}
                  <th className="col-center">Tot</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, rowIdx) => (
                  <tr key={p.handle}>
                    <td className="col-strong">{rowIdx + 1}</td>
                    <td className="sticky-col player-name nowrap">
                      <a href={playerHref(p.handle)} className="player-page-link">{p.name}</a>
                    </td>
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
                    <td className="col-points">
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
        <div className="public-section" role="tabpanel" id="pub-panel-matches" aria-labelledby="pub-tab-matches">
          {rounds.length > 0 && (
            <div className="filter-row">
              <label htmlFor="filter-round">
                Filtra Turno:
              </label>
              <select
                id="filter-round"
                className="filter-select"
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
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
                let statusBadge = <span className="status-badge pending">In attesa</span>;
                let movesText = "";

                if (s) {
                  const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
                  const moves = Math.ceil(plies / 2);
                  if (moves > 0) movesText = `${moves} mosse`;

                  // Neutral result: here 0-1 is a win for Black, not a "loss"
                  if (s.status === "started") {
                    statusBadge = <span className="status-badge ongoing">In corso</span>;
                  } else if (s.winner === "white") {
                    statusBadge = <span className="status-badge result">1 – 0</span>;
                  } else if (s.winner === "black") {
                    statusBadge = <span className="status-badge result">0 – 1</span>;
                  } else if (s.status === "draw") {
                    statusBadge = <span className="status-badge result">½ – ½</span>;
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

      {/* 5. SEASONS HISTORY TAB */}
      {subTab === "history" && seasons.length > 0 && (
        <div className="public-section" role="tabpanel" id="pub-panel-history" aria-labelledby="pub-tab-history">
          <SeasonsHistory seasons={seasons} />
        </div>
      )}

      {/* 4. RULES & REGULATIONS TAB (Full Dossier) */}
      {subTab === "rules" && (
        <div className="public-section" role="tabpanel" id="pub-panel-rules" aria-labelledby="pub-tab-rules">
          {/* Master Presentation Card */}
          <div className="dossier-card">
            <div className="dossier-row">
              {masterPhoto && (
                <div className="dossier-photo">
                  <img
                    src={masterPhoto}
                    alt={tournamentMeta.masterName || "Maestro della Stagione"}
                    className="dossier-photo-img"
                  />
                </div>
              )}
              <div className="dossier-body">
                <span className="tournament-tag mb-4">
                  🏆 {tournamentMeta.season}
                </span>
                <h3 className="dossier-name">
                  {tournamentMeta.masterName || "José Raúl Capablanca"}
                </h3>
                {tournamentMeta.subtitle && (
                  <p className="dossier-subtitle">
                    "{tournamentMeta.subtitle}"
                  </p>
                )}
                <div className="story-text dim">
                  {tournamentMeta.description ||
                    "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite."}
                </div>
              </div>
            </div>
          </div>

          {/* Albo d'Oro - Vincitori delle Edizioni */}
          <div className="dossier-card">
            <h3 className="dossier-heading">
              🏆 Albo d'Oro del Torneo
            </h3>
            {tournamentMeta.winners && tournamentMeta.winners.length > 0 ? (
              <div className="winners-list">
                {tournamentMeta.winners.map((w, idx) => (
                  <div
                    key={idx}
                    className="winner-row"
                  >
                    <div className="inline-row gap-10">
                      <span className="fs-20">🥇</span>
                      <div>
                        <strong>{w.name}</strong>{" "}
                        <a
                          href={`https://lichess.org/@/${w.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="winner-link"
                        >
                          @{w.handle} ↗
                        </a>
                        {w.notes && (
                          <div className="winner-notes">{w.notes}</div>
                        )}
                      </div>
                    </div>
                    <span className="badge badge-strong">
                      {w.season}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="note m-0">
                Nessuna edizione precedente registrata.
              </p>
            )}
          </div>

          {/* Tournament How It Works & Fair Play Box */}
          <div className="rules-box">
            <h3 className="mt-0">♟️ Come funziona il torneo</h3>

            <h4 className="rules-heading">Svolgimento</h4>
            {tournamentMeta.howItWorks ? (
              <div className="rules-text">
                {tournamentMeta.howItWorks}
              </div>
            ) : (
              <ol className="rules-list">
                <li>
                  All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.
                </li>
                <li>
                  Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.
                </li>
              </ol>
            )}

            <hr className="divider wide" />

            <h4 className="rules-heading">🌈 Regole di fair play</h4>
            {tournamentMeta.fairPlayText ? (
              <div className="rules-text">
                {tournamentMeta.fairPlayText}
              </div>
            ) : (
              <ul className="rules-list">
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

            <hr className="divider wide" />

            <h4 className="rules-heading">⚙️ Parametri Tecnici Lichess</h4>
            <ul className="rules-list tight">
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
