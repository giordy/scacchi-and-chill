import React, { useEffect, useState } from 'react';
import { AppConfig, HistoryGame } from '../types';
import { errorMessage } from '../lib/utils';
import { validateAndNormalizeConfig } from '../lib/config';
import { DEFAULT_TOURNAMENT, tournamentFromDoc } from '../lib/tournament';
import {
  saveTournamentFullToFirebase,
  loadTournamentFullFromFirebase,
  subscribeToTournamentDoc,
  subscribeToGames,
  testFirestoreConnection,
} from '../firebaseService';

// Loads config.json and the Firestore data on boot, then keeps tournament and games in sync in real time.
// Firestore is the only source of the games: every device, the organizer's included, mirrors it.
export function useTournamentSync(
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>
) {
  const [ready, setReady] = useState(false);
  // True after the first snapshot of the games collection
  const [gamesLoaded, setGamesLoaded] = useState(false);

  useEffect(() => {
    testFirestoreConnection();

    fetch("config.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`config.json non trovato (HTTP ${res.status}).`);
        return res.json();
      })
      .then(async (cfg) => {
        const validated = validateAndNormalizeConfig(cfg);
        // Check if Firestore already has full tournament data (meta, players, schedule)
        const remoteTournament = await loadTournamentFullFromFirebase();
        if (remoteTournament) {
          const meta = tournamentFromDoc(remoteTournament);
          if (meta) validated.tournament = meta;
          if (Array.isArray(remoteTournament.players) && remoteTournament.players.length > 0) {
            validated.players = remoteTournament.players;
          }
          if (Array.isArray(remoteTournament.schedule) && remoteTournament.schedule.length > 0) {
            validated.schedule = remoteTournament.schedule;
          }
        } else {
          // If Firestore is empty on first boot, initialize it with the default config
          saveTournamentFullToFirebase({
            meta: DEFAULT_TOURNAMENT,
            players: validated.players,
            schedule: validated.schedule,
          }).catch((e) => console.warn("Inizializzazione Firestore saltata:", e));
        }
        setConfig(validated);
        setReady(true);
      })
      .catch((err) => {
        console.warn("Utilizzo configurazione incorporata di default:", errorMessage(err));
        setReady(true);
      });

    // Real-time listener for tournament doc changes (meta, players, schedule)
    const unsubDoc = subscribeToTournamentDoc((doc) => {
      setConfig((prev) => {
        const next = { ...prev };
        const meta = tournamentFromDoc(doc);
        if (meta) next.tournament = meta;
        if (Array.isArray(doc.players) && doc.players.length > 0) {
          next.players = doc.players;
        }
        if (Array.isArray(doc.schedule)) {
          next.schedule = doc.schedule;
        }
        return next;
      });
    });

    // Real-time listener for Firestore games: updates games across all devices instantly
    const unsubGames = subscribeToGames((remoteGames) => {
      setHistory(remoteGames);
      setGamesLoaded(true);
    });

    return () => {
      unsubDoc();
      unsubGames();
    };
  }, []);

  return { ready, gamesLoaded };
}
