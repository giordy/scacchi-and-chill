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
import { MasterAISection } from './settings/MasterAISection';
import { RulesSection } from './settings/RulesSection';
import { PledgesSection } from './settings/PledgesSection';
import { usePledges } from '../hooks/usePledges';
import { pledgeStatus, rulesVersion } from '../lib/pledges';
import { SeasonArchiveSection } from './settings/SeasonArchiveSection';
import { HallOfFameSection } from './settings/HallOfFameSection';
import { GeneratorSection } from './rounds/GeneratorSection';
import { ChallengeSection } from './settings/ChallengeSection';
import { SeedsSection } from './settings/SeedsSection';
import { applyWithdrawals } from '../lib/withdrawals';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The seasons: the current one (name, master, anecdotes, rules, Elo di partenza), closing it, the history and the
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
  // Who accepted the rules of the season (lib/pledges.ts)
  const { pledges, loaded: pledgesLoaded, reload: reloadPledges } = usePledges();
  const pledgeState = pledgeStatus(pledges, meta?.season ?? '', config.players, rulesVersion(meta));
  return (
    <div className="settings-stack">
      <CollapsibleSection title="Stagione corrente" defaultOpen>
        <MasterAISection
          meta={meta}
          schedule={config.schedule ?? []}
          players={config.players.length}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
        />
        <SeasonInfoSection meta={meta} seasons={seasons} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
        <MasterAnecdotesSection meta={meta} flash={flash} onUpdateTournamentMeta={onUpdateTournamentMeta} />
      </CollapsibleSection>

      <CollapsibleSection
        title={pledgesLoaded && config.players.length > 0 ? `Regolamento · accettato da ${pledgeState.accepted.length} su ${config.players.length}` : 'Regolamento'}
      >
        <RulesSection
          meta={meta}
          days={settings.days}
          rated={settings.rated}
          flash={flash}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
        >
          <ChallengeSection settings={settings} setSettings={setSettings} />
        </RulesSection>
        {pledgesLoaded && meta?.season && (
          <PledgesSection season={meta.season} status={pledgeState} players={config.players} onReload={reloadPledges} flash={flash} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Elo di partenza">
        <SeedsSection config={config} history={history} gameStates={gameStates} seasons={seasons} />
      </CollapsibleSection>

      {/* At the start of a season: the round robin, or the rounds still missing (open while there are none) */}
      <CollapsibleSection title="Calendario" defaultOpen={(config.schedule ?? []).length === 0 && history.length === 0}>
        <GeneratorSection
          players={config.players}
          schedule={config.schedule ?? []}
          played={history}
          flash={flash}
          onUpdateSchedule={onUpdateSchedule}
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

    </div>
  );
}
