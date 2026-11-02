import React from 'react';

// Native <details> wrapper: keyboard accessible and collapsible without extra state
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="settings-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}
