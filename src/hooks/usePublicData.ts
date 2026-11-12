import { useCallback, useEffect, useRef, useState } from 'react';
import { AppConfig, HistoryGame, SeasonArchive } from '../types';
import { errorMessage } from '../lib/utils';
import { defaultConfig, validateAndNormalizeConfig, withTournamentDoc } from '../lib/config';
import { sortSeasons } from '../lib/seasons';
import { readGames, readSeasons, readTournamentDoc } from '../lib/firestoreRest';
import { useVisiblePolling } from './useVisiblePolling';
import { loadSnapshot, saveSnapshot } from '../lib/publicCache';

// After a failed read the page asks again soon, not at the next 5 minutes: 3 s, then 8, 20, and
// every 30 from there on
const RETRY_MS = [3000, 8000, 20000, 30000];
export const retryDelay = (failures: number) => RETRY_MS[Math.min(Math.max(failures, 1), RETRY_MS.length) - 1];

// Public page: config.json, then the tournament and its games from Firestore with plain HTTP
// requests (lib/firestoreRest), read again every 5 minutes while the page is visible. The archived
// seasons, the heaviest answer, change only when a season is closed: they are read at the first
// load and again when the tournament's season changes. No live listener: the organizer area keeps
// those (useTournamentSync).
// `ready` only once the tournament and its games were read: until then the page has nothing true to
// show, and `failed` says the read did not work (it is tried again by itself, or with `retry`).
// When the very first read fails (no network) the page shows the last tournament this browser
// read (lib/publicCache): `staleAt` is when that was, until a read succeeds.
export function usePublicData(enabled: boolean) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [seasons, setSeasons] = useState<SeasonArchive[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [staleAt, setStaleAt] = useState<number | undefined>(undefined);
  const isReady = useRef(false);
  const seasonsNow = useRef<SeasonArchive[]>([]);
  // Each new attempt after a failure restarts the polling at once
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  // The season the archives were last read for; undefined until they are read
  const seasonsFor = useRef<string | undefined>(undefined);
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

  const retry = useCallback(() => {
    window.clearTimeout(timer.current);
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useVisiblePolling(
    async () => {
      const cfg = base.current ?? Promise.resolve(defaultConfig);
      const [docResult, gamesResult] = await Promise.allSettled([readTournamentDoc(), readGames()]);
      const start = await cfg;
      if (docResult.status === 'rejected') console.warn('Lettura del torneo non riuscita:', docResult.reason);
      if (gamesResult.status === 'rejected') console.warn('Lettura delle partite non riuscita:', gamesResult.reason);
      const ok = docResult.status === 'fulfilled' && gamesResult.status === 'fulfilled';
      if (!ok) {
        // What was read before stays on the page; only a first load with nothing says so
        failures.current++;
        setFailed(true);
        if (!isReady.current) {
          const saved = loadSnapshot();
          if (saved) {
            setConfig(withTournamentDoc(start, saved.doc));
            setHistory(saved.games);
            setSeasons(saved.seasons);
            setStaleAt(saved.at);
            setReady(true);
            isReady.current = true;
          }
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(retry, retryDelay(failures.current));
        return false;
      }
      failures.current = 0;
      const next = withTournamentDoc(start, docResult.value);
      const season = next.tournament?.season ?? '';
      if (seasonsFor.current !== season) {
        try {
          seasonsNow.current = sortSeasons(await readSeasons());
          setSeasons(seasonsNow.current);
          seasonsFor.current = season;
        } catch (e) {
          // The page works without the past seasons; they are asked again at the next read
          console.warn('Lettura delle stagioni non riuscita:', e);
        }
      }
      setConfig(next);
      setHistory(gamesResult.value);
      setFailed(false);
      setStaleAt(undefined);
      setReady(true);
      isReady.current = true;
      // Only with the past seasons read: a snapshot never replaces them with none
      if (seasonsFor.current === season) saveSnapshot({ at: Date.now(), doc: docResult.value, games: gamesResult.value, seasons: seasonsNow.current });
      return true;
    },
    `firestore:${attempt}`,
    enabled
  );

  return { config, history, seasons, ready, failed, staleAt, retry, gamesLoaded: ready };
}
