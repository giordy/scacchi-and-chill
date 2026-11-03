import React from 'react';
import type { OrganizerStore } from '../../hooks/useOrganizerData';
import { AppConfig, BackupData, HistoryGame, MessageTemplates, SeasonArchive, Settings } from '../../types';

// Read-only export: the data lives on Firestore, so this is a safety copy, never a restore source.
export function BackupSection({
  config,
  history,
  seasons,
  settings,
  templates,
  organizer,
  flash,
}: {
  config: AppConfig;
  history: HistoryGame[];
  seasons: SeasonArchive[];
  settings: Settings;
  templates: MessageTemplates;
  organizer: OrganizerStore;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
}) {
  const handleExport = () => {
    // The Lichess token stays on this device: never put it in a file
    const { token: _token, ...safeSettings } = settings;
    const backup: BackupData = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      tournament: config.tournament,
      players: config.players,
      schedule: config.schedule ?? [],
      history,
      seasons,
      settings: safeSettings,
      templates,
      anecdotes: organizer.anecdotes,
      ratings: organizer.ratings,
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `scacchi-and-chill-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("ok", `Copia scaricata: ${fileName} (${history.length} partite).`);
  };

  return (
    <div>
      <p className="note note-flush">
        I dati del torneo sono salvati su Firestore. Qui puoi scaricarne una copia in JSON (torneo, giocatori,
        calendario, partite, stagioni, aneddoti ed Elo). Il token Lichess non viene incluso.
      </p>
      <button className="secondary btn-block" type="button" onClick={handleExport}>
        Scarica copia JSON
      </button>
    </div>
  );
}
