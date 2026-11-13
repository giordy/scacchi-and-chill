import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, Player, ScheduledMatch, SeasonArchive, TournamentMeta } from '../types';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { RosterSection } from './settings/RosterSection';
import { WithdrawalSection } from './settings/WithdrawalSection';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The players: the register of everyone who ever took part (names, who plays the current season)
// and the withdrawals during the season
export function PlayersTab({
  config,
  history,
  setHistory,
  gameStates,
  seasons,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  config: AppConfig;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Registro dei giocatori" defaultOpen id="registro">
        <RosterSection
          meta={config.tournament}
          players={config.players}
          seasons={seasons}
          history={history}
          schedule={config.schedule ?? []}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
          onUpdatePlayers={onUpdatePlayers}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Ritiri">
        <WithdrawalSection
          config={config}
          history={history}
          setHistory={setHistory}
          gameStates={gameStates}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
          onUpdatePlayers={onUpdatePlayers}
          onUpdateSchedule={onUpdateSchedule}
        />
      </CollapsibleSection>
    </div>
  );
}
