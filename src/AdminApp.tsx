import React, { useEffect, useRef, useState } from 'react';
import {
  AppConfig,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
  SeasonArchive,
  TournamentMeta,
} from './types';
import { mergeTournamentMeta } from './lib/tournament';
import { usePersistentState } from './hooks/usePersistentState';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useOrganizerData } from './hooks/useOrganizerData';
import { useLichessSync } from './hooks/useLichessSync';
import { useEloSeeds } from './hooks/useEloSeeds';
import { LoadingScreen } from './components/LoadingScreen';
import { Notice } from './components/Notice';
import { RoundsTab } from './tabs/RoundsTab';
import { SeasonsTab } from './tabs/SeasonsTab';
import { PlayersTab } from './tabs/PlayersTab';
import { SettingsTab } from './tabs/SettingsTab';
import { WhatsAppTab } from './tabs/WhatsAppTab';
import { applyWithdrawals } from './lib/withdrawals';
import { FairPlayAlert } from './components/FairPlayAlert';
import { AdminLogin } from './views/AdminLogin';
import { AdminConsole, AdminTab, isAdminTab } from './views/AdminConsole';
import { useNameOf } from './components/Names';
import { saveTournamentFullToFirebase } from './firebaseService';
import { errorMessage } from './lib/utils';

interface AdminAppProps {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  gamesLoaded: boolean;
  seasons: SeasonArchive[];
}

// Organizer area (#admin): sign-in, rounds, reviews and tournament settings. Loaded on demand by
// App, so visitors of the public page never download it (nor Firebase Authentication).
export default function AdminApp({ config, setConfig, history, setHistory, gamesLoaded, seasons }: AdminAppProps) {
  const admin = useAdminAuth();

  // v3: "Turno" and "Calendario" became "Turni", an old stored value falls back to it
  const [activeTab, setActiveTabRaw] = usePersistentState<AdminTab>('pairings.adminActiveTab.v3', 'rounds', isAdminTab);

  // Names from the players register (provided by App)
  const nameOf = useNameOf();

  // Round open in the "Turni" tab; empty shows the list of rounds
  const [openRound, setOpenRoundRaw] = usePersistentState<string>("pairings.openRound", "", (v) => typeof v === "string");

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  const flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => {
    setNotice({ kind, text, items });
    if (kind === 'ok') triggerToast(text);
  };

  const setActiveTab = (tab: AdminTab) => {
    setNotice(null);
    setActiveTabRaw(tab);
  };

  const saveFailed = (what: string) => (e: unknown) => flash('err', `Salvataggio ${what} su Firestore non riuscito: ${errorMessage(e)}`);

  const updateTournamentMeta = (patch: Partial<TournamentMeta>) => {
    const updatedMeta: TournamentMeta = mergeTournamentMeta(config.tournament, patch);
    setConfig((prev) => ({ ...prev, tournament: updatedMeta }));
    saveTournamentFullToFirebase({ meta: updatedMeta }).catch(saveFailed('del torneo'));
  };
  const updatePlayers = (updatedPlayers: AppConfig['players']) => {
    setConfig((prev) => ({ ...prev, players: updatedPlayers }));
    saveTournamentFullToFirebase({ players: updatedPlayers }).catch(saveFailed('dei giocatori'));
  };
  const updateSchedule = (updatedSchedule: NonNullable<AppConfig['schedule']>) => {
    setConfig((prev) => ({ ...prev, schedule: updatedSchedule }));
    saveTournamentFullToFirebase({ schedule: updatedSchedule }).catch(saveFailed('del calendario'));
  };

  const organizer = useOrganizerData(admin.isAuthenticated, (msg) => flash('err', msg));

  const defaultSettings: Settings = {
    token: "",
    days: config.defaults.days,
    expiry: config.defaults.expiry,
    rated: config.defaults.rated,
    rules: config.defaults.rules,
  };
  // Organizer settings and message texts live in the private Firestore document (same on every device)
  const storedSettings = organizer.settings ?? {};
  const settings: Settings = {
    ...defaultSettings,
    ...storedSettings,
    rules: { ...defaultSettings.rules, ...(storedSettings.rules ?? {}) },
  };
  // Days per move and rated belong to the tournament (shown in the public rules): they win over the organizer settings
  if (config.tournament?.daysPerMove) settings.days = config.tournament.daysPerMove;
  if (typeof config.tournament?.rated === 'boolean') settings.rated = config.tournament.rated;
  // Message texts and bulletin phrases: in config.json only (changed with a redeploy)
  const tpl: MessageTemplates = config.messageTemplates;

  // Results as the standings see them: games annulled or won by forfeit after a withdrawal
  const seasonHistory = applyWithdrawals(history, config.tournament?.withdrawals);

  const lichess = useLichessSync(history, setHistory, flash);

  // Bring the latest Lichess results to the public page as soon as the organizer opens the admin area
  const autoSynced = useRef(false);
  const canAutoSync = admin.isAuthenticated && gamesLoaded;
  useEffect(() => {
    if (!canAutoSync || autoSynced.current) return;
    autoSynced.current = true;
    lichess.sync({ quiet: true });
  }, [canAutoSync]);

  // Where the esordienti start in the Elo del torneo: fixed from Lichess at their first game
  useEloSeeds({
    // After the organizer's settings: the Lichess token is asked with
    enabled: canAutoSync && organizer.loaded,
    config,
    history,
    gameStates: lichess.gameStates,
    seasons,
    onUpdateTournamentMeta: updateTournamentMeta,
    flash,
    nameOf,
    token: settings.token || undefined,
  });

  const setOpenRound = (r: string) => {
    setNotice(null);
    setOpenRoundRaw(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!admin.authReady) {
    return <LoadingScreen label="Verifica accesso…" />;
  }

  if (!admin.isAuthenticated) {
    return <AdminLogin error={admin.error} isSigningIn={admin.isSigningIn} onLogin={admin.login} />;
  }

  return (
    <AdminConsole
      title={config.tournament?.title || "Scacchi & Chill"}
      email={admin.email}
      onLogout={admin.logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isSyncing={lichess.isSyncing}
      lastSyncTime={lichess.lastSyncTime}
      onSync={() => lichess.sync()}
      toastMessage={toastMessage}
    >
      <FairPlayAlert
        history={history}
        gameStates={lichess.gameStates}
        withdrawals={config.tournament?.withdrawals ?? []}
        seen={organizer.fairPlaySeen ?? []}
        onSeen={(ids) => organizer.replaceAll({ fairPlaySeen: ids })}
        nameOf={nameOf}
      />

      {activeTab === 'rounds' && (
        <>
          <Notice notice={notice} />
          <RoundsTab
            openRound={openRound}
            setOpenRound={setOpenRound}
            config={config}
            settings={settings}
            templates={tpl}
            history={history}
            setHistory={setHistory}
            gameStates={lichess.gameStates}
            onUpdateSchedule={updateSchedule}
            nameOf={nameOf}
            flash={flash}
            triggerToast={triggerToast}
            onMissingToken={() => setActiveTab('settings')}
            onOpenCalendar={() => setActiveTab('seasons')}
            seasons={seasons}
          />
        </>
      )}

      {activeTab === 'whatsapp' && (
        <>
          <Notice notice={notice} />
          <WhatsAppTab
            config={config}
            history={seasonHistory}
            gameStates={lichess.gameStates}
            nameOf={nameOf}
            organizer={organizer}
            flash={flash}
            triggerToast={triggerToast}
            seasons={seasons}
          />
        </>
      )}

      {activeTab === 'players' && (
        <>
          <Notice notice={notice} />
          <PlayersTab
            config={config}
            history={history}
            setHistory={setHistory}
            gameStates={lichess.gameStates}
            seasons={seasons}
            flash={flash}
            onUpdateTournamentMeta={updateTournamentMeta}
            onUpdatePlayers={updatePlayers}
            onUpdateSchedule={updateSchedule}
          />
        </>
      )}

      {activeTab === 'seasons' && (
        <>
          <Notice notice={notice} />
          <SeasonsTab
            config={config}
            settings={settings}
            setSettings={organizer.setSettings}
            history={history}
            setHistory={setHistory}
            onSeasonReset={() => setOpenRoundRaw("")}
            gameStates={lichess.gameStates}
            seasons={seasons}
            flash={flash}
            onUpdateTournamentMeta={updateTournamentMeta}
            onUpdateSchedule={updateSchedule}
          />
        </>
      )}

      {activeTab === 'settings' && (
        <>
          <Notice notice={notice} />
          <SettingsTab
            config={config}
            settings={settings}
            setSettings={organizer.setSettings}
            history={history}
            setHistory={setHistory}
            seasons={seasons}
            organizer={organizer}
            flash={flash}
            onUpdateTournamentMeta={updateTournamentMeta}
            onUpdatePlayers={updatePlayers}
            onUpdateSchedule={updateSchedule}
          />
        </>
      )}
    </AdminConsole>
  );
}

