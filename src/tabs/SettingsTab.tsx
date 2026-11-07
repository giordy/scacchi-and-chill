import React from 'react';
import { AppConfig, HistoryGame, MessageTemplates, Player, ScheduledMatch, SeasonArchive, Settings, TournamentMeta } from '../types';
import type { OrganizerStore } from '../hooks/useOrganizerData';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { TokenSection } from './settings/TokenSection';
import { BackupSection } from './settings/BackupSection';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Set-and-forget settings: the Lichess token and the copy of the data. The texts of the WhatsApp
// messages are in WhatsAppTab, the season in SeasonsTab, the players in PlayersTab.
export function SettingsTab({
  config,
  settings,
  setSettings,
  templates,
  setTemplates,
  history,
  setHistory,
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
  seasons: SeasonArchive[];
  organizer: OrganizerStore;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Token Lichess" defaultOpen={!settings.token}>
        <TokenSection settings={settings} setSettings={setSettings} flash={flash} />
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
