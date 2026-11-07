import React from 'react';
import {
  AppConfig,
  HistoryGame,
  LichessExportGame,
  ScheduledMatch,
  SeasonArchive,
  Settings,
  TournamentMeta,
} from '../types';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { SeasonInfoSection } from './settings/SeasonInfoSection';
import { MasterAnecdotesSection } from './settings/MasterAnecdotesSection';
import { RulesSection } from './settings/RulesSection';
import { SeasonArchiveSection } from './settings/SeasonArchiveSection';
import { HallOfFameSection } from './settings/HallOfFameSection';
import { ChallengeSection } from './settings/ChallengeSection';
import { applyWithdrawals } from '../lib/withdrawals';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The seasons: the current one (name, master, anecdotes, rules), closing it, the history and the
// hall of fame. Players and withdrawals are in PlayersTab; set-and-forget settings (token, message
// texts, backup) in SettingsTab. Sections are native <details>, only "Stagione corrente" is open.
export function SeasonsTab({
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
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const meta = config.tournament;
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Stagione corrente" defaultOpen>
        <SeasonInfoSection meta={meta} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
        <MasterAnecdotesSection meta={meta} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
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
      </CollapsibleSection>

    </div>
  );
}
