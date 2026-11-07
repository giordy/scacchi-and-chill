import React from 'react';
import {
  AppConfig,
  HistoryGame,
  LichessExportGame,
  Player,
  ScheduledMatch,
  SeasonArchive,
  Settings,
  TournamentMeta,
} from '../types';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { SeasonInfoSection } from './settings/SeasonInfoSection';
import { MasterAnecdotesSection } from './settings/MasterAnecdotesSection';
import { RulesSection } from './settings/RulesSection';
import { PlayersSection } from './settings/PlayersSection';
import { SeasonArchiveSection } from './settings/SeasonArchiveSection';
import { HallOfFameSection } from './settings/HallOfFameSection';
import { RebuildSeasonSection } from './settings/RebuildSeasonSection';
import { ChallengeSection } from './settings/ChallengeSection';
import { WithdrawalSection } from './settings/WithdrawalSection';
import { applyWithdrawals } from '../lib/withdrawals';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The season and its people, grouped by topic: what changes during a season and shows on the public
// page. Set-and-forget settings (token, message texts, backup) are in SettingsTab. Sections are
// native <details>, so only "Stagione corrente" is open by default.
export function TournamentTab({
  config,
  settings,
  setSettings,
  history,
  setHistory,
  onSeasonReset,
  gameStates,
  seasons,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  config: AppConfig;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  // Closes the open round: the new season starts from the list of rounds
  onSeasonReset: () => void;
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const meta = config.tournament;
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Stagione corrente" defaultOpen>
        <SeasonInfoSection meta={meta} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
        <MasterAnecdotesSection meta={meta} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
      </CollapsibleSection>

      <CollapsibleSection title={`Giocatori (${config.players.length})`}>
        <PlayersSection players={config.players} flash={flash} onUpdatePlayers={onUpdatePlayers} />
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

      <CollapsibleSection title="Regolamento">
        <RulesSection
          meta={meta}
          days={settings.days}
          rated={settings.rated}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
        >
          <ChallengeSection settings={settings} setSettings={setSettings} />
        </RulesSection>
      </CollapsibleSection>

      <CollapsibleSection title={`Fine stagione e storico (${seasons.length})`}>
        <SeasonArchiveSection
          config={config}
          history={applyWithdrawals(history, meta?.withdrawals)}
          gameStates={gameStates}
          seasons={seasons}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
          onUpdateSchedule={onUpdateSchedule}
          setHistory={setHistory}
          onSeasonReset={onSeasonReset}
        />
        <HallOfFameSection
          winners={meta?.winners ?? []}
          players={config.players}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
        />
        <RebuildSeasonSection config={config} seasons={seasons} history={history} flash={flash} />
      </CollapsibleSection>

    </div>
  );
}
