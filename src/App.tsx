import React, { useState, useRef } from 'react';
import {
  AppConfig,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
  TournamentMeta,
} from './types';
import { defaultConfig, initialStoredSettings } from './lib/config';
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
import { SettingsTab } from './tabs/SettingsTab';
import { StatusTab } from './tabs/StatusTab';
import { ReviewsTab } from './ReviewsTab';
import { PublicPage } from './views/PublicPage';
import { AdminLogin } from './views/AdminLogin';
import { AdminConsole, AdminTab } from './views/AdminConsole';
import { saveTournamentMetaToFirebase, saveTournamentFullToFirebase } from './firebaseService';

export function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const admin = useAdminAuth();

  const [activeTab, setActiveTab] = usePersistentState<AdminTab>('pairings.adminActiveTab', 'pairings');

  const gameCount = Math.floor(config.players.length / 2);
  const emptyPairs = (): GamePair[] =>
    Array.from({ length: gameCount }, () => ({ white: "", black: "", url: "" }));

  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;

  const [round, setRound] = usePersistentState<string>("pairings.round", "1");
  const [history, setHistory] = usePersistentState<HistoryGame[]>("pairings.history", [], Array.isArray);
  const [pairs, setPairs] = usePersistentState<GamePair[]>(
    "pairings.pairs.v2",
    emptyPairs,
    (v) => Array.isArray(v) && v.length === gameCount
  );
  const [storedSettings, setSettings] = usePersistentState<Partial<Settings>>(
    "pairings.settings.v3",
    initialStoredSettings
  );
  const [templates, setTemplates] = usePersistentState<Partial<MessageTemplates> | null>(
    "pairings.templates.v2",
    null
  );

  const defaultSettings: Settings = {
    token: "",
    days: config.defaults.days,
    expiry: config.defaults.expiry,
    rated: config.defaults.rated,
    rules: config.defaults.rules,
  };
  const settings: Settings = {
    ...defaultSettings,
    ...storedSettings,
    rules: { ...defaultSettings.rules, ...(storedSettings.rules ?? {}) },
  };
  const tpl: MessageTemplates = { ...config.messageTemplates, ...(templates ?? {}) };

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const settingsTabRef = useRef<HTMLDivElement>(null);

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

  const organizer = useOrganizerData(admin.isAdminRoute && admin.isAuthenticated, (msg) => flash('err', msg));
  const { ready } = useTournamentSync(setConfig, setHistory, !admin.isAdminRoute);
  const seasons = useSeasons();
  const lichess = useLichessSync(history, setHistory, flash);

  const handleLoadRoundIntoPairs = (loadedRound: string, loadedGames: HistoryGame[]) => {
    const newPairs = emptyPairs();
    loadedGames.forEach((g, idx) => {
      if (idx < newPairs.length) {
        newPairs[idx] = { white: g.white, black: g.black, url: g.url };
      }
    });
    setRound(loadedRound);
    setPairs(newPairs);
    setActiveTab('pairings');
    flash("ok", `Turno ${loadedRound} caricato nella scheda Partite.`);
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
      email={admin.email}
      onLogout={admin.logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isSyncing={lichess.isSyncing}
      lastSyncTime={lichess.lastSyncTime}
      onSync={lichess.sync}
      toastMessage={toastMessage}
    >
      {activeTab === 'pairings' && (
        <PairingsTab
          config={config}
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
          onMissingToken={() => setActiveTab('settings')}
        />
      )}

      {activeTab === 'status' && (
        <StatusTab
          history={history}
          setHistory={setHistory}
          defaultDays={settings.days}
          config={config}
          onLoadIntoActivePairs={handleLoadRoundIntoPairs}
          triggerToast={triggerToast}
        />
      )}

      {activeTab === 'reviews' && (
        <ReviewsTab history={history} config={config} nameOf={nameOf} triggerToast={triggerToast} organizer={organizer} />
      )}

      {activeTab === 'settings' && (
        <section>
          <h2>Impostazioni e Regole</h2>
          <Notice notice={notice} />
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            templates={tpl}
            setTemplates={setTemplates}
            history={history}
            setHistory={setHistory}
            setRound={setRound}
            setPairs={setPairs}
            flash={flash}
            organizer={organizer}
            gameStates={lichess.gameStates}
            seasons={seasons}
            panelRef={settingsTabRef}
            config={config}
            onUpdateTournamentMeta={(patch) => {
              const updatedMeta: TournamentMeta = mergeTournamentMeta(config.tournament, patch);
              setConfig((prev) => ({ ...prev, tournament: updatedMeta }));
              saveTournamentMetaToFirebase(updatedMeta).catch((e) =>
                console.warn("Salvataggio metadati su Firestore fallito:", e)
              );
            }}
            onUpdatePlayers={(updatedPlayers) => {
              setConfig((prev) => ({ ...prev, players: updatedPlayers }));
              saveTournamentFullToFirebase({ players: updatedPlayers }).catch((e) =>
                console.warn("Salvataggio giocatori su Firestore fallito:", e)
              );
            }}
            onUpdateSchedule={(updatedSchedule) => {
              setConfig((prev) => ({ ...prev, schedule: updatedSchedule }));
              saveTournamentFullToFirebase({ schedule: updatedSchedule }).catch((e) =>
                console.warn("Salvataggio calendario su Firestore fallito:", e)
              );
            }}
          />
        </section>
      )}
    </AdminConsole>
  );
}

export default App;
