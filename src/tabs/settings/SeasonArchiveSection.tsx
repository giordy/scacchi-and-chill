import React, { useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from '../../types';
import { buildSeasonArchive, seasonId, withChampion } from '../../lib/seasons';
import { saveSeasonArchive } from '../../firebaseService';
import { errorMessage } from '../../lib/utils';

export function SeasonArchiveSection({
  config,
  history,
  gameStates,
  seasons,
  flash,
  onUpdateTournamentMeta,
}: {
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const meta = config.tournament;

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
          {busy ? "Archiviazione…" : alreadyArchived ? "🏛️ Aggiorna archivio stagione" : "🏛️ Archivia stagione corrente"}
        </button>
      </div>

      {seasons.length > 0 && (
        <ul className="player-games">
          {seasons.map((s) => (
            <li key={s.id} className="list-row small">
              <span>
                <strong>{s.season}</strong> · {s.champion ? `🥇 ${s.champion.name}` : "senza campione"}
              </span>
              <span className="muted-sm">{new Date(s.archivedAt).toLocaleDateString("it-IT")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
