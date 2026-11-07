import React from 'react';

// ▲ = ▼: how something moved, with the words for screen readers
export type TrendKind = 'up' | 'same' | 'down';
const TREND_MARK: Record<TrendKind, string> = { up: '▲', same: '=', down: '▼' };

export function Trend({ kind, label }: { kind: TrendKind; label: string }) {
  return (
    <span className={`trend trend-${kind}`} role="img" aria-label={label} title={label}>
      {TREND_MARK[kind]}
    </span>
  );
}
