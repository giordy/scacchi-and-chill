import React, { useRef } from 'react';
import type { OrganizerStore } from '../../hooks/useOrganizerData';
import { errorMessage } from '../../lib/utils';
import {
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  BackupData,
} from '../../types';

export function BackupSection({
  settings,
  setSettings,
  templates,
  setTemplates,
  history,
  setHistory,
  round,
  setRound,
  pairs,
  setPairs,
  flash,
  organizer,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  round: string;
  setRound: (r: string) => void;
  pairs: GamePair[];
  setPairs: React.Dispatch<React.SetStateAction<GamePair[]>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  organizer: OrganizerStore;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    const backup: BackupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      round,
      history,
      pairs,
      settings,
      templates,
      anecdotes: organizer.anecdotes,
      ratings: organizer.ratings,
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-scacchi-and-chill-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("ok", `Backup esportato con successo (${history.length} partite storiche salvate in backup-scacchi-and-chill-${dateStr}.json).`);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content) as BackupData;

        if (!data || typeof data !== "object") {
          throw new Error("Formato del file di backup non valido.");
        }

        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }
        if (typeof data.round === "string") {
          setRound(data.round);
        }
        if (Array.isArray(data.pairs)) {
          setPairs(data.pairs);
        }
        if (data.settings && typeof data.settings === "object") {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        if (data.templates !== undefined) {
          setTemplates(data.templates);
        }
        organizer.replaceAll({
          ...(data.anecdotes && typeof data.anecdotes === "object" ? { anecdotes: data.anecdotes } : {}),
          ...(data.ratings && typeof data.ratings === "object" ? { ratings: data.ratings } : {}),
        });

        const matchCount = data.history?.length ?? 0;
        flash("ok", `Backup ripristinato con successo! Caricate ${matchCount} partite storiche, aneddoti e impostazioni.`);
      } catch (err) {
        flash("err", `Errore durante il ripristino del backup: ${errorMessage(err)}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = () => {
    if (
      window.confirm(
        "Attenzione: vuoi davvero cancellare TUTTI i dati del torneo (partite salvate, turni, aneddoti e impostazioni)? Ti consigliamo di scaricare prima un backup."
      )
    ) {
      setHistory([]);
      setPairs([]);
      setRound("1");
      organizer.clearAll();
      setTemplates(null);
      flash("ok", "Tutti i dati locali del torneo sono stati azzerati.");
    }
  };

  return (
    <div>
      <p className="note note-flush">
        Esporta tutti i dati del torneo (storico turni, partite, aneddoti dei giocatori e impostazioni) in un file JSON per sicurezza o per trasferirli su un altro dispositivo.
      </p>

      <div className="actions two flush">
        <button
          className="secondary"
          type="button"
          onClick={handleExportBackup}
        >
          📥 Scarica Backup (JSON)
        </button>
        <label
          className="secondary file-btn"
        >
          📂 Carica Backup (.json)
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden-input"
            onChange={handleImportBackup}
          />
        </label>
      </div>

      <div className="reset-row">
        <button
          type="button"
          className="link-danger"
          onClick={handleResetAllData}
        >
          ⚠️ Azzera tutti i dati locali del torneo
        </button>
      </div>
    </div>
  );
}
