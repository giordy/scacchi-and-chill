import React from 'react';
import { MessageTemplates } from '../../types';

// Texts of the WhatsApp message that opens a round, with its Lichess links
export function LaunchMessageSection({
  templates,
  setTemplates,
  flash,
}: {
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
}) {
  const setTemplate = (key: string, text: string) =>
    setTemplates((t) => ({ ...(t ?? {}), [key]: text } as Partial<MessageTemplates>));

  return (
    <>
      <h4 className="subcard-title">Messaggio con i link del turno</h4>
      <p className="note">
        Puoi usare <code>{"{round}"}</code> <code>{"{days}"}</code> <code>{"{expiry}"}</code> <code>{"{expiryDeadline}"}</code>{" "}
        <code>{"{type}"}</code> ovunque. Nelle singole partite puoi usare anche <code>{"{n}"}</code> <code>{"{white}"}</code>{" "}
        <code>{"{black}"}</code> <code>{"{url}"}</code>.
      </p>

      <div>
        <label htmlFor="tpl-header">Intestazione messaggio turno</label>
        <textarea id="tpl-header" className="small" value={templates.header} onChange={(e) => setTemplate("header", e.target.value)} />
      </div>
      <div>
        <label htmlFor="tpl-game">Riga di ciascuna partita</label>
        <textarea id="tpl-game" className="small" value={templates.game} onChange={(e) => setTemplate("game", e.target.value)} />
      </div>
      <div>
        <label htmlFor="tpl-bye">Riposo (mostrato solo se qualcuno riposa; usa {"{bye}"})</label>
        <textarea id="tpl-bye" className="small" value={templates.bye} onChange={(e) => setTemplate("bye", e.target.value)} />
      </div>
      <div>
        <label htmlFor="tpl-footer">Chiusura messaggio turno</label>
        <textarea id="tpl-footer" className="small" value={templates.footer} onChange={(e) => setTemplate("footer", e.target.value)} />
      </div>

      <button
        className="secondary"
        type="button"
        onClick={() => {
          if (!window.confirm('Ripristinare i testi predefiniti? I testi che hai modificato vengono cancellati.')) return;
          setTemplates(null);
          flash("ok", "Testi dei messaggi ripristinati da config.json.");
        }}
      >
        Ripristina testi predefiniti
      </button>
    </>
  );
}
