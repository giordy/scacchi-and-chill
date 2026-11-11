import React from 'react';
import { BrandLogo } from './BrandLogo';

// Full-page placeholder shown while data or authentication state is loading:
// the logo gently breathing, as a continuation of the installed app's splash screen
export function LoadingScreen({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <BrandLogo className="is-loading" />
      <p>{label}</p>
      {children}
    </main>
  );
}
