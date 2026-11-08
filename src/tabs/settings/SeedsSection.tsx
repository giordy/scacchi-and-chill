import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';
import { currentSeason, tournamentElo } from '../../lib/tournamentElo';
import { firstGames, SEED_PERF_LABEL, seedDate, seedDayLabel } from '../../lib/seeds';
import { useNameOf } from '../../components/Names';

// The Elo di partenza of who plays their first season (see lib/seeds.ts): fixed by the organizer
// area on its own, as soon as each player's first game exists. Read only: a seed is fixed once.
export function SeedsSection({
  config,
  history,
  gameStates,
  seasons,
}: {
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
}) {
  const nameOf = useNameOf();
  if (seasons.length === 0) {
    return <p className="note note-flush">Nella prima stagione del torneo sono tutti esordienti: nessun Elo di partenza da Lichess.</p>;
  }
  const handles = config.players.map((p) => p.handle);
  const seeds = config.tournament?.seeds ?? [];
  const season = currentSeason(tournamentElo(seasons, handles, history, gameStates, seeds));
  // In the order of the players list
  const firstSeason = handles.filter((h) => season.firstSeason.has(h.toLowerCase()));
  if (firstSeason.length === 0) return <p className="note note-flush">Nessun giocatore è alla prima stagione.</p>;
  const first = firstGames(history, gameStates, handles);

  const detail = (handle: string): { value: string; note: string } => {
    const seed = seeds.find((s) => s.handle.toLowerCase() === handle.toLowerCase());
    if (seed && seed.rating !== null) {
      const sign = seed.offset! >= 0 ? '+' : '−';
      // The regulars the correction came from: Elo del torneo / Lichess of that kind
      const used = (seed.regulars ?? [])
        .filter((r) => r.ratings[seed.perf!] !== undefined)
        .map((r) => `${nameOf(r.handle)} ${r.elo}/${r.ratings[seed.perf!]}`);
      return {
        value: String(seed.rating),
        note:
          `Lichess ${SEED_PERF_LABEL[seed.perf!]} ${seed.lichess} del ${seedDayLabel(seed.date)}, correzione ${sign}${Math.abs(seed.offset!)}` +
          (seed.mean !== undefined ? ` (${seed.lichess! + seed.offset!}), poi a metà strada verso la media dei veterani (${seed.mean})` : '') +
          (used.length > 0 ? `. Veterani usati (Elo del torneo/Lichess): ${used.join(', ')}` : ''),
      };
    }
    if (seed) {
      const why = seed.reason ?? 'nessun Elo Lichess affidabile';
      return { value: 'esordiente', note: `al ${seedDayLabel(seed.date)}: ${why}. Si ricontrolla a ogni apertura.` };
    }
    const at = first.get(handle.toLowerCase());
    return at === undefined
      ? { value: 'in attesa', note: 'si fissa alla sua prima partita' }
      : { value: 'in calcolo', note: `dall'Elo Lichess del ${seedDayLabel(seedDate(at))}` };
  };

  return (
    <div>
      <p className="note note-flush">
        Chi gioca la prima stagione parte dal suo Elo Lichess di 30 giorni prima della sua prima partita, riportato sulla
        scala del torneo. Si fissa da solo, una volta; senza un Elo affidabile resta esordiente.
      </p>
      <ul className="player-games">
        {firstSeason.map((h) => {
          const { value, note } = detail(h);
          return (
            <li key={h} className="list-row small">
              <span>
                <strong>{nameOf(h)}</strong> · {value}
              </span>
              <span className="muted-sm">{note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
