import React from 'react';
import { BrandLogo } from '../components/BrandLogo';

interface AdminLoginProps {
  error: string;
  isSigningIn: boolean;
  onLogin: () => void;
}

export function AdminLogin({ error, isSigningIn, onLogin }: AdminLoginProps) {
  return (
    <main>
      <div className="view-header">
        <div>
          <span className="eyebrow">
            Accesso Riservato
          </span>
          <h1 className="view-title">🔒 Area Organizzatore</h1>
        </div>
        <a
          href="#"
          className="chip-link"
        >
          ← Torna al Torneo
        </a>
      </div>

      <div className="login-card">
        <BrandLogo className="login-logo" />
        <h2 className="login-title">Accedi con Google</h2>
        <p className="note login-note">
          La gestione del torneo è riservata all'organizzatore. Accedi con l'account Google autorizzato.
        </p>

        {error && (
          <div className="notice err login-error">
            {error}
          </div>
        )}

        <button
          className="primary btn-block"
          type="button"
          onClick={onLogin}
          disabled={isSigningIn}
        >
          {isSigningIn ? "Accesso in corso…" : "Accedi con Google 🔓"}
        </button>
      </div>
    </main>
  );
}
