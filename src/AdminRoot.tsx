import React, { useMemo, useState } from 'react';
import { AppConfig, HistoryGame } from './types';
import { defaultConfig } from './lib/config';
import { useTournamentSync } from './hooks/useTournamentSync';
import { useSeasons } from './hooks/useSeasons';
import { fullRoster, rosterNameOf } from './lib/roster';
import { NamesContext } from './components/Names';
import AdminApp from './AdminApp';

// The organizer area with its data: the Firebase SDK, with live listeners on the tournament, the
// games and the seasons. A chunk of its own, loaded only when #admin is opened (see App).
export default function AdminRoot() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  // Mirror of the games on Firestore (see useTournamentSync): never kept in this browser
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const { gamesLoaded } = useTournamentSync(setConfig, setHistory);
  const seasons = useSeasons();
  const nameOf = useMemo(
    () => rosterNameOf(fullRoster({ roster: config.tournament?.roster, players: config.players, seasons, winners: config.tournament?.winners })),
    [config.tournament?.roster, config.players, seasons, config.tournament?.winners]
  );
  return (
    <NamesContext.Provider value={nameOf}>
      <AdminApp config={config} setConfig={setConfig} history={history} setHistory={setHistory} gamesLoaded={gamesLoaded} seasons={seasons} />
    </NamesContext.Provider>
  );
}
