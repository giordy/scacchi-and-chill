import React, { useEffect, useRef, useState } from 'react';
import {
  AppConfig,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
  TournamentMeta,
} from './types';
import { defaultConfig } from './lib/config';
import { mergeTournamentMeta } from './lib/tournament';
import { usePersistentState } from './hooks/usePersistentState';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useTournamentSync } from './hooks/useTournamentSync';
import { useSeasons } from './hooks/useSeasons';
import { useOrganizerData } from './hooks/useOrganizerData';
import { useLichessSync } from './hooks/useLichessSync';
import { LoadingScreen } from './components/LoadingScreen';
import { Notice } from './components/Notice';
import { PairingsTab } from './tabs/PairingsTab';
import { StatusTab } from './tabs/StatusTab';
import { RoundTab, RoundView } from './tabs/RoundTab';
import { CalendarTab } from './tabs/CalendarTab';
import { TournamentTab } from './tabs/TournamentTab';
import { ReviewsTab } from './ReviewsTab';
import { PublicPage } from './views/PublicPage';
import { AdminLogin } from './views/AdminLogin';
import { AdminConsole, AdminTab, isAdminTab } from './views/AdminConsole';
import { saveTournamentMetaToFirebase, saveTournamentFullToFirebase } from './firebaseService';
import { errorMessage } from './lib/utils';

export function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const admin = useAdminAuth();

  // v2: the tabs were renamed, an old stored value falls back to "Turno"
  const [activeTab, setActiveTabRaw] = usePersistentState<AdminTab>('pairings.adminActiveTab.v2', 'round', isAdminTab);
  const [roundView, setRoundView] = usePersistentState<RoundView>(
    'pairings.roundView',
    'pairings',
    (v) => v === 'pairings' || v === 'status'
  );

  const gameCount = Math.floor(config.players.length / 2);
  const emptyPairs = (): GamePair[] =>
    Array.from({ length: gameCount }, () => ({ white: "", black: "", url: "" }));

  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;

  const [round, setRound] = usePersistentState<string>("pairings.round", "1");
  // Mirror of the games on Firestore (see useTournamentSync): never kept in this browser
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [pairs, setPairs] = usePersistentState<GamePair[]>(
    "pairings.pairs.v2",
    emptyPairs,
    (v) => Array.isArray(v) && v.length === gameCount
  );

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
    saveTournamentMetaToFirebase(updatedMeta).catch(saveFailed('del torneo'));
  };
  const updatePlayers = (updatedPlayers: AppConfig['players']) => {
    setConfig((prev) => ({ ...prev, players: updatedPlayers }));
    saveTournamentFullToFirebase({ players: updatedPlayers }).catch(saveFailed('dei giocatori'));
  };
  const updateSchedule = (updatedSchedule: NonNullable<AppConfig['schedule']>) => {
    setConfig((prev) => ({ ...prev, schedule: updatedSchedule }));
    saveTournamentFullToFirebase({ schedule: updatedSchedule }).catch(saveFailed('del calendario'));
  };

  const organizer = useOrganizerData(admin.isAdminRoute && admin.isAuthenticated, (msg) => flash('err', msg));
  const { ready, gamesLoaded } = useTournamentSync(setConfig, setHistory);

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
  const tpl: MessageTemplates = { ...config.messageTemplates, ...(organizer.templates ?? {}) };

  const seasons = useSeasons();
  const lichess = useLichessSync(history, setHistory, flash);

  // Bring the latest Lichess results to the public page as soon as the organizer opens the admin area
  const autoSynced = useRef(false);
  const canAutoSync = admin.isAdminRoute && admin.isAuthenticated && gamesLoaded;
  useEffect(() => {
    if (!canAutoSync || autoSynced.current) return;
    autoSynced.current = true;
    lichess.sync({ quiet: true });
  }, [canAutoSync]);

  const handleLoadRoundIntoPairs = (loadedRound: string, loadedGames: HistoryGame[]) => {
    const newPairs = emptyPairs();
    loadedGames.forEach((g, idx) => {
      if (idx < newPairs.length) {
        newPairs[idx] = { white: g.white, black: g.black, url: g.url };
      }
    });
    setRound(loadedRound);
    setPairs(newPairs);
    setActiveTab('round');
    setRoundView('pairings');
    flash("ok", `Turno ${loadedRound} aperto in Accoppiamenti.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!admin.isAdminRoute) {
    return <PublicPage seasons={seasons} ready={ready} config={config} history={history} gameStates={lichess.gameStates} nameOf={nameOf} />;
  }

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
      {activeTab === 'round' && (
        <RoundTab
          view={roundView}
          setView={(v) => {
            setNotice(null);
            setRoundView(v);
          }}
          pairings={
            <PairingsTab
              config={config}
              history={history}
              settings={settings}
              templates={tpl}
              round={round}
              setRound={setRound}
              pairs={pairs}
              setPairs={setPairs}
              emptyPairs={emptyPairs}
              nameOf={nameOf}
              notice={notice}
              setNotice={setNotice}
              flash={flash}
              onMissingToken={() => setActiveTab('tournament')}
            />
          }
          status={
            <StatusTab
              history={history}
              setHistory={setHistory}
              config={config}
              triggerToast={triggerToast}
            />
          }
        />
      )}

      {activeTab === 'calendar' && (
        <>
          <Notice notice={notice} />
          <CalendarTab
            players={config.players}
            schedule={config.schedule}
            history={history}
            setHistory={setHistory}
            onUpdateSchedule={updateSchedule}
            onLoadIntoActivePairs={handleLoadRoundIntoPairs}
            flash={flash}
          />
        </>
      )}

      {activeTab === 'reviews' && (
        <ReviewsTab history={history} config={config} nameOf={nameOf} triggerToast={triggerToast} organizer={organizer} />
      )}

      {activeTab === 'tournament' && (
        <>
          <Notice notice={notice} />
          <TournamentTab
            config={config}
            settings={settings}
            setSettings={organizer.setSettings}
            templates={tpl}
            setTemplates={organizer.setTemplates}
            history={history}
            setHistory={setHistory}
            setRound={setRound}
            setPairs={setPairs}
            gameStates={lichess.gameStates}
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

export default App;
