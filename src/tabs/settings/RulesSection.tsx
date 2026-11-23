import React, { useEffect, useState } from 'react';
import { TournamentMeta } from '../../types';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';
import { DaysField } from '../../components/DaysField';
import { OrganizerPushToggle } from '../../components/OrganizerPushToggle';
import { DEFAULT_FINAL_ROUNDS, DEFAULT_ROUND_DAYS, finalRoundsOf, MAX_FINAL_ROUNDS, MAX_ROUND_DAYS, MIN_ROUND_DAYS, roundDeadlinesOn } from '../../lib/roundDeadline';

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

  const roundDaysOn = roundDeadlinesOn(meta);
  const finalRounds = finalRoundsOf(meta);

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

      {/* Turni con scadenza (lib/roundDeadline.ts): off until a length is set */}
      <div>
        <div className="inline">
          <input
            id="round-deadline"
            type="checkbox"
            checked={roundDaysOn}
            onChange={(e) => onUpdateTournamentMeta({ roundDays: e.target.checked ? DEFAULT_ROUND_DAYS : 0 })}
          />
          <label htmlFor="round-deadline">Turni con scadenza</label>
        </div>
        {roundDaysOn && (
          <DaysField
            id="round-days"
            label="Durata del turno (giorni)"
            value={meta!.roundDays!}
            fallback={DEFAULT_ROUND_DAYS}
            min={MIN_ROUND_DAYS}
            max={MAX_ROUND_DAYS}
            onCommit={(n) => onUpdateTournamentMeta({ roundDays: n })}
          />
        )}
        <p className="note">
          {roundDaysOn
            ? `Ogni turno dura ${meta!.roundDays} giorni dalla creazione delle sfide. Allo scadere puoi creare il turno successivo: le partite ancora aperte continuano, nessun risultato viene deciso dalla scadenza. Nessuno gioca più di 2 partite insieme: se un giocatore del turno successivo ne ha già 2 in corso, il turno aspetta che ne chiuda una (creando le sfide prima, il sito chiede conferma). Vale per i turni creati da qui in poi; in Turni puoi spostare o togliere la scadenza di un turno, o darla a quello in corso. Compare nella pagina pubblica, nei messaggi e nel regolamento.`
            : "Spenta: i turni non hanno una data di fine e il successivo parte quando lo crei. Accesa, ogni turno dura un numero di giorni e allo scadere puoi creare il successivo, mentre le partite ancora aperte continuano."}
        </p>
        {roundDaysOn && (
          <>
            <div className="inline">
              <input
                id="final-rounds"
                type="checkbox"
                checked={finalRounds > 0}
                onChange={(e) => onUpdateTournamentMeta({ finalRoundsWait: e.target.checked ? DEFAULT_FINAL_ROUNDS : 0 })}
              />
              <label htmlFor="final-rounds">Ultime giornate senza sovrapposizione</label>
            </div>
            {finalRounds > 0 && (
              <DaysField
                id="final-rounds-count"
                label="Quante giornate"
                value={finalRounds}
                fallback={DEFAULT_FINAL_ROUNDS}
                min={1}
                max={MAX_FINAL_ROUNDS}
                onCommit={(n) => onUpdateTournamentMeta({ finalRoundsWait: n })}
              />
            )}
            <p className="note">
              {finalRounds > 0
                ? `Le ultime ${finalRounds === 1 ? "giornata parte" : `${finalRounds} giornate partono`} solo quando sono finite tutte le partite dei turni prima: allo scadere di un turno il sito non propone il successivo finché resta una partita in corso, così nessuno gioca il finale conoscendo i risultati di un turno dopo. Avvisi e bollettino dicono quante partite mancano, senza nominare nessuno. Creando le sfide prima, chiede conferma. Compare nel regolamento.`
                : "Spenta: anche nelle ultime giornate, allo scadere di un turno puoi creare il successivo mentre le partite aperte continuano."}
            </p>
            <OrganizerPushToggle />
          </>
        )}
      </div>

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
