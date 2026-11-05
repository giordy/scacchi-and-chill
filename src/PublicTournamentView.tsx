import React, { useMemo, useState } from "react";
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from "./types";
import { SeasonsHistory } from "./components/SeasonsHistory";
import { playerHref } from "./lib/routes";
import { computeStandings } from "./lib/standings";
import { computeSeasonProgress } from "./lib/progress";
import { DEFAULT_TOURNAMENT } from "./lib/tournament";
import { onTabListKeyDown } from "./lib/tabKeys";
import { parsePublicView, publicViewHref, PublicTab, PublicView, tabOfView } from "./lib/routes";
import { useHash } from "./hooks/useHash";
import { isReturnLeg, returnLegStart } from "./lib/legs";
import { MatchesByRound } from "./components/MatchesByRound";
import { summitGames } from "./lib/summit";
import { fullPodium, MEDAL_EMOJI, reigningChampions } from "./lib/honours";
import { withdrawalNote } from "./lib/withdrawals";
import { titleRace } from "./lib/titleRace";
import { SeasonStatsPanel } from "./components/SeasonStatsPanel";
import { seasonStats } from "./lib/seasonStats";
import { publishedAnecdotes } from "./lib/masterAnecdotes";
import { formatWhatsAppMarkup } from "./WhatsAppPreview";
import { withScheduledGames } from "./lib/publicGames";
import { computeSeasonAwards } from "./lib/awards";
import { SeasonAwards } from "./components/SeasonAwards";
import { byRound } from "./lib/games";

interface PublicTournamentViewProps {
  config: AppConfig;
  tournamentMeta: TournamentMeta;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  seasons?: SeasonArchive[];
}

const TABS: { key: PublicTab; label: string }[] = [
  { key: "standings", label: "Classifica" },
  { key: "matches", label: "Partite" },
  { key: "season", label: "Stagione" },
  { key: "hall", label: "Albo" },
];

// "Anna", "Anna e Bruno", "Anna, Bruno e Carla"
const namesList = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names[0] ?? "";
const ALBO_HREF = publicViewHref("hall");

export function PublicTournamentView({
  config,
  tournamentMeta,
  history,
  gameStates,
  nameOf,
  seasons = [],
}: PublicTournamentViewProps) {
  // The open section lives in the URL hash, so a refresh or a shared link keeps it
  const view = parsePublicView(useHash());
  const activeTab = tabOfView(view);
  const show = (v: PublicView) => {
    window.location.hash = publicViewHref(v);
  };
  const [filterRound, setFilterRound] = useState<string>("all");

  const players = config.players;
  const schedule = useMemo(() => config.schedule ?? [], [config.schedule]);
  // The whole season at once, recomputed only when the games or their results change
  // (not when the visitor switches tab or round filter)
  const season = useMemo(() => {
    const { standings, crosstable } = computeStandings(players, history, gameStates);
    const progress = computeSeasonProgress(history, gameStates, schedule);
    const concluded = progress.total > 0 && progress.finished === progress.total;
    // Created games plus the scheduled ones still to be created on Lichess
    const allGames = withScheduledGames(history, schedule);
    return {
      standings,
      crosstable,
      progress,
      concluded,
      awards: concluded ? computeSeasonAwards(players, history, gameStates) : [],
      allGames,
      rounds: [...new Set(allGames.map((g) => g.round))].sort(byRound),
      summits: summitGames(players, allGames, gameStates),
      race: titleRace(players, allGames, gameStates),
      stats: seasonStats(players, history, gameStates),
    };
  }, [players, history, gameStates, schedule]);
  const { standings, crosstable, progress, concluded, awards, allGames, rounds, summits, race, stats } = season;
  const leader = standings[0] && standings[0].points > 0 ? standings[0] : undefined;
  const champions = reigningChampions(tournamentMeta.winners);
  // Anecdotes of the rounds already started, newest first; the next ones stay a surprise
  const anecdotes = useMemo(() => publishedAnecdotes(tournamentMeta.masterAnecdotes, history), [tournamentMeta.masterAnecdotes, history]);
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
              onClick={() => show("season")}
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
            className={`pub-tab-btn ${activeTab === t.key ? "active" : ""}`}
            role="tab"
            id={`pub-tab-${t.key}`}
            aria-selected={activeTab === t.key}
            tabIndex={activeTab === t.key || (!activeTab && t.key === "standings") ? 0 : -1}
            aria-controls={`pub-panel-${t.key}`}
            onClick={() => show(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "standings" && (
        <section role="tabpanel" id="pub-panel-standings" aria-labelledby="pub-tab-standings">
          <div className="view-switch" role="group" aria-label="Vista della classifica">
            <button type="button" className={view === "standings" ? "active" : ""} aria-pressed={view === "standings"} onClick={() => show("standings")}>
              Classifica
            </button>
            <button type="button" className={view === "crosstable" ? "active" : ""} aria-pressed={view === "crosstable"} onClick={() => show("crosstable")}>
              Tabellone
            </button>
          </div>
        </section>
      )}

      {view === "standings" && (
        <section aria-label="Classifica">
          {race && (
            <p className="title-race" role="status">
              {race.champion ? (
                <>
                  🏆 <strong>{race.champion.name}</strong> è campione matematico: nessuno può più raggiungerlo, con{" "}
                  {race.roundsLeft === 1 ? "un turno" : `${race.roundsLeft} turni`} d'anticipo.
                </>
              ) : (
                <>
                  🏁 <strong>Corsa al titolo:</strong> possono ancora vincere {namesList(race.contenders.map((c) => c.name))}
                  {" · "}
                  {race.roundsLeft === 1 ? "manca un turno" : `mancano ${race.roundsLeft} turni`}.
                </>
              )}
            </p>
          )}
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
                            <a
                              href={ALBO_HREF}
                              className="champion-badge"
                              title={`Campione in carica · ${champions.season}`}
                              aria-label={`Campione in carica, ${champions.season}: vai all'Albo d'Oro`}
                            >
                              👑
                            </a>
                          )}
                          {withdrawalNote(p.handle, tournamentMeta.withdrawals) && (
                            <span className="withdrawal-tag">{withdrawalNote(p.handle, tournamentMeta.withdrawals)}</span>
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

      {view === "crosstable" && (
        <section aria-label="Tabellone">
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

      {view === "matches" && (
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

      {view === "season" && (
        <section role="tabpanel" id="pub-panel-season" aria-labelledby="pub-tab-season" className="tournament-panel">
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
                <div className="story-text">{formatWhatsAppMarkup(tournamentMeta.description || DEFAULT_TOURNAMENT.description)}</div>
              </div>
            </div>
          </article>

          {anecdotes.length > 0 && (
            <article className="dossier-card">
              <h2 className="section-heading">Gli aneddoti di {masterName || "questa stagione"}</h2>
              <div className="anecdotes">
                {[...anecdotes].reverse().map(({ n, anecdote }, i) => (
                  <details key={n} className="anecdote" open={i === 0}>
                    <summary>
                      <span className="anecdote-n">#{n}</span> {anecdote.title.replace(/[*_]/g, "")}
                    </summary>
                    <div className="anecdote-text">{formatWhatsAppMarkup(anecdote.text)}</div>
                  </details>
                ))}
              </div>
            </article>
          )}

          {stats && (
            <article className="dossier-card">
              <SeasonStatsPanel stats={stats} />
            </article>
          )}

          <p className="note season-rules-link">
            Come si gioca, fair play e ritiri: <a href={publicViewHref("rules")}>leggi il regolamento</a>.
          </p>
        </section>
      )}

      {view === "hall" && (
        <section role="tabpanel" id="pub-panel-hall" aria-labelledby="pub-tab-hall" className="tournament-panel">
          <article className="dossier-card" id="albo-doro">
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
                          <a href={playerHref(p.handle)}>{p.name}</a>
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

      {view === "rules" && (
        <section aria-label="Regolamento" className="tournament-panel">
          <article className="rules-box">
            <h2 className="section-heading">Regolamento</h2>

            <details className="rules-section" open>
              <summary className="rules-heading">Come funziona</summary>
              <div className="rules-text">{tournamentMeta.howItWorks || DEFAULT_TOURNAMENT.howItWorks}</div>
            </details>

            <details className="rules-section" open>
              <summary className="rules-heading">Fair play</summary>
              <div className="rules-text">{tournamentMeta.fairPlayText || DEFAULT_TOURNAMENT.fairPlayText}</div>
            </details>

            <details className="rules-section" open>
              <summary className="rules-heading">Ritiri</summary>
              <div className="rules-text">{tournamentMeta.withdrawalText || DEFAULT_TOURNAMENT.withdrawalText}</div>
            </details>

            <details className="rules-section" open>
              <summary className="rules-heading">Partite su Lichess</summary>
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
            </details>
          </article>
        </section>
      )}
    </div>
  );
}
