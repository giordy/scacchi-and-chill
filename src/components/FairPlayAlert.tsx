import React from 'react';
import { HistoryGame, LichessExportGame, Withdrawal } from '../types';
import { cheatCases } from '../lib/fairPlay';

// Organizer area only: games Lichess closed for cheating, with what the rules say to do.
// Never shown on the public page (the rules ask not to accuse anyone in the group).
export function FairPlayAlert({
  history,
  gameStates,
  withdrawals,
  seen,
  onSeen,
  nameOf,
  awardsBan,
}: {
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  withdrawals: Withdrawal[];
  seen: string[];
  onSeen: (ids: string[]) => void;
  nameOf: (handle: string) => string;
  awardsBan?: boolean; // TournamentMeta.fairPlayAwardsBan: no trophy for the season
}) {
  const left = new Set(withdrawals.map((w) => w.handle));
  // A first case stays until acknowledged; a repeat stays until the player is out of the tournament
  const cases = cheatCases(history, gameStates).filter((c) => !left.has(c.handle) && (c.count >= 2 || !seen.includes(c.id)));
  if (cases.length === 0) return null;
  const firsts = cases.filter((c) => c.count === 1);

  return (
    <div className="notice warning fairplay-alert" role="alert">
      <strong>⚠️ Fair play: partite chiuse da Lichess per scorrettezza</strong>
      <ul>
        {cases.map((c) => (
          <li key={c.id}>
            Turno {c.round}: Lichess ha chiuso{' '}
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              {nameOf(c.white)} – {nameOf(c.black)}
            </a>{' '}
            attribuendo la scorrettezza a <strong>{nameOf(c.handle)}</strong>.{' '}
            {c.count === 1
              ? awardsBan
                ? 'Per regolamento perde la partita e per tutta la stagione non può vincere lo Scudetto, il Trofeo Pillsbury né gli altri premi: il sito lo fa da sé, non serve fare altro.'
                : 'Per regolamento perde la partita: il risultato di Lichess lo dice già, non serve fare altro.'
              : `È la ${c.count}ª volta: per regolamento va escluso dal torneo e i suoi risultati annullati (♟ Giocatori → Ritiri, «Esclusione per fair play»).`}
          </li>
        ))}
      </ul>
      <p className="note m-0">Come dice il regolamento, se ne parla solo in privato: questo avviso non compare sul sito.</p>
      {firsts.length > 0 && (
        <button type="button" className="secondary btn-mini btn-mini-edit mt-8" onClick={() => onSeen([...seen, ...firsts.map((c) => c.id)])}>
          Ho preso nota
        </button>
      )}
    </div>
  );
}
