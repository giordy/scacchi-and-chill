import React from 'react';
import { podiumPlace } from '../lib/standings';

// The place in a standings table: shared by tied players (two 2nd places, then a 4th), gold,
// silver and bronze on the podium (unless medals is false), a dash before the first game
export function RankCell({ rank, points, tied, medals = true }: { rank: number | null; points: number; tied: boolean; medals?: boolean }) {
  if (rank === null) {
    return (
      <span className="rank" aria-label="Nessuna posizione: la stagione non è ancora cominciata">
        –
      </span>
    );
  }
  const medal = medals ? podiumPlace(rank, points) : undefined;
  return (
    <span
      className={`rank${medal ? ` podium-${medal}` : ''}`}
      title={tied ? `${rank}° posto a pari merito` : undefined}
      aria-label={tied ? `${rank}° a pari merito` : `${rank}°`}
    >
      {rank}
    </span>
  );
}
