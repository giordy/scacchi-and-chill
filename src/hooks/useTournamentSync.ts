import React, { useEffect, useState } from 'react';
import { AppConfig, HistoryGame } from '../types';
import { errorMessage } from '../lib/utils';
import { validateAndNormalizeConfig, withTournamentDoc } from '../lib/config';
import { subscribeToTournamentDoc, subscribeToGames, TournamentDocData } from '../firebaseService';

// Loads config.json and the Firestore data on boot, then keeps tournament and games in sync in real time.
// Firestore is the only source of the games: every device, the organizer's included, mirrors it.
// The tournament document is read once, by its real-time listener; nothing is written from here
// (the organizer's saves create the document when it does not exist yet).
export function useTournamentSync(
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>
) {
  // True once config.json and the first answer for the tournament document have both arrived
  const [ready, setReady] = useState(false);
  // True after the first snapshot of the games collection
  const [gamesLoaded, setGamesLoaded] = useState(false);
  // Who may accept the rules, as stored (lib/pledges.ts): undefined until the document is read, or
  // when there is none; null when it has none yet
  const [storedPledgeKeys, setStoredPledgeKeys] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let configDone = false;
    let docDone = false;
    // Latest tournament document, laid over config.json when that arrives after it
    let latestDoc: TournamentDocData | null = null;
    const checkReady = () => {
      if (!cancelled && configDone && docDone) setReady(true);
    };

    fetch("config.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`config.json non trovato (HTTP ${res.status}).`);
        return res.json();
      })
      .then((cfg) => {
        if (!cancelled) setConfig(withTournamentDoc(validateAndNormalizeConfig(cfg), latestDoc));
      })
      .catch((err) => {
        console.warn("Utilizzo configurazione incorporata di default:", errorMessage(err));
      })
      .finally(() => {
        configDone = true;
        checkReady();
      });

    // Real-time listener for tournament doc changes (meta, players, schedule)
    const unsubDoc = subscribeToTournamentDoc(
      (doc) => {
        latestDoc = doc;
        setConfig((prev) => withTournamentDoc(prev, doc));
        setStoredPledgeKeys(doc ? (Array.isArray(doc.pledgeKeys) ? doc.pledgeKeys : null) : undefined);
        docDone = true;
        checkReady();
      },
      () => {
        docDone = true;
        checkReady();
      }
    );

    // Real-time listener for Firestore games: updates games across all devices instantly
    const unsubGames = subscribeToGames((remoteGames) => {
      setHistory(remoteGames);
      setGamesLoaded(true);
    });

    return () => {
      cancelled = true;
      unsubDoc();
      unsubGames();
    };
  }, []);

  return { ready, gamesLoaded, storedPledgeKeys };
}
