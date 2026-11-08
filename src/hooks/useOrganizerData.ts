import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageTemplates, Settings, StatusPhrases } from '../types';
import { OrganizerData, saveOrganizerData, subscribeToOrganizerData } from '../firebaseService';

const SAVE_DELAY_MS = 800;

const EMPTY: OrganizerData = { anecdotes: {}, settings: {}, templates: null, statusPhrases: null };

// Player anecdotes, settings and message texts, synced with the private Firestore document (admin only).
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
      onErrorRef.current?.("Salvataggio delle note dell'organizzatore su Firestore fallito.");
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
        // Do not overwrite edits that are still waiting to be saved
        if (!dirty.current) {
          const next = remote ?? EMPTY;
          dataRef.current = next;
          setData(next);
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
  const replaceAll = (next: Partial<OrganizerData>) => update({ ...dataRef.current, ...next });
  // Same signature as a React state setter, so the settings sections need no changes
  const setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>> = (action) => {
    const prev = dataRef.current.settings ?? {};
    update({ ...dataRef.current, settings: typeof action === "function" ? action(prev) : action });
  };
  const setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>> = (action) => {
    const prev = dataRef.current.templates ?? null;
    update({ ...dataRef.current, templates: typeof action === "function" ? action(prev) : action });
  };

  const setStatusPhrases = (statusPhrases: Partial<StatusPhrases> | null) => update({ ...dataRef.current, statusPhrases });

  return { ...data, loaded, setAnecdote, replaceAll, setSettings, setTemplates, setStatusPhrases };
}

export type OrganizerStore = ReturnType<typeof useOrganizerData>;
