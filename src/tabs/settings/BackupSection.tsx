import React, { useState } from 'react';
import type { OrganizerStore } from '../../hooks/useOrganizerData';
import {
  AppConfig,
  BackupData,
  HistoryGame,
  MessageTemplates,
  Player,
  ScheduledMatch,
  SeasonArchive,
  Settings,
  TournamentMeta,
} from '../../types';
import { loadAllMediaImages, replaceAllGames, saveMediaImage, saveSeasonArchive } from '../../firebaseService';
import { isStorableImage } from '../../lib/media';
import { BackupSummary, parseBackup } from '../../lib/backup';
import { errorMessage } from '../../lib/utils';

const BACKUPS_URL = 'https://github.com/giordy/scacchi-and-chill/commits/backups/backup.json';

// Copy of the data as a JSON file, and restore from such a file or from a nightly backup
export function BackupSection({
  config,
  history,
  seasons,
  settings,
  templates,
  organizer,
  flash,
  setHistory,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  config: AppConfig;
  history: HistoryGame[];
  seasons: SeasonArchive[];
  settings: Settings;
  templates: MessageTemplates;
  organizer: OrganizerStore;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const [pending, setPending] = useState<{ data: BackupData; summary: BackupSummary; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async (quiet = false) => {
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
      statusPhrases: organizer.statusPhrases ?? null,
      anecdotes: organizer.anecdotes,
    };
    // Uploaded photos: a failure to read them must not block the copy of everything else
    try {
      const media = await loadAllMediaImages();
      if (Object.keys(media).length > 0) backup.media = media;
    } catch (e) {
      console.warn("Foto non incluse nella copia:", e);
    }

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
    if (!quiet) flash("ok", `Copia scaricata: ${fileName} (${history.length} partite).`);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending({ ...parseBackup(await file.text()), fileName: file.name });
    } catch (e) {
      setPending(null);
      flash("err", `${file.name}: ${errorMessage(e)}`);
    }
  };

  const restore = async () => {
    if (!pending) return;
    const { data, summary } = pending;
    if (
      !window.confirm(
        `Ripristinare «${summary.season}» da ${pending.fileName}?\n\nTorneo, giocatori, calendario e partite vengono sostituiti da quelli del file. ` +
          "Prima viene scaricata una copia dei dati attuali."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await handleExport(true);
      const games = data.history ?? [];
      await replaceAllGames(games);
      setHistory(games);
      onUpdatePlayers(data.players ?? []);
      onUpdateSchedule(data.schedule ?? []);
      // A file from before the withdrawals had none: the current ones must not survive the restore
      onUpdateTournamentMeta({ ...data.tournament, withdrawals: data.tournament?.withdrawals ?? [] });
      for (const s of data.seasons ?? []) await saveSeasonArchive(s);
      for (const [id, dataUrl] of Object.entries(data.media ?? {})) {
        if (isStorableImage(dataUrl)) await saveMediaImage(id, dataUrl);
      }
      if (summary.privateData) {
        organizer.replaceAll({
          ...(data.anecdotes ? { anecdotes: data.anecdotes } : {}),
          ...(data.settings ? { settings: { ...data.settings, token: organizer.settings?.token ?? settings.token } } : {}),
          ...(data.templates ? { templates: data.templates } : {}),
          ...(data.statusPhrases !== undefined ? { statusPhrases: data.statusPhrases } : {}),
        });
      }
      flash("ok", `Ripristinata «${summary.season}»: ${summary.games} partite, ${summary.players} giocatori.`);
      setPending(null);
    } catch (e) {
      flash("err", "Ripristino interrotto: " + errorMessage(e) + ". La copia dei dati di prima è stata scaricata.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="note note-flush">
        I dati del torneo sono salvati su Firestore. Qui puoi scaricarne una copia in JSON (torneo, giocatori,
        calendario, partite, stagioni, foto caricate, aneddoti ed Elo). Il token Lichess non viene incluso.
      </p>
      <button className="secondary btn-block" type="button" onClick={() => handleExport()}>
        Scarica copia JSON
      </button>

      <h4 className="subcard-title mt-12">Ripristino</h4>
      <p className="note">
        Ogni notte una copia automatica di torneo, giocatori, calendario, partite e stagioni viene salvata su GitHub,
        solo se qualcosa è cambiato:{" "}
        <a href={BACKUPS_URL} target="_blank" rel="noopener noreferrer">
          elenco delle versioni
        </a>{" "}
        (apri una versione, poi «Download raw file»). Puoi ripristinare quella o una copia scaricata qui sopra.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        aria-label="File di backup da ripristinare"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {pending && (
        <div className="notice warning mt-8">
          <strong>{pending.fileName}</strong>: «{pending.summary.season}»
          {pending.summary.savedAt && ` del ${new Date(pending.summary.savedAt).toLocaleString("it-IT")}`} ·{" "}
          {pending.summary.players} giocatori, {pending.summary.scheduled} partite in calendario, {pending.summary.games}{" "}
          partite registrate, {pending.summary.seasons} stagioni archiviate.
          <br />
          {pending.summary.privateData
            ? "Contiene anche aneddoti, Elo e testi dei messaggi: vengono ripristinati (il token Lichess resta quello attuale)."
            : "Backup automatico: aneddoti, Elo, impostazioni e testi dei messaggi restano quelli attuali."}
          <div className="actions two mt-8">
            <button type="button" className="danger" disabled={busy} onClick={restore}>
              {busy ? "Ripristino in corso…" : "Ripristina"}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => setPending(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
