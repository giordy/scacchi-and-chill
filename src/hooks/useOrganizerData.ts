import { useCallback, useEffect, useRef, useState } from 'react';
import { OrganizerData, saveOrganizerData, subscribeToOrganizerData } from '../firebaseService';

const LS_ANECDOTES = "scacchi.anecdotes";
const LS_RATINGS = "scacchi.ratings";
const SAVE_DELAY_MS = 800;

const readLocal = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const EMPTY: OrganizerData = { anecdotes: {}, ratings: {} };

// Player anecdotes and ratings, synced with the private Firestore document (admin only).
// On first use, data previously kept in localStorage is uploaded and then removed locally.
export function useOrganizerData(enabled: boolean, onError?: (msg: string) => void) {
  const [data, setData] = useState<OrganizerData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    saveOrganizerData(dataRef.current).catch((e) => {
      dirty.current = true;
      console.warn("Salvataggio note organizzatore fallito:", e);
      onErrorRef.current?.("Salvataggio di aneddoti ed Elo su Firestore fallito.");
    });
  }, []);

  const update = useCallback(
    (next: OrganizerData) => {
      dataRef.current = next;
      setData(next);
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush]
  );

  useEffect(() => {
    if (!enabled) return;
    const unsub = subscribeToOrganizerData(
      (remote) => {
        if (remote) {
          // Do not overwrite edits that are still waiting to be saved
          if (!dirty.current) {
            dataRef.current = remote;
            setData(remote);
          }
        } else {
          // First run: migrate what was kept in this browser's localStorage
          const local: OrganizerData = {
            anecdotes: readLocal<Record<string, string>>(LS_ANECDOTES) ?? {},
            ratings: readLocal<OrganizerData["ratings"]>(LS_RATINGS) ?? {},
          };
          dataRef.current = local;
          setData(local);
          saveOrganizerData(local)
            .then(() => {
              try {
                localStorage.removeItem(LS_ANECDOTES);
                localStorage.removeItem(LS_RATINGS);
              } catch {}
            })
            .catch((e) => console.warn("Migrazione note organizzatore fallita:", e));
        }
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return () => {
      unsub();
      flush();
    };
  }, [enabled, flush]);

  const setAnecdote = (handle: string, text: string) =>
    update({ ...dataRef.current, anecdotes: { ...dataRef.current.anecdotes, [handle]: text } });
  const setRatings = (ratings: OrganizerData["ratings"]) => update({ ...dataRef.current, ratings });
  const replaceAll = (next: Partial<OrganizerData>) => update({ ...dataRef.current, ...next });
  const clearAll = () => update(EMPTY);

  return { ...data, loaded, setAnecdote, setRatings, replaceAll, clearAll };
}

export type OrganizerStore = ReturnType<typeof useOrganizerData>;
