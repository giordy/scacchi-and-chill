import React, { useState } from "react";
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from "./types";
import { SeasonsHistory } from "./components/SeasonsHistory";
import { playerHref } from "./lib/routes";
import { computeStandings } from "./lib/standings";
import { computeSeasonProgress } from "./lib/progress";
import { DEFAULT_TOURNAMENT } from "./lib/tournament";
import { onTabListKeyDown } from "./lib/tabKeys";
import { parsePublicTab, publicTabHref, PublicTab } from "./lib/routes";
import { useHash } from "./hooks/useHash";
import { isReturnLeg, returnLegStart } from "./lib/legs";
import { MatchesByRound } from "./components/MatchesByRound";
import { summitGames } from "./lib/summit";
import { fullPodium, MEDAL_EMOJI, reigningChampions } from "./lib/honours";
import { withScheduledGames } from "./lib/publicGames";
import { computeSeasonAwards } from "./lib/awards";
import { SeasonAwards } from "./components/SeasonAwards";

interface PublicTournamentViewProps {
  config: AppConfig;
  tournamentMeta: TournamentMeta;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  seasons?: SeasonArchive[];
}

type SubTab = PublicTab;

const TABS: { key: SubTab; label: string }[] = [
  { key: "standings", label: "Classifica" },
  { key: "matches", label: "Partite" },
  { key: "crosstable", label: "Tabellone" },
  { key: "tournament", label: "Torneo" },
];

const byRound = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function PublicTournamentView({
  config,
  tournamentMeta,
  history,
  gameStates,
  nameOf,
  seasons = [],
}: PublicTournamentViewProps) {
  // The open section lives in the URL hash, so a refresh or a shared link keeps it
  const subTab = parsePublicTab(useHash());
  const setSubTab = (tab: SubTab) => {
    window.location.hash = publicTabHref(tab);
  };
  const [filterRound, setFilterRound] = useState<string>("all");

  const schedule = config.schedule ?? [];
  const { standings, crosstable } = computeStandings(config.players, history, gameStates);
  const progress = computeSeasonProgress(history, gameStates, schedule);
  const leader = standings[0] && standings[0].points > 0 ? standings[0] : undefined;
  const concluded = progress.total > 0 && progress.finished === progress.total;
  const awards = concluded ? computeSeasonAwards(config.players, history, gameStates) : [];

  // Created games plus the scheduled ones still to be created on Lichess
  const allGames = withScheduledGames(history, schedule);
  const rounds = [...new Set(allGames.map((g) => g.round))].sort(byRound);
  const summits = summitGames(config.players, allGames, gameStates);
  const champions = reigningChampions(tournamentMeta.winners);
  // Andata/ritorno: from the official schedule when there is one, otherwise from the games created so far
  const returnStart = returnLegStart(schedule.length > 0 ? schedule : history);
  const scheduleIndex = (g: HistoryGame) =>
    schedule.findIndex((m) => m.round === g.round && m.white === g.white && m.black === g.black);
  // Round order first, then the order of the official schedule
  const filteredGames = (filterRound === "all" ? allGames : allGames.filter((g) => g.round === filterRound))
    .slice()
    .sort((a, b) => {
      const r = byRound(a.round, b.round);
      if (r !== 0) return r;
      const ia = scheduleIndex(a);
      const ib = scheduleIndex(b);
      if (ia === -1 || ib === -1) return ia === ib ? 0 : ia === -1 ? 1 : -1;
      return ia - ib;
    });

  // Default photo only for the original Capablanca season: a new master without a photo shows none
  const masterName = tournamentMeta.masterName ?? "";
  const masterPhoto =
    tournamentMeta.imageUrl || (!masterName || /capablanca/i.test(masterName) ? "assets/capablanca.jpg" : "");
  const days = tournamentMeta.daysPerMove ?? config.defaults.days;
  const rated = tournamentMeta.rated ?? config.defaults.rated;

  const roundLine = progress.currentRound
    ? progress.finished === progress.total && progress.total > 0
      ? "Stagione conclusa."
      : `Turno ${progress.currentRound} in corso.`
    : "La stagione sta per cominciare.";
  const leaderLine = leader ? ` In testa ${leader.name} con ${leader.points} ${leader.points === 1 ? "punto" : "punti"}.` : "";

  return (
    <div className="public-tournament">
      <header className="hero">
        <div className="hero-identity">
          {masterPhoto && (
            <button
              type="button"
              className="hero-portrait"
              onClick={() => setSubTab("tournament")}
              aria-label={`${masterName || "Il maestro della stagione"}: leggi la presentazione`}
            >
              <img src={masterPhoto} alt="" />
            </button>
          )}
          <div className="hero-text">
            <h1 className="hero-title">{tournamentMeta.title}</h1>
            <p className="hero-season">{tournamentMeta.season}</p>
          </div>
        </div>

        <p className="hero-status">
          {roundLine}
          {leaderLine}
        </p>

        {progress.total > 0 && (
          <figure className="season-board">
            <div
              className="season-squares"
              role="img"
              aria-label={`${progress.finished} partite concluse e ${progress.ongoing} in corso su ${progress.total}`}
            >
              {progress.games.map((s, i) => (
                <span key={i} className={`sq sq-${s}`} />
              ))}
            </div>
            <figcaption className="season-legend">
              <span><i className="sq sq-finished" aria-hidden="true" /> {progress.finished} concluse</span>
              {progress.ongoing > 0 && (
                <span><i className="sq sq-ongoing" aria-hidden="true" /> {progress.ongoing} in corso</span>
              )}
              <span><i className="sq sq-pending" aria-hidden="true" /> {progress.total - progress.finished - progress.ongoing} da giocare</span>
            </figcaption>
          </figure>
        )}
      </header>

      <nav className="public-subnav" role="tablist" aria-label="Sezioni del torneo" onKeyDown={onTabListKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pub-tab-btn ${subTab === t.key ? "active" : ""}`}
            role="tab"
            id={`pub-tab-${t.key}`}
            aria-selected={subTab === t.key}
            tabIndex={subTab === t.key ? 0 : -1}
            aria-controls={`pub-panel-${t.key}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === "standings" && (
        <section role="tabpanel" id="pub-panel-standings" aria-labelledby="pub-tab-standings">
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col" scope="col">Giocatore</th>
                  <th className="col-center" scope="col">Punti</th>
                  <th className="col-center" scope="col" title="Partite giocate">G</th>
                  <th className="col-center" scope="col" title="Vinte">V</th>
                  <th className="col-center" scope="col" title="Patte">N</th>
                  <th className="col-center" scope="col" title="Perse">P</th>
                  <th className="col-center" scope="col" title="Spareggio Sonneborn-Berger">SB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, idx) => (
                  <tr key={p.handle} className={idx === 0 && leader ? "row-leader" : ""}>
                    <td className="col-rank"><span className={`rank${idx < 3 && p.points > 0 ? ` podium-${idx + 1}` : ""}`}>{idx + 1}</span></td>
                    <td className="sticky-col">
                      <div className="player-cell">
                        <span className="player-name-line">
                          <a href={playerHref(p.handle)} className="player-name player-page-link">{p.name}</a>
                          {champions?.handles.includes(p.handle.toLowerCase()) && (
                            <span className="champion-badge" title={`Campione in carica · ${champions.season}`} aria-label={`Campione in carica, ${champions.season}`}>
                              👑
                            </span>
                          )}
                        </span>
                        <a
                          href={`https://lichess.org/@/${p.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="player-link"
                        >
                          @{p.handle}
                        </a>
                      </div>
                    </td>
                    <td className="col-points">{p.points}</td>
                    <td className="col-center">{p.played}</td>
                    <td className="col-center">{p.won}</td>
                    <td className="col-center">{p.drawn}</td>
                    <td className="col-center">{p.lost}</td>
                    <td className="col-center stat-sb">{p.sb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note note-top-xs">
            A parità di punti decide lo spareggio Sonneborn-Berger (SB), poi il numero di vittorie. Tocca un nome per
            vedere le partite del giocatore.
          </p>
          {awards.length > 0 && (
            <div className="awards-section">
              <h2 className="section-heading">I premi della stagione</h2>
              <SeasonAwards awards={awards} />
            </div>
          )}
        </section>
      )}

      {subTab === "crosstable" && (
        <section role="tabpanel" id="pub-panel-crosstable" aria-labelledby="pub-tab-crosstable">
          <div className="table-responsive">
            <table className="crosstable">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col" scope="col">Giocatore</th>
                  {standings.map((_, i) => (
                    <th key={i} className="col-cross" scope="col">{i + 1}</th>
                  ))}
                  <th className="col-center" scope="col">Tot</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, rowIdx) => (
                  <tr key={p.handle}>
                    <td className="col-rank"><span className="rank">{rowIdx + 1}</span></td>
                    <td className="sticky-col player-name nowrap">
                      <a href={playerHref(p.handle)} className="player-page-link">{p.name}</a>
                    </td>
                    {standings.map((opp, colIdx) => {
                      const res = crosstable[p.handle]?.[opp.handle] ?? "-";
                      const kind =
                        rowIdx === colIdx ? "self" : res === "1" ? "win" : res === "0" ? "loss" : res === "½" ? "draw" : "empty";
                      return (
                        <td key={opp.handle} className={`cross-cell ${kind}`}>
                          {kind === "self" ? "" : res}
                        </td>
                      );
                    })}
                    <td className="col-points">{p.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note note-top-xs">Ogni riga è il risultato del giocatore contro l'avversario della colonna.</p>
        </section>
      )}

      {subTab === "matches" && (
        <section role="tabpanel" id="pub-panel-matches" aria-labelledby="pub-tab-matches">
          {rounds.length > 0 && (
            <div className="filter-row">
              <label htmlFor="filter-round">Turno</label>
              <select
                id="filter-round"
                className="filter-select"
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
              >
                <option value="all">Tutti ({allGames.length} partite)</option>
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Turno {r}
                    {returnStart !== undefined ? (isReturnLeg(r, returnStart) ? " (ritorno)" : " (andata)") : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredGames.length === 0 ? (
            <p className="note">Le partite compariranno qui quando l'organizzatore pubblica il calendario.</p>
          ) : (
            <MatchesByRound
              games={filteredGames}
              gameStates={gameStates}
              nameOf={nameOf}
              returnStart={returnStart}
              summits={summits}
            />
          )}
        </section>
      )}

      {subTab === "tournament" && (
        <section role="tabpanel" id="pub-panel-tournament" aria-labelledby="pub-tab-tournament" className="tournament-panel">
          <article className="dossier-card">
            <div className="dossier-row">
              {masterPhoto && (
                <div className="dossier-photo">
                  <img src={masterPhoto} alt={masterName || "Il maestro della stagione"} className="dossier-photo-img" />
                </div>
              )}
              <div className="dossier-body">
                <p className="dossier-kicker">{tournamentMeta.season} è dedicata a</p>
                <h2 className="dossier-name">{masterName || "un grande maestro"}</h2>
                {tournamentMeta.subtitle && <p className="dossier-subtitle">«{tournamentMeta.subtitle}»</p>}
                <div className="story-text">{tournamentMeta.description || DEFAULT_TOURNAMENT.description}</div>
              </div>
            </div>
          </article>

          <article className="rules-box">
            <h2 className="section-heading">Regolamento</h2>

            <h3 className="rules-heading">Come funziona</h3>
            <div className="rules-text">{tournamentMeta.howItWorks || DEFAULT_TOURNAMENT.howItWorks}</div>

            <h3 className="rules-heading">Fair play</h3>
            <div className="rules-text">{tournamentMeta.fairPlayText || DEFAULT_TOURNAMENT.fairPlayText}</div>

            <h3 className="rules-heading">Partite su Lichess</h3>
            <ul className="rules-list">
              <li>
                <strong>Tempo:</strong> {days} {days === 1 ? "giorno" : "giorni"} per mossa, in modalità corrispondenza.
              </li>
              <li>
                {rated ? (
                  <><strong>Rated:</strong> le partite contano per il tuo Elo Lichess.</>
                ) : (
                  <><strong>Amichevoli:</strong> le partite non contano per il tuo Elo Lichess.</>
                )}
              </li>
            </ul>
          </article>

          <article className="dossier-card">
            <h2 className="section-heading">Albo d'Oro</h2>
            {tournamentMeta.winners && tournamentMeta.winners.length > 0 ? (
              <ol className="winners-list">
                {tournamentMeta.winners.map((w, idx) => (
                  <li key={idx} className="winner-row">
                    <span className="winner-season">{w.season}</span>
                    <ol className="winner-podium">
                      {fullPodium(w).map((p) => (
                        <li key={p.handle} className={`podium-place podium-place-${p.place}`}>
                          <span className="podium-medal" aria-label={`${p.place}° posto`}>{MEDAL_EMOJI[p.place]}</span>
                          {p.place === 1 ? (
                            <a href={`https://lichess.org/@/${p.handle}`} target="_blank" rel="noopener noreferrer">
                              {p.name}
                            </a>
                          ) : (
                            <span>{p.name}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                    {w.notes && <span className="winner-notes">{w.notes}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="note m-0">Il primo campione sarà scritto qui a fine stagione.</p>
            )}
          </article>

          {seasons.length > 0 && (
            <div>
              <h2 className="section-heading">Stagioni passate</h2>
              <SeasonsHistory seasons={seasons} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
