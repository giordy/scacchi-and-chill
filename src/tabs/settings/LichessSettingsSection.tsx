import React, { useState, useEffect } from 'react';
import { Settings, MessageTemplates } from '../../types';
import { RULES } from '../../lib/config';
import { DaysField } from '../../components/DaysField';

export function LichessSettingsSection({
  settings,
  setSettings,
  templates,
  setTemplates,
  flash,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
}) {
  const [tokenDraft, setTokenDraft] = useState(settings.token);

  useEffect(() => {
    setTokenDraft(settings.token);
  }, [settings.token]);

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const setTemplate = (key: string, text: string) =>
    setTemplates((t) => ({ ...(t ?? {}), [key]: text } as Partial<MessageTemplates>));

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
          Crea un token su <code>lichess.org/account/oauth/token</code> con il permesso <em>Challenge</em>. Resta solo in questo browser: va inserito su ogni dispositivo da cui crei le sfide.
        </p>
      </div>

      <div className="actions two flush">
        <button
          className="secondary"
          type="button"
          onClick={() => {
            set({ token: tokenDraft.trim() });
            flash("ok", "Token salvato in questo browser.");
          }}
        >
          Salva token
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setTokenDraft("");
            set({ token: "" });
            flash("ok", "Token rimosso da questo browser.");
          }}
        >
          Dimentica token
        </button>
      </div>

      <DaysField
        id="expiry"
        label="Validità del link di sfida (giorni)"
        value={settings.expiry}
        fallback={2}
        onCommit={(n) => set({ expiry: n })}
      />

      <div>
        <label>Regole della sfida su Lichess</label>
        {RULES.map(({ key, label }) => (
          <div className="inline" key={key}>
            <input
              id={"rule-" + key}
              type="checkbox"
              checked={!!settings.rules?.[key]}
              onChange={(e) => set({ rules: { ...settings.rules, [key]: e.target.checked } })}
            />
            <label htmlFor={"rule-" + key}>{label}</label>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <p className="note">
        <strong>Testo dei messaggi WhatsApp.</strong> Puoi usare <code>{"{round}"}</code> <code>{"{days}"}</code>{" "}
        <code>{"{expiry}"}</code> <code>{"{type}"}</code> ovunque. Nelle singole partite puoi usare anche{" "}
        <code>{"{n}"}</code> <code>{"{white}"}</code> <code>{"{black}"}</code> <code>{"{url}"}</code>.
      </p>

      <div>
        <label htmlFor="tpl-header">Intestazione messaggio turno</label>
        <textarea
          id="tpl-header"
          className="small"
          value={templates.header}
          onChange={(e) => setTemplate("header", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-game">Riga di ciascuna partita</label>
        <textarea
          id="tpl-game"
          className="small"
          value={templates.game}
          onChange={(e) => setTemplate("game", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-bye">Riposo (mostrato solo se qualcuno riposa; usa {"{bye}"})</label>
        <textarea
          id="tpl-bye"
          className="small"
          value={templates.bye}
          onChange={(e) => setTemplate("bye", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-footer">Chiusura messaggio turno</label>
        <textarea
          id="tpl-footer"
          className="small"
          value={templates.footer}
          onChange={(e) => setTemplate("footer", e.target.value)}
        />
      </div>

      <button
        className="secondary"
        type="button"
        onClick={() => {
          setTemplates(null);
          flash("ok", "Testi dei messaggi ripristinati da config.json.");
        }}
      >
        Ripristina testi predefiniti
      </button>
    </>
  );
}
