import { useEffect, useState } from 'react';
import { pushSupport } from '../lib/push';
import { disableOrganizerPush, enableOrganizerPush, refreshOrganizerPush, savedOrganizerEndpoint } from '../lib/organizerPush';
import { errorMessage } from '../lib/utils';

// Impostazioni → Avvisi all'organizzatore: the notifications on this device (lib/organizerPush.ts, sent by
// the GitHub Action): a round past its end (Turni con scadenza), a game past the days allowed (lib/overdue.ts)
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
    return <p className="note note-sm">🔔 Questo browser non riceve notifiche: gli avvisi si accendono da un browser che le riceve.</p>;
  }
  if (support === 'ios-browser') {
    return (
      <p className="note note-sm">
        🔔 Su iPhone e iPad gli avvisi arrivano solo dall'app: in Safari tocca Condividi, poi «Aggiungi alla schermata Home», e apri l'area organizzatore da lì.
      </p>
    );
  }
  if (support === 'denied') {
    return <p className="note note-sm">🔔 Le notifiche di questo sito sono bloccate: si riattivano dalle impostazioni del browser.</p>;
  }
  return (
    <div className="note note-sm">
      <p className="note-flush">
        {on ? "🔔 Su questo dispositivo ti arrivano le notifiche" : "🔕 Le notifiche su questo dispositivo"}: quando scade un turno
        (con i Turni con scadenza) e quando una partita va oltre i giorni impostati qui sopra. Le manda il workflow «Sincronizza
        risultati», una volta per turno o per partita.
      </p>
      <button type="button" className="secondary" disabled={busy} onClick={() => run(() => (on ? disableOrganizerPush().then(() => false) : enableOrganizerPush().then(() => true)))}>
        {on ? 'Spegni le notifiche su questo dispositivo' : '🔔 Accendi le notifiche su questo dispositivo'}
      </button>
      {error && <p className="note note-sm" role="alert">{error}</p>}
    </div>
  );
}
