import React, { useEffect, useState } from 'react';
import { TournamentMeta } from '../../types';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';
import { DaysField } from '../../components/DaysField';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Public rules: how the tournament works, fair play and the Lichess parameters.
// Days per move and rated live on the tournament document, so the public page shows the real values
// and the challenges are created with the same ones.
export function RulesSection({
  meta,
  days,
  rated,
  flash,
  onUpdateTournamentMeta,
  children,
}: {
  meta?: TournamentMeta;
  days: number;
  rated: boolean;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  children?: React.ReactNode; // more fields saved at once, next to days and rated (the challenge settings)
}) {
  const [howItWorks, setHowItWorks] = useState(meta?.howItWorks || DEFAULT_TOURNAMENT.howItWorks || "");
  const [fairPlay, setFairPlay] = useState(meta?.fairPlayText || DEFAULT_TOURNAMENT.fairPlayText || "");
  const [withdrawal, setWithdrawal] = useState(meta?.withdrawalText || DEFAULT_TOURNAMENT.withdrawalText || "");
  useEffect(() => {
    if (meta?.howItWorks) setHowItWorks(meta.howItWorks);
    if (meta?.fairPlayText) setFairPlay(meta.fairPlayText);
    if (meta?.withdrawalText) setWithdrawal(meta.withdrawalText);
  }, [meta?.howItWorks, meta?.fairPlayText, meta?.withdrawalText]);

  return (
    <>
      <div className="grid2">
        <DaysField
          id="days"
          label="Giorni per mossa"
          value={days}
          fallback={2}
          onCommit={(n) => onUpdateTournamentMeta({ daysPerMove: n })}
        />
        <div className="inline align-end">
          <input
            id="rated"
            type="checkbox"
            checked={rated}
            onChange={(e) => onUpdateTournamentMeta({ rated: e.target.checked })}
          />
          <label htmlFor="rated">Partite rated</label>
        </div>
      </div>
      {children}
      <p className="note">
        Questi campi si salvano subito e valgono per le sfide create da qui in poi; giorni per mossa e rated compaiono anche nel
        regolamento pubblico.
      </p>

      <hr className="divider" />

      <div>
        <label htmlFor="cfg-how">Come funziona il torneo</label>
        <textarea id="cfg-how" rows={3} className="ta-sm" value={howItWorks} onChange={(e) => setHowItWorks(e.target.value)} />
      </div>
      <div>
        <label htmlFor="cfg-fairplay">Regole di fair play</label>
        <textarea id="cfg-fairplay" rows={6} className="ta-md" value={fairPlay} onChange={(e) => setFairPlay(e.target.value)} />
      </div>
      <div>
        <label htmlFor="cfg-withdrawal">Ritiri</label>
        <textarea id="cfg-withdrawal" rows={4} className="ta-md" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} />
      </div>
      <button
        className="primary"
        type="button"
        onClick={() => {
          onUpdateTournamentMeta({ howItWorks: howItWorks.trim(), fairPlayText: fairPlay.trim(), withdrawalText: withdrawal.trim() });
          flash("ok", "Regolamento aggiornato.");
        }}
      >
        Salva regolamento
      </button>
    </>
  );
}
