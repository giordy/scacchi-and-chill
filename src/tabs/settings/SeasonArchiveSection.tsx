import React, { useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, ScheduledMatch, SeasonArchive, TournamentMeta } from '../../types';
import { buildSeasonArchive, seasonId, validateNewSeasonName, withChampion } from '../../lib/seasons';
import { deleteAllGames, saveSeasonArchive } from '../../firebaseService';
import { errorMessage } from '../../lib/utils';

export function SeasonArchiveSection({
  config,
  history,
  gameStates,
  seasons,
  flash,
  onUpdateTournamentMeta,
  onUpdateSchedule,
  setHistory,
  onSeasonReset,
}: {
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  onSeasonReset: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [nextSeason, setNextSeason] = useState("");
  const [nextMaster, setNextMaster] = useState("");
  const [clearSchedule, setClearSchedule] = useState(true);
  const meta = config.tournament;

  // Hooks above must run on every render, so the early return comes after them
  if (!meta) return <p className="note">Salva prima le informazioni del torneo.</p>;

  const preview = buildSeasonArchive(meta, config.players, history, gameStates);
  const alreadyArchived = seasons.some((s) => s.id === seasonId(meta.season));

  const archive = async () => {
    if (alreadyArchived && !window.confirm(`La stagione «${meta.season}» è già in archivio. Sovrascrivere con la classifica attuale?`)) {
      return;
    }
    setBusy(true);
    try {
      const snapshot = buildSeasonArchive(meta, config.players, history, gameStates);
      await saveSeasonArchive(snapshot);
      const winners = withChampion(meta.winners, snapshot);
      if (winners !== meta.winners && winners !== undefined) onUpdateTournamentMeta({ winners });
      flash("ok", `Stagione «${snapshot.season}» archiviata${snapshot.champion ? ` · campione: ${snapshot.champion.name}` : ""}.`);
    } catch (e) {
      flash("err", "Archiviazione fallita: " + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startNewSeason = async () => {
    const problem = validateNewSeasonName(nextSeason, meta.season, seasons);
    if (problem) {
      flash("err", problem);
      return;
    }
    if (!preview.champion) {
      flash("err", "La stagione corrente non ha partite concluse: sincronizza i risultati prima di chiuderla.");
      return;
    }
    const ok = window.confirm(
      `Chiudere «${meta.season}» e iniziare «${nextSeason.trim()}»?\n\n` +
        `• la classifica finale viene archiviata (campione: ${preview.champion.name})\n` +
        `• TUTTE le partite della stagione corrente vengono cancellate da Firestore\n` +
        (clearSchedule ? "• il calendario ufficiale viene svuotato\n" : "") +
        `\nL'operazione non si può annullare.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      // 1. Archive first: if this fails nothing is deleted
      const snapshot = buildSeasonArchive(meta, config.players, history, gameStates);
      await saveSeasonArchive(snapshot);
      // 2. Remove the old season's games from Firestore and from this device
      await deleteAllGames();
      setHistory([]);
      onSeasonReset();
      // 3. New season details (the champion goes to the hall of fame)
      onUpdateTournamentMeta({
        season: nextSeason.trim(),
        masterName: nextMaster.trim(),
        imageUrl: "",
        subtitle: "",
        winners: withChampion(meta.winners, snapshot),
      });
      if (clearSchedule) onUpdateSchedule([]);
      setNextSeason("");
      setNextMaster("");
      flash("ok", `Stagione «${snapshot.season}» archiviata. Iniziata «${nextSeason.trim()}».`);
    } catch (e) {
      flash("err", "Cambio stagione interrotto: " + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="note note-flush">
        Salva la classifica finale della stagione corrente nello storico pubblico e aggiunge il campione all'Albo d'Oro.
        Le partite non vengono cancellate.
      </p>

      <div className="subcard">
        <h4 className="subcard-title">{meta.season}</h4>
        <p className="note note-sm">
          {preview.champion
            ? `Leader attuale: ${preview.champion.name} (${preview.champion.points} pt) · ${preview.gamesPlayed} partite concluse`
            : "Nessuna partita conclusa: sincronizza i risultati prima di archiviare."}
        </p>
        <button type="button" className="secondary" disabled={busy || !preview.champion} onClick={archive}>
          {busy ? "Archiviazione…" : alreadyArchived ? "Aggiorna archivio stagione" : "Archivia stagione corrente"}
        </button>
      </div>

      <div className="subcard">
        <h4 className="subcard-title">Inizia una nuova stagione</h4>
        <p className="note note-sm">
          Archivia la stagione corrente e poi <strong>cancella tutte le sue partite</strong>. Giocatori e impostazioni restano.
        </p>
        <div className="grid2 field">
          <div>
            <label htmlFor="next-season">Nome nuova stagione</label>
            <input id="next-season" type="text" value={nextSeason} onChange={(e) => setNextSeason(e.target.value)} placeholder="es. Stagione 3 - Fischer" />
          </div>
          <div>
            <label htmlFor="next-master">Maestro (opzionale)</label>
            <input id="next-master" type="text" value={nextMaster} onChange={(e) => setNextMaster(e.target.value)} placeholder="es. Bobby Fischer" />
          </div>
        </div>
        <div className="inline field">
          <input id="next-clear-schedule" type="checkbox" checked={clearSchedule} onChange={(e) => setClearSchedule(e.target.checked)} />
          <label htmlFor="next-clear-schedule">Svuota anche il calendario ufficiale</label>
        </div>
        <button type="button" className="danger" disabled={busy || !preview.champion} onClick={startNewSeason}>
          {busy ? "Operazione in corso…" : "Archivia e inizia nuova stagione"}
        </button>
      </div>

      {seasons.length > 0 && (
        <ul className="player-games">
          {seasons.map((s) => (
            <li key={s.id} className="list-row small">
              <span>
                <strong>{s.season}</strong> · {s.champion ? `campione ${s.champion.name}` : "senza campione"}
              </span>
              <span className="muted-sm">{new Date(s.archivedAt).toLocaleDateString("it-IT")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
