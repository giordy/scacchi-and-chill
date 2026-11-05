import { useEffect, useState } from 'react';
import { AppConfig, MessageTemplates, Settings } from '../../types';
import { fill, formatDeadline } from '../../lib/utils';
import { RoundMatch } from '../../lib/rounds';
import { roundDeadline } from '../../lib/bulletin';
import { WhatsAppPreview } from '../../WhatsAppPreview';
import { anecdoteForRound, anecdoteText } from '../../lib/masterAnecdotes';

// WhatsApp message that opens the round: one line per game with its Lichess link, plus who rests
export function LaunchMessage({
  round,
  matches,
  byes,
  config,
  settings,
  templates,
  nameOf,
  flash,
}: {
  round: string;
  matches: RoundMatch[];
  byes: string[];
  config: AppConfig;
  settings: Settings;
  templates: MessageTemplates;
  nameOf: (handle: string) => string;
  flash: (kind: 'ok' | 'err', text: string) => void;
}) {
  const created = matches.filter((m) => m.url);
  // The challenges expire counting from their creation, not from when this message is written
  const expiryMs = roundDeadline(created.map((m) => m.game ?? {}), settings.expiry);
  const common = {
    round,
    days: settings.days,
    expiry: settings.expiry,
    expiryDeadline: formatDeadline(expiryMs),
    type: settings.rated ? config.typeLabels.rated : config.typeLabels.casual,
    bye: byes.join(", "),
  };
  const games = created.map((m, i) =>
    fill(templates.game, {
      ...common,
      n: config.numberEmojis[i] ?? `${i + 1}.`,
      white: nameOf(m.white),
      black: nameOf(m.black),
      url: m.url,
    })
  );
  const generated = [
    fill(templates.header, common),
    ...games,
    byes.length > 0 ? fill(templates.bye, common) : "",
    fill(templates.footer, common),
    // The anecdote about the master of the season that goes with this round
    (() => {
      const a = anecdoteForRound(config.tournament?.masterAnecdotes, round);
      return a ? anecdoteText(a.n, a.anecdote) : "";
    })(),
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n");

  const [edited, setEdited] = useState<string | null>(null);
  useEffect(() => setEdited(null), [generated]);
  const text = edited ?? generated;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("ok", "Messaggio copiato negli appunti.");
    } catch {
      flash("err", "Impossibile copiare automaticamente. Seleziona il testo e copialo a mano.");
    }
  };

  return (
    <section>
      {created.length < matches.length && (
        <div className="notice warning mb-14">
          Il messaggio contiene solo le {created.length} partite con il link: crea prima le altre su Lichess.
        </div>
      )}
      <WhatsAppPreview text={text} title={`Anteprima WhatsApp (Lancio Turno ${round})`} />
      <div className="actions two mt-12">
        <a
          className="primary"
          target="_blank"
          rel="noopener noreferrer"
          href={"https://wa.me/?text=" + encodeURIComponent(text)}
        >
          📲 Condividi su WhatsApp
        </a>
        <button className="secondary" type="button" onClick={copy}>
          📋 Copia testo
        </button>
      </div>
      <details className="raw-text mt-12">
        <summary>✏️ Modifica testo prima dell'invio</summary>
        <div className="raw-text-body">
          <textarea
            aria-label="Messaggio di lancio del turno"
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            className="ta-lg"
          />
        </div>
      </details>
    </section>
  );
}
