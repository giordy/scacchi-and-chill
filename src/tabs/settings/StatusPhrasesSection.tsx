import React, { useEffect, useState } from 'react';
import { StatusPhrases } from '../../types';

type ListKey =
  | 'header' | 'roundEndHeader' | 'pending' | 'ongoing' | 'win' | 'draw'
  | 'aborted' | 'footer' | 'summit' | 'upset' | 'closing';

const listOf = (v: unknown): string[] => (Array.isArray(v) ? v : []);

// Editable phrase pools of the bulletin: one random phrase is picked each time
const FIELDS: { key: ListKey; label: string; vars: string; required: boolean }[] = [
  { key: 'header', label: 'Intestazione (turno in corso)', vars: '{round}', required: true },
  { key: 'roundEndHeader', label: 'Intestazione (turno concluso)', vars: '{round}', required: false },
  { key: 'pending', label: 'Partita da avviare (la scadenza è già scritta una volta sotto le partite)', vars: '{deadline}, di solito non serve', required: true },
  { key: 'ongoing', label: 'Partita in corso', vars: '{progress} (mosse e fase), {approxMoves}, {movesBand}, {phase}', required: true },
  { key: 'win', label: 'Vittoria', vars: '{winner}, {loser}, {result}, {details}, {color}, {how}, {moves}, {opening}, {openingNote}', required: true },
  { key: 'draw', label: 'Patta', vars: '{result}, {details}, {how}, {moves}, {opening}, {openingNote}', required: true },
  { key: 'aborted', label: 'Partita annullata', vars: 'nessuna', required: true },
  { key: 'footer', label: 'Riepilogo (turno in corso; a fine turno al suo posto c\'è la classifica)', vars: '{summary}, {round}, {finished}, {ongoing}, {pending}', required: true },
  { key: 'summit', label: 'Scontro al vertice (due giocatori tra i primi 3 a inizio turno)', vars: '{positions}', required: false },
  { key: 'upset', label: 'Colpaccio (sotto la vittoria, con almeno 150 punti Elo di differenza)', vars: '{winner}, {loser}, {gap}', required: false },
  { key: 'closing', label: 'Saluto finale', vars: 'nessuna', required: false },
];

// Phrases are separated by a blank line, because a phrase can span several lines
export const toPhrases = (text: string) =>
  text
    .split(/\n[ \t]*\n/)
    .map((p) => p.split('\n').map((l) => l.trimEnd()).join('\n').trim())
    .filter(Boolean);
const same = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x, i) => x === b[i]);

// Bulletin phrases: config.json gives the defaults, the edits live in the private Firestore document
export function StatusPhrasesSection({
  defaults,
  overrides,
  setOverrides,
  flash,
}: {
  defaults: StatusPhrases;
  overrides: Partial<StatusPhrases> | null;
  setOverrides: (next: Partial<StatusPhrases> | null) => void;
  flash: (kind: 'ok' | 'err', text: string) => void;
}) {
  const current = { ...defaults, ...(overrides ?? {}) };
  const textOf = (key: ListKey) => listOf(current[key]).join('\n\n');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [infoDraft, setInfoDraft] = useState(current.infoLine ?? '');

  // A remote change (another device, or the reset) replaces the drafts
  useEffect(() => {
    setDrafts({});
    setInfoDraft({ ...defaults, ...(overrides ?? {}) }.infoLine ?? '');
  }, [overrides, defaults]);

  const save = (patch: Partial<StatusPhrases>, drop: (keyof StatusPhrases)[] = []) => {
    const next: Partial<StatusPhrases> = { ...(overrides ?? {}), ...patch };
    drop.forEach((k) => delete next[k]);
    setOverrides(Object.keys(next).length > 0 ? next : null);
  };

  const commit = (key: ListKey, required: boolean) => {
    const text = drafts[key];
    if (text === undefined) return;
    const lines = toPhrases(text);
    if (required && lines.length === 0) {
      flash('err', 'Serve almeno una frase: ripristinate quelle predefinite.');
      save({}, [key]);
    } else if (same(lines, listOf(defaults[key]))) {
      save({}, [key]);
    } else {
      save({ [key]: lines });
    }
    setDrafts(({ [key]: _done, ...rest }) => rest);
  };

  const commitInfo = () => {
    const text = infoDraft.trim();
    if (text === (defaults.infoLine ?? '')) save({}, ['infoLine']);
    else save({ infoLine: text });
  };

  return (
    <>
      <h4 className="subcard-title">Frasi del bollettino</h4>
      <p className="note">
        Separa le frasi con una riga vuota (una frase può occupare più righe): ogni volta il bollettino ne sceglie una a caso. Le modifiche si salvano quando esci dal campo e
        valgono su tutti i tuoi dispositivi. Le parole tra graffe vengono sostituite con i dati della partita.
      </p>
      {FIELDS.map(({ key, label, vars, required }) => {
        const custom = overrides?.[key] !== undefined;
        return (
          <div key={key}>
            <label htmlFor={`phr-${key}`}>
              {label}
              {custom && <span className="phrase-custom"> · personalizzato</span>}
            </label>
            <textarea
              id={`phr-${key}`}
              className="small"
              rows={Math.min(10, Math.max(3, textOf(key).split('\n').length + 1))}
              value={drafts[key] ?? textOf(key)}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              onBlur={() => commit(key, required)}
            />
            <p className="note">
              Variabili: {vars}
              {!required && ' · lascia vuoto per non usarlo'}
            </p>
          </div>
        );
      })}
      <div>
        <label htmlFor="phr-infoLine">
          Riga finale con il link al sito (turno concluso)
          {overrides?.infoLine !== undefined && <span className="phrase-custom"> · personalizzato</span>}
        </label>
        <input id="phr-infoLine" value={infoDraft} onChange={(e) => setInfoDraft(e.target.value)} onBlur={commitInfo} />
      </div>
      <button
        className="secondary"
        type="button"
        disabled={!overrides}
        onClick={() => {
          setOverrides(null);
          flash('ok', 'Frasi del bollettino ripristinate da config.json.');
        }}
      >
        Ripristina frasi predefinite
      </button>
    </>
  );
}
