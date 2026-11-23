import { useEffect, useState } from 'react';
import { pushSupport } from '../lib/push';
import { disableOrganizerPush, enableOrganizerPush, refreshOrganizerPush, savedOrganizerEndpoint } from '../lib/organizerPush';
import { errorMessage } from '../lib/utils';

// Stagioni → Regolamento, under the Turni con scadenza: a notification on this device when a round is
// past its end and the next one can be created (lib/organizerPush.ts, sent by the GitHub Action)
export function OrganizerPushToggle() {
  const support = pushSupport();
  const [on, setOn] = useState(() => !!savedOrganizerEndpoint());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    refreshOrganizerPush()
      .then((endpoint) => {
        if (alive) setOn(!!endpoint);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setError('');
    try {
      setOn(await action());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (support === 'none') {
    return <p className="note note-sm">🔔 Questo browser non riceve notifiche: l'avviso della scadenza si accende da un browser che le riceve.</p>;
  }
  if (support === 'ios-browser') {
    return (
      <p className="note note-sm">
        🔔 Su iPhone e iPad l'avviso della scadenza arriva solo dall'app: in Safari tocca Condividi, poi «Aggiungi alla schermata Home», e apri l'area organizzatore da lì.
      </p>
    );
  }
  if (support === 'denied') {
    return <p className="note note-sm">🔔 Le notifiche di questo sito sono bloccate: si riattivano dalle impostazioni del browser.</p>;
  }
  return (
    <div className="note note-sm">
      <p className="note-flush">
        {on
          ? "🔔 Su questo dispositivo ti arriva una notifica quando un turno scade e puoi creare il successivo."
          : "🔕 Una notifica su questo dispositivo quando un turno scade e puoi creare il successivo."}{" "}
        La manda il workflow «Sincronizza risultati», una volta per turno.
      </p>
      <button type="button" className="secondary" disabled={busy} onClick={() => run(() => (on ? disableOrganizerPush().then(() => false) : enableOrganizerPush().then(() => true)))}>
        {on ? 'Spegni l’avviso su questo dispositivo' : '🔔 Avvisami quando scade un turno'}
      </button>
      {error && <p className="note note-sm" role="alert">{error}</p>}
    </div>
  );
}
