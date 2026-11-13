import React, { useState } from 'react';
import { Player } from '../types';
import { Pledge, PledgeStatus } from '../lib/pledges';
import { writePledge } from '../lib/firestoreRest';
import { errorMessage } from '../lib/utils';

const namesList = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;

// At the bottom of the rules page: who accepted them, and for who did not, their name and «Accetto».
// At the bottom on purpose: to get there one goes past the rules.
export function PledgeBox({
  season,
  status,
  version,
  onPledged,
}: {
  season: string;
  status: PledgeStatus;
  version: string; // lib/pledges.ts rulesVersion
  onPledged?: (p: Pledge) => void;
}) {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Player | null>(null);
  const chosen = status.missing.find((p) => p.handle === handle);

  const accept = async () => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      await writePledge(season, chosen.handle, version);
      onPledged?.({ handle: chosen.handle.toLowerCase(), season, at: Date.now(), rules: version });
      setDone(chosen);
      setHandle('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pledge-box" aria-labelledby="pledge-title">
      <h3 id="pledge-title" className="rules-heading">Accetto il regolamento</h3>
      {done && (
        <p className="pledge-done" role="status">
          Fatto, {done.name}: buon torneo! ♟
        </p>
      )}
      {status.missing.length > 0 && (
        <>
          <p className="note m-0">
            Ognuno lo accetta per sé, scegliendo il proprio nome: chi accetta compare nella cronaca.
          </p>
          <div className="pledge-form">
            <label htmlFor="pledge-name" className="sr-only">Il tuo nome</label>
            <select id="pledge-name" className="filter-select" value={handle} onChange={(e) => setHandle(e.target.value)} disabled={busy}>
              <option value="">Chi sei?</option>
              {status.missing.map((p) => (
                <option key={p.handle} value={p.handle}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {chosen && (
            <p className="pledge-oath">
              Io, <strong>{chosen.name}</strong>, ho letto il regolamento della {season} e lo accetto: gioco ogni partita con le mie forze, senza motori né aiuti esterni.
            </p>
          )}
          <button type="button" className="primary pledge-accept" disabled={!chosen || busy} onClick={accept}>
            {busy ? 'Un momento…' : 'Accetto'}
          </button>
          {error && <p className="notice err" role="alert">{error}</p>}
        </>
      )}
      <p className="note m-0 pledge-count">
        {status.all
          ? `Accettato da tutti i ${status.accepted.length} giocatori.`
          : status.accepted.length === 0
          ? 'Nessuno l’ha ancora accettato.'
          : `Accettato da ${namesList(status.accepted.map((p) => p.name))} (${status.accepted.length} su ${status.accepted.length + status.missing.length}).`}
      </p>
    </section>
  );
}
