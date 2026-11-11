import { useEffect, useRef, useState } from 'react';
import { AppConfig, HistoryGame, SeasonArchive } from '../types';
import { errorMessage } from '../lib/utils';
import { defaultConfig, validateAndNormalizeConfig, withTournamentDoc } from '../lib/config';
import { sortSeasons } from '../lib/seasons';
import { readGames, readSeasons, readTournamentDoc } from '../lib/firestoreRest';
import { useVisiblePolling } from './useVisiblePolling';

// Public page: config.json, then the tournament, its games and the archived seasons from Firestore
// with plain HTTP requests (lib/firestoreRest), read again every 5 minutes while the page is
// visible. No live listener: the organizer area keeps those (useTournamentSync).
export function usePublicData(enabled: boolean) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [seasons, setSeasons] = useState<SeasonArchive[]>([]);
  const [ready, setReady] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  // config.json, read once: the tournament document is laid over it at every read
  const base = useRef<Promise<AppConfig> | null>(null);

  useEffect(() => {
    if (!enabled || base.current) return;
    base.current = fetch('config.json', { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`config.json non trovato (HTTP ${res.status}).`);
        return res.json();
      })
      .then((cfg) => validateAndNormalizeConfig(cfg))
      .catch((err) => {
        console.warn('Utilizzo configurazione incorporata di default:', errorMessage(err));
        return defaultConfig;
      });
  }, [enabled]);

  useVisiblePolling(
    async () => {
      const cfg = base.current ?? Promise.resolve(defaultConfig);
      const [docResult, gamesResult, seasonsResult] = await Promise.allSettled([readTournamentDoc(), readGames(), readSeasons()]);
      const start = await cfg;
      if (docResult.status === 'fulfilled') setConfig(withTournamentDoc(start, docResult.value));
      else {
        console.warn('Lettura del torneo non riuscita:', docResult.reason);
        setConfig((prev) => (prev === defaultConfig ? start : prev));
      }
      if (gamesResult.status === 'fulfilled') {
        setHistory(gamesResult.value);
        setGamesLoaded(true);
      } else console.warn('Lettura delle partite non riuscita:', gamesResult.reason);
      if (seasonsResult.status === 'fulfilled') setSeasons(sortSeasons(seasonsResult.value));
      else console.warn('Lettura delle stagioni non riuscita:', seasonsResult.reason);
      setReady(true);
      return docResult.status === 'fulfilled' && gamesResult.status === 'fulfilled';
    },
    'firestore',
    enabled
  );

  return { config, history, seasons, ready, gamesLoaded };
}
