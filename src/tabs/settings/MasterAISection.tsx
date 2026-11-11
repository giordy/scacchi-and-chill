import React, { useEffect, useState } from 'react';
import { ScheduledMatch, TournamentMeta } from '../../types';
import { buildMasterPrompt, MasterReply, parseMasterReply } from '../../lib/masterPrompt';
import { openingFamily } from '../../lib/masterOpening';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// One anecdote per round: the rounds of the calendar, or a double round robin of the players
export function roundsForAnecdotes(schedule: ScheduledMatch[], players: number): number {
  const rounds = new Set(schedule.map((m) => m.round)).size;
  if (rounds > 0) return rounds;
  if (players < 2) return 10;
  return (players % 2 === 0 ? players - 1 : players) * 2;
}

// A new master prepared with an AI: copy the prompt, paste the reply, fill in the season's texts
export function MasterAISection({
  meta,
  schedule,
  players,
  flash,
  onUpdateTournamentMeta,
}: {
  meta?: TournamentMeta;
  schedule: ScheduledMatch[];
  players: number;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const [master, setMaster] = useState(meta?.masterName ?? '');
  // The master set when the season closes, or loaded after this opened
  useEffect(() => setMaster(meta?.masterName ?? ''), [meta?.masterName]);
  const [rounds, setRounds] = useState(() => roundsForAnecdotes(schedule, players));
  const [reply, setReply] = useState('');
  const [result, setResult] = useState<(MasterReply & { master: string }) | null>(null);

  const copyPrompt = async () => {
    if (!master.trim()) {
      flash('err', 'Scrivi prima il nome del maestro.');
      return;
    }
    const prompt = buildMasterPrompt({ master: master.trim(), rounds, tournamentTitle: meta?.title || DEFAULT_TOURNAMENT.title });
    try {
      await navigator.clipboard.writeText(prompt);
      flash('ok', 'Prompt copiato: incollalo in Claude o ChatGPT, poi incolla qui sotto la risposta.');
    } catch {
      flash('err', 'Non riesco a copiare il prompt: prova da un altro browser.');
    }
  };

  const apply = () => {
    let parsed: MasterReply;
    try {
      parsed = parseMasterReply(reply, meta?.famousGame);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
      return;
    }
    const p = parsed.patch;
    const replaced = [
      p.subtitle && 'motto',
      p.description && 'presentazione',
      p.masterAnecdotes && `aneddoti (${p.masterAnecdotes.length})`,
      p.masterOpening && 'apertura',
      p.famousGame && 'partita celebre',
    ].filter(Boolean);
    if (!window.confirm(`Sostituire ${replaced.join(', ')} di ${master.trim() || 'questa stagione'} con quelli della risposta?`)) return;
    onUpdateTournamentMeta({ ...(master.trim() ? { masterName: master.trim() } : {}), ...p });
    setResult({ ...parsed, master: master.trim() });
    setReply('');
    flash('ok', 'Testi del maestro compilati: rileggili qui sopra e negli aneddoti.', parsed.warnings);
  };

  return (
    <div className="subcard">
      <h4 className="subcard-title">Prepara il maestro con l'AI</h4>
      <p className="note note-sm">
        Un prompt per Claude o ChatGPT con tutto quello che serve: motto, presentazione, un aneddoto per turno, apertura e
        partita celebre. Incolla qui la risposta e i campi si compilano da soli. La foto e il link della partita restano da
        cercare a te.
      </p>
      <div className="grid2">
        <div>
          <label htmlFor="ai-master">Maestro</label>
          <input id="ai-master" type="text" placeholder="es. Mikhail Tal" value={master} onChange={(e) => setMaster(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ai-rounds">Aneddoti (uno per turno)</label>
          <input
            id="ai-rounds"
            type="number"
            min={1}
            max={60}
            value={rounds}
            onChange={(e) => setRounds(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
          />
        </div>
      </div>
      <button type="button" className="secondary" onClick={copyPrompt}>
        📋 Copia prompt
      </button>
      <label htmlFor="ai-reply">Risposta dell'AI</label>
      <textarea id="ai-reply" rows={6} placeholder="Incolla qui la risposta, con il blocco JSON" value={reply} onChange={(e) => setReply(e.target.value)} />
      <button type="button" className="primary" disabled={!reply.trim()} onClick={apply}>
        Compila i campi
      </button>
      {result && (
        <div className="ai-result">
          <p className="note note-sm m-0">
            Compilati per {result.master || 'il maestro'}
            {result.patch.masterOpening ? `, apertura: ${openingFamily(result.patch.masterOpening)?.label}` : ''}.
            {result.patch.famousGame && !result.patch.famousGame.url ? ' Manca il link della partita celebre: cercala su Lichess.' : ''}
          </p>
          {result.photo && <p className="note note-sm m-0">📷 Foto: {result.photo}</p>}
          {result.toCheck.length > 0 && (
            <>
              <p className="note note-sm m-0">⚠️ Da verificare prima di pubblicare:</p>
              <ul className="note note-sm ai-check">
                {result.toCheck.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
