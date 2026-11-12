import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { DEFAULT_TOURNAMENT } from '../lib/tournament';
import { useHash } from '../hooks/useHash';
import { parsePlayerHash, publicViewHref } from '../lib/routes';
import { PlayerPage } from './PlayerPage';
import { LoadingScreen } from '../components/LoadingScreen';
import { PublicTournamentView } from '../PublicTournamentView';
import { PresenceInfo } from '../lib/presence';
import { NameOf } from '../lib/roster';

interface PublicPageProps {
  seasons: SeasonArchive[];
  ready: boolean;
  // The tournament could not be read from Firestore (it is tried again by itself)
  failed?: boolean;
  onRetry?: () => void;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  // Last time the open games were read live from Lichess
  liveUpdatedAt?: Date | null;
  nameOf: NameOf;
  // When each player was last on Lichess
  presence?: PresenceInfo;
}

// Public tournament page, with a discreet link to the organizer area
export function PublicPage({ seasons, ready, failed, onRetry, config, history, gameStates, liveUpdatedAt, nameOf, presence }: PublicPageProps) {
  const hash = useHash();
  // Nothing read yet: never an empty tournament in its place
  if (!ready && failed) {
    return (
      <LoadingScreen label="Non riesco a leggere i dati del torneo. Riprovo tra poco…">
        <button type="button" className="secondary" onClick={onRetry}>
          Riprova ora
        </button>
      </LoadingScreen>
    );
  }
  if (!ready) return <LoadingScreen label="Caricamento torneo…" />;

  const playerHandle = parsePlayerHash(hash);
  if (playerHandle) {
    return <PlayerPage handle={playerHandle} config={config} history={history} gameStates={gameStates} nameOf={nameOf} presence={presence} seasons={seasons} />;
  }

  return (
    <main className="public-main">
      <PublicTournamentView
        config={config}
        tournamentMeta={config.tournament || DEFAULT_TOURNAMENT}
        history={history}
        gameStates={gameStates}
        nameOf={nameOf}
        seasons={seasons}
        presence={presence}
        movesRead={!!liveUpdatedAt}
      />

      <footer className="public-footer">
        {liveUpdatedAt && (
          <p className="live-note">
            Risultati letti da Lichess alle {liveUpdatedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        <nav className="footer-links" aria-label="Collegamenti">
          <a href={publicViewHref("rules")}>Regolamento</a>
          <a href="#admin" className="admin-link">Area organizzatore</a>
        </nav>
      </footer>
    </main>
  );
}
