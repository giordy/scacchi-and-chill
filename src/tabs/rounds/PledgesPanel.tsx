import React, { useState } from 'react';
import { Player } from '../../types';
import { pledgeDocId, pledgeMessage, PledgeStatus } from '../../lib/pledges';
import { deletePledge } from '../../firebaseService';
import { errorMessage } from '../../lib/utils';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

const timeOf = (ms: number) =>
  new Date(ms).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Organizer area, Turni: who accepted the rules of the season (lib/pledges.ts), the message with
// the link for the group, and a way to cancel an acceptance (the player then accepts again).
// Folded once everyone accepted.
export function PledgesPanel({
  season,
  status,
  players,
  onReload,
  flash,
}: {
  season: string;
  status: PledgeStatus;
  players: Player[];
  onReload: () => void;
  flash: Flash;
}) {
  const [busy, setBusy] = useState('');
  if (players.length === 0) return null;
  const link = `${window.location.origin}${window.location.pathname}#/regolamento`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pledgeMessage(season, link));
      flash('ok', 'Messaggio copiato: incollalo nel gruppo WhatsApp.');
    } catch {
      flash('err', 'Impossibile copiare automaticamente il messaggio.');
    }
  };

  const cancel = async (handle: string, name: string) => {
    if (!window.confirm(`Annullare l'accettazione di ${name}? Dovrà accettare di nuovo il regolamento dal sito.`)) return;
    setBusy(handle);
    try {
      await deletePledge(pledgeDocId(season, handle));
      onReload();
    } catch (e) {
      flash('err', `Annullamento non riuscito: ${errorMessage(e)}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <details className="panel pledges-panel" open={!status.all}>
      <summary className="panel-title">
        📜 Regolamento <span className="muted-normal">· accettato da {status.accepted.length} su {players.length}</span>
      </summary>
      <p className="note note-flush">
        Manda nel gruppo il link al regolamento: ognuno lo legge e in fondo sceglie il suo nome e accetta. Chi accetta
        compare nella cronaca. Le sfide si possono creare anche se manca qualcuno: il sito chiede solo conferma.
      </p>
      <button type="button" className="secondary mt-8" onClick={copy}>
        Copia il messaggio con il link
      </button>
      {status.missing.length > 0 && (
        <p className="mt-12 m-0">
          <strong>Mancano:</strong> {status.missing.map((p) => p.name).join(', ')}
        </p>
      )}
      {status.accepted.length > 0 && (
        <ul className="pledges-list">
          {status.accepted.map((p) => (
            <li key={p.handle}>
              <span>
                <strong>{p.name}</strong> <span className="muted-sm">· {timeOf(p.at)}</span>
                {status.outdated.includes(p.handle) && <span className="muted-sm"> · su un testo poi cambiato</span>}
              </span>
              <button
                type="button"
                className="secondary btn-mini"
                disabled={busy === p.handle}
                onClick={() => cancel(p.handle, p.name)}
              >
                Annulla
              </button>
            </li>
          ))}
        </ul>
      )}
      {status.outdated.length > 0 && (
        <p className="note note-flush">
          Il regolamento è cambiato dopo alcune accettazioni: se la modifica è importante, annullale e chiedi di accettare di nuovo.
        </p>
      )}
      <button type="button" className="link-muted mt-8" onClick={onReload}>
        Aggiorna
      </button>
    </details>
  );
}
