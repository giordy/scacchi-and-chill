import React from 'react';

interface AdminLoginProps {
  error: string;
  isSigningIn: boolean;
  onLogin: () => void;
}

export function AdminLogin({ error, isSigningIn, onLogin }: AdminLoginProps) {
  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)" }}>
            Accesso Riservato
          </span>
          <h1 style={{ margin: "2px 0 0", fontSize: 22 }}>🔒 Area Organizzatore</h1>
        </div>
        <a
          href="#"
          className="secondary"
          style={{
            fontSize: 12,
            padding: "6px 12px",
            borderRadius: 8,
            textDecoration: "none",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          ← Torna al Torneo
        </a>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, maxWidth: 440, margin: "20px auto" }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Accedi con Google</h2>
        <p className="note" style={{ margin: "0 0 16px" }}>
          La gestione del torneo è riservata all'organizzatore. Accedi con l'account Google autorizzato.
        </p>

        {error && (
          <div className="notice err" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          className="primary"
          type="button"
          onClick={onLogin}
          disabled={isSigningIn}
          style={{ width: "100%", minHeight: 48 }}
        >
          {isSigningIn ? "Accesso in corso…" : "Accedi con Google 🔓"}
        </button>
      </div>
    </main>
  );
}
