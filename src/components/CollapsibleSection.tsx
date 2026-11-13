import React from 'react';

// Native <details> wrapper: keyboard accessible and collapsible without extra state
export function CollapsibleSection({
  title,
  defaultOpen = false,
  id,
  children,
}: {
  title: string;
  id?: string; // to be opened from elsewhere (the season checklist): see openSection
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="settings-section" open={defaultOpen} id={id ? `sez-${id}` : undefined}>
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

// Opens a section by its id and brings it into view, once its tab is shown
export function openSection(id: string) {
  const el = document.getElementById(`sez-${id}`);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
