import React from 'react';
import { SyncHealth } from '../lib/syncHealth';
import { agoLabel } from '../lib/presence';

// The automatic results sync, in the sync bar: when it last ran
export function AutoSyncNote({ health, now = Date.now() }: { health: SyncHealth | null; now?: number }) {
  if (!health || health.kind === 'stale') return null;
  return (
    <span className="note sync-note">
      {health.kind === 'ok' ? `Automatica: ${agoLabel(health.at, now)}` : 'Automatica: nessun giro registrato finora'}
    </span>
  );
}

// In the list of alerts, only when the automatic sync stopped: what to look at
export function AutoSyncAlert({ health, now = Date.now() }: { health: SyncHealth | null; now?: number }) {
  if (health?.kind !== 'stale') return null;
  return (
    <>
      ⚠️ La sincronizzazione automatica è ferma:{" "}
      {health.at !== undefined ? `l'ultimo giro riuscito è di ${agoLabel(health.at, now)}.` : "nessun giro è andato a buon fine."}
      {health.error && (
        <>
          {" "}L'ultimo errore: <em>{health.error}</em>.
        </>
      )}{" "}
      Se su GitHub «Sincronizza risultati» non parte più da sola, il token GitHub usato da cron-job.org potrebbe essere
      scaduto (vedi il README). Intanto i risultati si aggiornano quando apri quest'area o premi «Sincronizza risultati».
    </>
  );
}
