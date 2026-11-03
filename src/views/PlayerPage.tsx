import React, { useEffect } from 'react';
import { AppConfig, HistoryGame, LichessExportGame } from '../types';
import { computePlayerProfile, formatPace, GameOutcome } from '../lib/playerProfile';
import { playerHref } from '../lib/routes';
import { PointsChart } from '../components/PointsChart';

interface PlayerPageProps {
  handle: string;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
}

const OUTCOME_LABEL: Record<GameOutcome, string> = {
  win: "Vittoria",
  loss: "Sconfitta",
  draw: "Patta",
  ongoing: "In corso",
  pending: "In attesa",
};

const OUTCOME_CLASS: Record<GameOutcome, string> = {
  win: "win",
  loss: "loss",
  draw: "draw",
  ongoing: "ongoing",
  pending: "pending",
};

// Public page of a single player: results, games and opponents still to face
export function PlayerPage({ handle, config, history, gameStates, nameOf }: PlayerPageProps) {
  const profile = computePlayerProfile(handle, config.players, history, gameStates, config.schedule ?? []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [handle]);

  useEffect(() => {
    const previous = document.title;
    if (profile) document.title = `${profile.player.name} – ${config.tournament?.title ?? "Scacchi and Chill"}`;
    return () => {
      document.title = previous;
    };
  }, [profile?.player.name, config.tournament?.title]);

  if (!profile) {
    return (
      <main className="public-main">
        <a href="#" className="chip-link back-link">← Torna al torneo</a>
        <p className="note">Giocatore «{handle}» non trovato.</p>
      </main>
    );
  }

  const { player, rank, standing, games, pointsByRound, headToHead, pace } = profile;
  const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

  return (
    <main className="public-main">
      <a href="#" className="chip-link back-link">← Torna al torneo</a>

      <section className="dossier-card player-hero">
        <h1 className="hero-title">{player.name}</h1>
        <a
          className="player-link"
          href={`https://lichess.org/@/${player.handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{player.handle} su Lichess
        </a>

        <div className="stat-pills">
          <div className="stat-pill">
            <span className="stat-pill-label">Posizione</span>
            <span className="stat-pill-val accent">{rank}° / {config.players.length}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Punti</span>
            <span className="stat-pill-val">{standing.points}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">V / N / P</span>
            <span className="stat-pill-val">{standing.won} / {standing.drawn} / {standing.lost}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Spareggio SB</span>
            <span className="stat-pill-val">{standing.sb.toFixed(1)}</span>
          </div>
          {pace && (
            <div
              className="stat-pill"
              title={`Tempo medio tra una mossa e l'altra nelle sue partite (di entrambi i giocatori), su ${pace.games} ${pace.games === 1 ? "partita" : "partite"}`}
            >
              <span className="stat-pill-label">Ritmo partite</span>
              <span className="stat-pill-val">{formatPace(pace.msPerMove)} a mossa</span>
            </div>
          )}
        </div>
      </section>

      {pointsByRound.length > 0 && (
        <section className="dossier-card">
          <h2 className="section-heading">Andamento</h2>
          <PointsChart data={pointsByRound} nameOf={nameOf} />
        </section>
      )}

      <section className="dossier-card">
        <h2 className="section-heading">Scontri diretti</h2>
        <ul className="h2h-list">
          {headToHead.map((h) => (
            <li key={h.opponent} className="h2h-row">
              <a href={playerHref(h.opponent)} className="h2h-name">{nameOf(h.opponent)}</a>
              <span className="h2h-games">
                {h.outcomes.map((o, i) => (
                  <span key={i} className={`status-badge ${OUTCOME_CLASS[o]}`}>{OUTCOME_LABEL[o]}</span>
                ))}
                {h.upcoming.map((u, i) => (
                  <span key={`u${i}`} className="status-badge pending h2h-upcoming">
                    {u.color && (
                      <span className={`dot ${u.color === "white" ? "w" : "b"}`} aria-label={u.color === "white" ? "Col bianco" : "Col nero"} />
                    )}
                    {u.round ? `Turno ${u.round}` : "Da programmare"}
                  </span>
                ))}
                {h.outcomes.length === 0 && h.upcoming.length === 0 && (
                  <span className="status-badge pending">Da programmare</span>
                )}
              </span>
              <span className="h2h-score" aria-label={`Punteggio ${fmt(h.scored)} a ${fmt(h.conceded)}`}>
                {h.scored + h.conceded > 0 ? `${fmt(h.scored)} – ${fmt(h.conceded)}` : "–"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dossier-card">
        <h2 className="section-heading">Partite ({games.length})</h2>
        {games.length === 0 ? (
          <p className="note m-0">Nessuna partita ancora registrata.</p>
        ) : (
          <ul className="player-games">
            {games.map((game) => (
              <li key={game.url} className="player-game">
                <span className="match-round">Turno {game.round}</span>
                <span className="player-game-main">
                  <span className={`dot ${game.color === "white" ? "w" : "b"}`} aria-label={game.color === "white" ? "Bianco" : "Nero"} />
                  <a href={playerHref(game.opponent)}>{nameOf(game.opponent)}</a>
                </span>
                <span className={`status-badge ${OUTCOME_CLASS[game.outcome]}`}>{OUTCOME_LABEL[game.outcome]}</span>
                <a href={game.url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn">
                  Lichess
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
