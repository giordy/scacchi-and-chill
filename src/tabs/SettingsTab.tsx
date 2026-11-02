import React from 'react';
import {
  AppConfig,
  Player,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  TournamentMeta,
  ScheduledMatch,
} from '../types';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { TournamentInfoSection } from './settings/TournamentInfoSection';
import { PlayersSection } from './settings/PlayersSection';
import { ScheduleSection } from './settings/ScheduleSection';
import { LichessSettingsSection } from './settings/LichessSettingsSection';
import { BackupSection } from './settings/BackupSection';

export function SettingsTab({
  settings,
  setSettings,
  templates,
  setTemplates,
  history,
  setHistory,
  round,
  setRound,
  pairs,
  setPairs,
  flash,
  panelRef,
  config,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  round: string;
  setRound: (r: string) => void;
  pairs: GamePair[];
  setPairs: React.Dispatch<React.SetStateAction<GamePair[]>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  panelRef: React.RefObject<HTMLDivElement>;
  config: AppConfig;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  return (
    <div ref={panelRef} className="settings-stack">
      <CollapsibleSection title="🏆 Informazioni Torneo & Nuova Stagione" defaultOpen>
        <TournamentInfoSection
          config={config}
          history={history}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
        />
      </CollapsibleSection>
      <CollapsibleSection title={`👥 Giocatori del Torneo (${config.players.length})`}>
        <PlayersSection players={config.players} flash={flash} onUpdatePlayers={onUpdatePlayers} />
      </CollapsibleSection>
      <CollapsibleSection title={`📅 Calendario Ufficiale Accoppiamenti (${(config.schedule ?? []).length} partite)`}>
        <ScheduleSection
          players={config.players}
          schedule={config.schedule}
          flash={flash}
          onUpdateSchedule={onUpdateSchedule}
        />
      </CollapsibleSection>
      <CollapsibleSection title="⚙️ Lichess, regole e messaggi">
        <LichessSettingsSection
          settings={settings}
          setSettings={setSettings}
          templates={templates}
          setTemplates={setTemplates}
          flash={flash}
        />
      </CollapsibleSection>
      <CollapsibleSection title="💾 Backup & Ripristino Dati">
        <BackupSection
          settings={settings}
          setSettings={setSettings}
          templates={templates}
          setTemplates={setTemplates}
          history={history}
          setHistory={setHistory}
          round={round}
          setRound={setRound}
          pairs={pairs}
          setPairs={setPairs}
          flash={flash}
        />
      </CollapsibleSection>
    </div>
  );
}
