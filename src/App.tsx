import React, { lazy, Suspense, useMemo } from 'react';
import { useAdminRoute } from './hooks/useAdminRoute';
import { usePublicData } from './hooks/usePublicData';
import { useLiveGameStates } from './hooks/useLiveGameStates';
import { usePresence } from './hooks/usePresence';
import { LoadingScreen } from './components/LoadingScreen';
import { PublicPage } from './views/PublicPage';
import { applyWithdrawals } from './lib/withdrawals';
import { storedStates } from './lib/games';
import { fullRoster, rosterNameOf } from './lib/roster';
import { NamesContext } from './components/Names';

// The organizer area is a separate chunk, with the Firebase SDK: downloaded only when #admin is opened
const AdminRoot = lazy(() => import('./AdminRoot'));

export function App() {
  const isAdminRoute = useAdminRoute();
  // Public page: Firestore read with plain requests (see lib/firestoreRest), no SDK
  const { config, history, seasons, ready, failed, retry, gamesLoaded } = usePublicData(!isAdminRoute);

  // Public page: results read live from Lichess on top of the saved ones
  const saved = useMemo(() => storedStates(history), [history]);
  const live = useLiveGameStates(history, saved, !isAdminRoute && gamesLoaded);
  // Public page: when each player was last on Lichess
  const handles = useMemo(() => config.players.map((p) => p.handle), [config.players]);
  const presence = usePresence(handles, !isAdminRoute && ready);
  // Results as the standings see them: games annulled or won by forfeit after a withdrawal
  const withdrawals = config.tournament?.withdrawals;
  const seasonHistory = useMemo(() => applyWithdrawals(history, withdrawals), [history, withdrawals]);
  // Names from the players register: the same everywhere, past seasons included
  const nameOf = useMemo(
    () => rosterNameOf(fullRoster({ roster: config.tournament?.roster, players: config.players, seasons, winners: config.tournament?.winners })),
    [config.tournament?.roster, config.players, seasons, config.tournament?.winners]
  );

  if (isAdminRoute) {
    return (
      <Suspense fallback={<LoadingScreen label="Apertura area organizzatore…" />}>
        <AdminRoot />
      </Suspense>
    );
  }

  return (
    <NamesContext.Provider value={nameOf}>
      <PublicPage
        seasons={seasons}
        ready={ready}
        failed={failed}
        onRetry={retry}
        config={config}
        history={seasonHistory}
        gameStates={live.gameStates}
        liveUpdatedAt={live.updatedAt}
        presence={presence}
        nameOf={nameOf}
      />
    </NamesContext.Provider>
  );
}

export default App;
