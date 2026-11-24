import React, { useState } from 'react';
import { Toast } from '../WhatsAppPreview';
import { onTabListKeyDown } from '../lib/tabKeys';
import type { SyncHealth } from '../lib/syncHealth';
import { AutoSyncNote } from '../components/AutoSyncStatus';
import { AlertsBell } from '../components/AdminAlerts';
import type { AdminAlert } from '../lib/adminAlerts';

export type AdminTab = 'rounds' | 'whatsapp' | 'players' | 'seasons' | 'settings';

export const ADMIN_TABS: { key: AdminTab; icon: string; label: string }[] = [
  { key: 'rounds', icon: '♞', label: 'Turni' },
  { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
  { key: 'players', icon: '♟', label: 'Giocatori' },
  { key: 'seasons', icon: '♛', label: 'Stagioni' },
  { key: 'settings', icon: '⚙', label: 'Impostazioni' },
];

export const isAdminTab = (v: unknown): v is AdminTab => ADMIN_TABS.some((t) => t.key === v);

interface AdminConsoleProps {
  title: string;
  email: string;
  onLogout: () => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isSyncing: boolean;
  lastSyncTime: string | null;
  onSync: () => void;
  // The automatic sync (GitHub Action), lib/syncHealth.ts; null until read
  syncHealth?: SyncHealth | null;
  // The organizer's alerts (lib/adminAlerts.ts): the bell in the header, the list it opens
  alerts?: AdminAlert[];
  alertsPanel?: (close: () => void) => React.ReactNode;
  toastMessage: string | null;
  children: React.ReactNode;
}

// Organizer console: header, results sync and tab navigation. The tab content is passed as children.
export function AdminConsole({
  title,
  email,
  onLogout,
  activeTab,
  setActiveTab,
  isSyncing,
  lastSyncTime,
  onSync,
  syncHealth = null,
  alerts = [],
  alertsPanel,
  toastMessage,
  children,
}: AdminConsoleProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  return (
    <main className="admin">
      <header className="admin-header">
        <div className="admin-identity">
          <span className="eyebrow">Area organizzatore</span>
          <h1 className="view-title">{title}</h1>
        </div>
        <div className="header-actions">
          {alertsPanel && <AlertsBell alerts={alerts} open={alertsOpen} onToggle={() => setAlertsOpen((o) => !o)} />}
          <a href="#" className="chip-link">Vista pubblica</a>
          <button type="button" className="chip-link is-danger" onClick={onLogout} title={`Esci (${email})`}>
            Esci
          </button>
        </div>
      </header>

      {alertsOpen && alertsPanel?.(() => setAlertsOpen(false))}

      {/* Results sync: Lichess → Firestore (the public view reads from there) */}
      <div className="sync-bar">
        <button type="button" className="secondary sync-btn" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? "Sincronizzazione…" : "↻ Sincronizza risultati"}
        </button>
        <span className="note sync-note">
          {lastSyncTime ? `Ultima alle ${lastSyncTime}` : "Porta i risultati Lichess sulla pagina pubblica"}
        </span>
        <AutoSyncNote health={syncHealth} />
      </div>

      <nav className="tabs" role="tablist" aria-label="Sezioni" onKeyDown={onTabListKeyDown}>
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            role="tab"
            id={`admin-tab-${t.key}`}
            aria-selected={activeTab === t.key}
            tabIndex={activeTab === t.key ? 0 : -1}
            aria-controls="admin-panel"
            onClick={() => setActiveTab(t.key)}
          >
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${activeTab}`}>
        {children}
      </div>

      <Toast message={toastMessage || ""} isVisible={Boolean(toastMessage)} />
    </main>
  );
}
