import React, { useEffect, useState } from 'react';
import { Settings } from '../../types';

// The organizer's Lichess token, needed to create the challenges
export function TokenSection({
  settings,
  setSettings,
  flash,
}: {
  settings: Settings;
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
