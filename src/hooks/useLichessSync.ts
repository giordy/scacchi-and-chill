import React, { useMemo, useState } from 'react';
import { HistoryGame, LichessExportGame } from '../types';
import { errorMessage, extractGameId } from '../lib/utils';
import { fetchGameStates } from '../lib/lichess';
import { saveLichessStatesToFirebase } from '../firebaseService';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

const isFinished = (s?: LichessExportGame) =>
  Boolean(s && s.status && s.status !== "created" && s.status !== "started");

// Game results are saved in Firestore (field `lichess`): the public view reads them from there,
// without calling Lichess from every visitor's browser.
export function useLichessSync(
  history: HistoryGame[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>,
  flash: Flash
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const gameStates = useMemo(() => {
    const map: Record<string, LichessExportGame> = {};
    history.forEach((g) => {
      const id = extractGameId(g.url);
      if (id && g.lichess) map[id] = g.lichess;
    });
    return map;
  }, [history]);

  // "Sync" button (organizer only): reads from Lichess and saves to Firestore.
  // quiet: automatic sync when the organizer area opens, which reports only errors.
  const sync = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    const targets = history.filter((g) => extractGameId(g.url) && !isFinished(g.lichess));
    if (history.filter((g) => extractGameId(g.url)).length === 0) {
      if (!quiet) flash("warning", "Non ci sono ancora partite con un link Lichess da sincronizzare.");
      return;
    }
    if (targets.length === 0) {
      if (!quiet) flash("ok", "Tutte le partite risultano già concluse e salvate: niente da aggiornare.");
      return;
    }

    setIsSyncing(true);
    try {
      const ids = Array.from(new Set(targets.map((g) => extractGameId(g.url) as string)));
      const states = await fetchGameStates(ids);
      const saved = await saveLichessStatesToFirebase(targets, states, extractGameId);

      setHistory((prev) =>
        prev.map((g) => {
          const id = extractGameId(g.url);
          const s = id ? states[id] : undefined;
          return s ? { ...g, lichess: s } : g;
        })
      );

      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setLastSyncTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);

      const missing = targets.length - saved;
      if (quiet) return;
      flash(
        missing > 0 ? "warning" : "ok",
        `Sincronizzate ${saved} partite su Firestore.` +
          (missing > 0 ? ` ${missing} non ancora trovate su Lichess (sfida non accettata).` : "")
      );
    } catch (e) {
      flash(quiet ? "warning" : "err", "Sincronizzazione dei risultati fallita: " + errorMessage(e));
    } finally {
      setIsSyncing(false);
    }
  };

  return { gameStates, isSyncing, lastSyncTime, sync };
}
