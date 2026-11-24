import React, { useEffect, useState } from 'react';
import { Settings } from '../../types';
import { TokenCheck, formatDay, tokenWarning } from '../../lib/tokenCheck';

// The organizer's Lichess token, needed to create the challenges
export function TokenSection({
  settings,
  setSettings,
  flash,
  check = null,
}: {
  settings: Settings;
  check?: TokenCheck | null; // what Lichess says of the saved token; null while unknown
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
}) {
  const [tokenDraft, setTokenDraft] = useState(settings.token);
  useEffect(() => {
    setTokenDraft(settings.token);
  }, [settings.token]);
  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <>
      <div>
        <label htmlFor="token">Token API Lichess (Organizzatore)</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          placeholder="lip_…"
          value={tokenDraft}
          onChange={(e) => setTokenDraft(e.target.value)}
        />
        <p className="note">
          Crea un token su <code>lichess.org/account/oauth/token</code> con il permesso <em>Challenge</em>. Si salva nel documento privato del torneo, leggibile solo dal tuo account: vale su tutti i tuoi dispositivi.
        </p>
        <TokenStatus check={check} />
      </div>

      <div className="actions two flush">
        <button
          className="secondary"
          type="button"
          onClick={() => {
            set({ token: tokenDraft.trim() });
            flash("ok", "Token salvato.");
          }}
        >
          Salva token
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            if (!window.confirm("Dimenticare il token Lichess? Per creare le sfide andrà incollato di nuovo.")) return;
            setTokenDraft("");
            set({ token: "" });
            flash("ok", "Token rimosso.");
          }}
        >
          Dimentica token
        </button>
      </div>
    </>
  );
}

// What Lichess says of the saved token
export function TokenStatus({ check }: { check: TokenCheck | null }) {
  if (!check) return null;
  if (check.kind === 'ok') {
    return (
      <p className="note" role="status">
        ✓ Valido{check.userId ? `, dell'account @${check.userId}` : ''}, con il permesso Challenge
        {check.expires ? `: scade ${formatDay(check.expires)}.` : ', senza scadenza.'}
      </p>
    );
  }
  return (
    <p className="notice warning" role="status">
      {tokenWarning(check)}
    </p>
  );
}
