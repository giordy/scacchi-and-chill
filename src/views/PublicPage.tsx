import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame } from '../types';
import { DEFAULT_TOURNAMENT } from '../lib/tournament';
import { PublicTournamentView } from '../PublicTournamentView';

interface PublicPageProps {
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
}

// Public tournament page, with a discreet link to the organizer area
export function PublicPage({ config, history, gameStates, nameOf }: PublicPageProps) {
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

      <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <a
          href="#admin"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: 0.85,
          }}
        >
          🔒 Area Organizzatore
        </a>
      </div>
    </main>
  );
}
