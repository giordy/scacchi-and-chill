import React from 'react';
import { AppConfig, HistoryGame, Player, ScheduledMatch, SeasonArchive, Settings, TournamentMeta } from '../types';
import type { OrganizerStore } from '../hooks/useOrganizerData';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { TokenSection } from './settings/TokenSection';
import { BackupSection } from './settings/BackupSection';
import { AlertsSection } from './settings/AlertsSection';
import type { TokenCheck } from '../lib/tokenCheck';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Set-and-forget settings: the Lichess token, the organizer's notices and the copy of the data. The texts of the WhatsApp
// messages are in WhatsAppTab, the season in SeasonsTab, the players in PlayersTab.
export function SettingsTab({
  config,
  settings,
  setSettings,
  history,
  setHistory,
  seasons,
  organizer,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
  tokenCheck = null,
}: {
  config: AppConfig;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  seasons: SeasonArchive[];
  organizer: OrganizerStore;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  tokenCheck?: TokenCheck | null; // what Lichess says of the token (lib/tokenCheck.ts)
}) {
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Token Lichess" id="token" defaultOpen={!settings.token}>
        <TokenSection settings={settings} setSettings={setSettings} flash={flash} check={tokenCheck} />
      </CollapsibleSection>

      <CollapsibleSection title="Avvisi all'organizzatore" id="avvisi">
        <AlertsSection meta={config.tournament} onUpdateTournamentMeta={onUpdateTournamentMeta} />
      </CollapsibleSection>

      <CollapsibleSection title="Copia dei dati" id="copia-dati">
        <BackupSection
          config={config}
          history={history}
          seasons={seasons}
          settings={settings}
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
