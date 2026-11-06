import React, { lazy, Suspense, useMemo, useState } from 'react';
import { AppConfig, HistoryGame } from './types';
import { defaultConfig } from './lib/config';
import { useAdminRoute } from './hooks/useAdminRoute';
import { useTournamentSync } from './hooks/useTournamentSync';
import { useSeasons } from './hooks/useSeasons';
import { useLiveGameStates } from './hooks/useLiveGameStates';
import { usePresence } from './hooks/usePresence';
import { LoadingScreen } from './components/LoadingScreen';
import { PublicPage } from './views/PublicPage';
import { applyWithdrawals } from './lib/withdrawals';
import { nameFrom, storedStates } from './lib/games';

// The organizer area is a separate chunk: downloaded only when #admin is opened
const AdminApp = lazy(() => import('./AdminApp'));

export function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  // Mirror of the games on Firestore (see useTournamentSync): never kept in this browser
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const isAdminRoute = useAdminRoute();
  const { ready, gamesLoaded } = useTournamentSync(setConfig, setHistory);
  const seasons = useSeasons();

  // Public page: results read live from Lichess on top of the saved ones
  const saved = useMemo(() => storedStates(history), [history]);
  const live = useLiveGameStates(history, saved, !isAdminRoute && gamesLoaded);
  // Public page: when each player was last on Lichess
  const handles = useMemo(() => config.players.map((p) => p.handle), [config.players]);
  const presence = usePresence(handles, !isAdminRoute && ready);
  // Results as the standings see them: games annulled or won by forfeit after a withdrawal
  const withdrawals = config.tournament?.withdrawals;
  const seasonHistory = useMemo(() => applyWithdrawals(history, withdrawals), [history, withdrawals]);

  if (isAdminRoute) {
    return (
      <Suspense fallback={<LoadingScreen label="Apertura area organizzatore…" />}>
        <AdminApp
          config={config}
          setConfig={setConfig}
          history={history}
          setHistory={setHistory}
          gamesLoaded={gamesLoaded}
          seasons={seasons}
        />
      </Suspense>
    );
  }

  const nameOf = nameFrom(config.players);
  return (
    <PublicPage
      seasons={seasons}
      ready={ready}
      config={config}
      history={seasonHistory}
      gameStates={live.gameStates}
      liveUpdatedAt={live.updatedAt}
      presence={presence}
      nameOf={nameOf}
    />
  );
}

export default App;
