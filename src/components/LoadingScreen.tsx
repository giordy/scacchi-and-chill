import React from 'react';

// Full-page placeholder shown while data or authentication state is loading
export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}
