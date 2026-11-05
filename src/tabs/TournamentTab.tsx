import React from 'react';
import {
  AppConfig,
  HistoryGame,
  LichessExportGame,
  MessageTemplates,
  Player,
  ScheduledMatch,
  SeasonArchive,
  Settings,
  TournamentMeta,
} from '../types';
import type { OrganizerStore } from '../hooks/useOrganizerData';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { SeasonInfoSection } from './settings/SeasonInfoSection';
import { RulesSection } from './settings/RulesSection';
import { PlayersSection } from './settings/PlayersSection';
import { SeasonArchiveSection } from './settings/SeasonArchiveSection';
import { HallOfFameSection } from './settings/HallOfFameSection';
import { LichessSettingsSection } from './settings/LichessSettingsSection';
import { StatusPhrasesSection } from './settings/StatusPhrasesSection';
import { BackupSection } from './settings/BackupSection';
import { WithdrawalSection } from './settings/WithdrawalSection';
import { applyWithdrawals } from '../lib/withdrawals';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Everything about the tournament itself, grouped by topic. Sections are native <details>,
// so only "Stagione corrente" is open by default.
export function TournamentTab({
  config,
  settings,
  setSettings,
  templates,
  setTemplates,
  history,
  setHistory,
  onSeasonReset,
  gameStates,
  seasons,
  organizer,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  config: AppConfig;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  // Closes the open round: the new season starts from the list of rounds
  onSeasonReset: () => void;
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  organizer: OrganizerStore;
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
        />
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

      <CollapsibleSection title="Lichess e messaggi WhatsApp">
        <LichessSettingsSection
          settings={settings}
          setSettings={setSettings}
          templates={templates}
          setTemplates={setTemplates}
          flash={flash}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Frasi del bollettino">
        <StatusPhrasesSection
          defaults={config.statusPhrases}
          overrides={organizer.statusPhrases ?? null}
          setOverrides={organizer.setStatusPhrases}
          flash={flash}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Copia dei dati">
        <BackupSection
          config={config}
          history={history}
          seasons={seasons}
          settings={settings}
          templates={templates}
          organizer={organizer}
          flash={flash}
          setHistory={setHistory}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
          onUpdatePlayers={onUpdatePlayers}
          onUpdateSchedule={onUpdateSchedule}
        />
      </CollapsibleSection>
    </div>
  );
}
