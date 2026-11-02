import React, { useEffect } from 'react';
import { AppConfig, HistoryGame, LichessExportGame } from '../types';
import { computePlayerProfile, GameOutcome } from '../lib/playerProfile';
import { playerHref } from '../lib/routes';

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
      <main>
        <a href="#" className="chip-link back-link">← Torna al torneo</a>
        <p className="note">Giocatore «{handle}» non trovato.</p>
      </main>
    );
  }

  const { player, rank, standing, games, remaining } = profile;

  return (
    <main>
      <a href="#" className="chip-link back-link">← Torna al torneo</a>

      <section className="dossier-card player-hero">
        <span className="eyebrow">Giocatore</span>
        <h1 className="view-title">{player.name}</h1>
        <a
          className="player-link"
          href={`https://lichess.org/@/${player.handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{player.handle} ↗
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
            <span className="stat-pill-label">V · N · P</span>
            <span className="stat-pill-val">{standing.won} · {standing.drawn} · {standing.lost}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Spareggio SB</span>
            <span className="stat-pill-val">{standing.sb.toFixed(1)}</span>
          </div>
        </div>
      </section>

      <section className="dossier-card">
        <h2 className="dossier-heading">♟️ Partite ({games.length})</h2>
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
                  Lichess ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dossier-card">
        <h2 className="dossier-heading">⏭️ Avversari da affrontare ({remaining.length})</h2>
        {remaining.length === 0 ? (
          <p className="note m-0">Ha già affrontato tutti gli avversari. 🎉</p>
        ) : (
          <ul className="player-games">
            {remaining.map((r) => (
              <li key={r.opponent} className="player-game">
                <span className="match-round">{r.round ? `Turno ${r.round}` : "Da programmare"}</span>
                <span className="player-game-main">
                  {r.color && (
                    <span className={`dot ${r.color === "white" ? "w" : "b"}`} aria-label={r.color === "white" ? "Bianco" : "Nero"} />
                  )}
                  <a href={playerHref(r.opponent)}>{nameOf(r.opponent)}</a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
