import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame } from '../types';
import { DEFAULT_TOURNAMENT } from '../lib/tournament';
import { LoadingScreen } from '../components/LoadingScreen';
import { PublicTournamentView } from '../PublicTournamentView';

interface PublicPageProps {
  ready: boolean;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
}

// Public tournament page, with a discreet link to the organizer area
export function PublicPage({ ready, config, history, gameStates, nameOf }: PublicPageProps) {
  if (!ready) return <LoadingScreen label="Caricamento torneo…" />;

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
      />

      <div className="public-footer">
        <a href="#admin" className="admin-link">
          🔒 Area Organizzatore
        </a>
      </div>
    </main>
  );
}
