import React from 'react';
import { Toast } from '../WhatsAppPreview';

export type AdminTab = 'pairings' | 'status' | 'reviews' | 'settings';

const TABS: { key: AdminTab; icon: string; label: string }[] = [
  { key: 'pairings', icon: '♟️', label: 'Partite' },
  { key: 'status', icon: '📊', label: 'Stato' },
  { key: 'reviews', icon: '✨', label: 'Recensione' },
  { key: 'settings', icon: '⚙️', label: 'Opzioni' },
];

interface AdminConsoleProps {
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

// Organizer console: header, results sync button and tab navigation. The tab content is passed as children.
export function AdminConsole({
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
    <main>
      <div className="view-header tight">
        <div>
          <span className="eyebrow">
            🔒 Area Organizzatore · {email}
          </span>
          <h1 className="view-title">Gestione Torneo</h1>
        </div>
        <div className="header-actions">
          <a
            href="#"
            className="chip-link"
          >
            👁️ Vista Pubblica
          </a>
          <button
            type="button"
            className="chip-link is-danger"
            onClick={onLogout}
            title="Esci dalla sessione amministratore"
          >
            Esci 🚪
          </button>
        </div>
      </div>
      <p className="sub">Crea gli accoppiamenti, genera le sfide su Lichess e gestisci il torneo.</p>
      <div className="strip" aria-hidden="true" />

      {/* Results sync: Lichess → Firestore (the public view reads from there) */}
      <div className="sync-bar">
        <button
          type="button"
          className="secondary sync-btn"
          onClick={onSync}
          disabled={isSyncing}
        >
          {isSyncing ? "Sincronizzazione…" : "🔄 Sincronizza risultati"}
        </button>
        <span className="note sync-note">
          {lastSyncTime
            ? `Ultima sincronizzazione alle ${lastSyncTime}`
            : "Aggiorna i risultati visibili al pubblico"}
        </span>
      </div>

      <nav className="tabs" role="tablist" aria-label="Navigazione sezioni">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            role="tab"
            id={`admin-tab-${t.key}`}
            aria-selected={activeTab === t.key}
            aria-controls="admin-panel"
            onClick={() => setActiveTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
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
