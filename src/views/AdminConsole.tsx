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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)", letterSpacing: 0.5 }}>
            🔒 Area Organizzatore · {email}
          </span>
          <h1 style={{ margin: "2px 0 0", fontSize: 22 }}>Gestione Torneo</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <a
            href="#"
            className="secondary"
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            👁️ Vista Pubblica
          </a>
          <button
            type="button"
            className="secondary"
            onClick={onLogout}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--danger)",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Esci dalla sessione amministratore"
          >
            Esci 🚪
          </button>
        </div>
      </div>
      <p className="sub">Crea gli accoppiamenti, genera le sfide su Lichess e gestisci il torneo.</p>
      <div className="strip" aria-hidden="true" />

      {/* Results sync: Lichess → Firestore (the public view reads from there) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="secondary"
          onClick={onSync}
          disabled={isSyncing}
          style={{ minHeight: 40, fontWeight: 600 }}
        >
          {isSyncing ? "Sincronizzazione…" : "🔄 Sincronizza risultati"}
        </button>
        <span className="note" style={{ margin: 0, fontSize: 12 }}>
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
