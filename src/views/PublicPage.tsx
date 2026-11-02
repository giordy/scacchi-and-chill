import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { DEFAULT_TOURNAMENT } from '../lib/tournament';
import { useHash } from '../hooks/useHash';
import { parsePlayerHash } from '../lib/routes';
import { PlayerPage } from './PlayerPage';
import { LoadingScreen } from '../components/LoadingScreen';
import { PublicTournamentView } from '../PublicTournamentView';

interface PublicPageProps {
  seasons: SeasonArchive[];
  ready: boolean;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
}

// Public tournament page, with a discreet link to the organizer area
export function PublicPage({ seasons, ready, config, history, gameStates, nameOf }: PublicPageProps) {
  const hash = useHash();
  if (!ready) return <LoadingScreen label="Caricamento torneo…" />;

  const playerHandle = parsePlayerHash(hash);
  if (playerHandle) {
    return <PlayerPage handle={playerHandle} config={config} history={history} gameStates={gameStates} nameOf={nameOf} />;
  }

  return (
    <main>
      <PublicTournamentView
        config={config}
        tournamentMeta={
          config.tournament || {
            ...DEFAULT_TOURNAMENT,
            rulesText: "2 giorni a mossa. Nessuna rivincita. Fair play assoluto.",
          }
        }
        history={history}
        gameStates={gameStates}
        nameOf={nameOf}
        seasons={seasons}
      />

      <div className="public-footer">
        <a href="#admin" className="admin-link">
          🔒 Area Organizzatore
        </a>
      </div>
    </main>
  );
}
