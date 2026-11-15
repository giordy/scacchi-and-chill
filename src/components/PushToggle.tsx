import { useEffect, useState } from 'react';
import { Player } from '../types';
import { disablePush, enablePush, PushSetting, pushSupport, refreshPush, savedSetting } from '../lib/push';
import { errorMessage } from '../lib/utils';

// Partite tab, next to the round filter: switches the push notifications of the moves on and off
// (lib/push.ts). A player can skip their own games: Lichess tells them already.
export function PushToggle({ players }: { players: Player[] }) {
  const support = pushSupport();
  const [setting, setSetting] = useState<PushSetting | null>(savedSetting);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(setting?.skip ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    refreshPush()
      .then((s) => {
        if (alive) setSetting(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (support === 'none') return null;

  const run = async (action: () => Promise<PushSetting | null>) => {
    setBusy(true);
    setError('');
    try {
      const next = await action();
      setSetting(next);
      setSkip(next?.skip ?? '');
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="push-button" aria-expanded={open} aria-controls="push-panel" onClick={() => setOpen((o) => !o)}>
        {setting ? '🔔 Avvisi attivi' : '🔕 Avvisami'}
      </button>
      {open && (
        <div id="push-panel" className="push-panel">
          {support === 'ios-browser' ? (
            <p className="note m-0">
              Su iPhone e iPad gli avvisi arrivano solo dall'app: in Safari tocca Condividi, poi «Aggiungi alla schermata Home», e apri il sito da lì.
            </p>
          ) : support === 'denied' ? (
            <p className="note m-0">Le notifiche di questo sito sono bloccate: si riattivano dalle impostazioni del browser.</p>
          ) : (
            <>
              <p className="note m-0">
                Una notifica quando nelle partite del torneo c'è una mossa o un risultato, con qualche minuto di ritardo.
              </p>
              <label htmlFor="push-skip" className="sr-only">Le tue partite</label>
              <select id="push-skip" className="filter-select" value={skip} onChange={(e) => setSkip(e.target.value)} disabled={busy}>
                <option value="">Tutte le partite</option>
                {players.map((p) => (
                  <option key={p.handle} value={p.handle.toLowerCase()}>
                    Tranne le mie: sono {p.name}
                  </option>
                ))}
              </select>
              <div className="push-actions">
                {(!setting || skip !== setting.skip) && (
                  <button type="button" className="primary" disabled={busy} onClick={() => run(() => enablePush(skip))}>
                    {setting ? 'Salva' : 'Attiva'}
                  </button>
                )}
                {setting && (
                  <button type="button" className="secondary" disabled={busy} onClick={() => run(() => disablePush().then(() => null))}>
                    Disattiva
                  </button>
                )}
              </div>
              {error && (
                <p className="push-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
