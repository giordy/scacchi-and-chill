import React from 'react';
import { Toast } from '../WhatsAppPreview';
import { onTabListKeyDown } from '../lib/tabKeys';

export type AdminTab = 'round' | 'calendar' | 'reviews' | 'tournament';

export const ADMIN_TABS: { key: AdminTab; icon: string; label: string }[] = [
  { key: 'round', icon: '♞', label: 'Turno' },
  { key: 'calendar', icon: '▦', label: 'Calendario' },
  { key: 'reviews', icon: '✎', label: 'Recensione' },
  { key: 'tournament', icon: '♛', label: 'Torneo' },
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
  toastMessage,
  children,
}: AdminConsoleProps) {
  return (
    <main className="admin">
      <header className="admin-header">
        <div className="admin-identity">
          <span className="eyebrow">Area organizzatore</span>
          <h1 className="view-title">{title}</h1>
        </div>
        <div className="header-actions">
          <a href="#" className="chip-link">Vista pubblica</a>
          <button type="button" className="chip-link is-danger" onClick={onLogout} title={`Esci (${email})`}>
            Esci
          </button>
        </div>
      </header>

      {/* Results sync: Lichess → Firestore (the public view reads from there) */}
      <div className="sync-bar">
        <button type="button" className="secondary sync-btn" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? "Sincronizzazione…" : "↻ Sincronizza risultati"}
        </button>
        <span className="note sync-note">
          {lastSyncTime ? `Ultima alle ${lastSyncTime}` : "Porta i risultati Lichess sulla pagina pubblica"}
        </span>
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
