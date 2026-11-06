import React from 'react';
import { InfoTip } from './InfoTip';
import { agoLabel, presenceOf } from '../lib/presence';

const Dot = ({ seenAt, now, className = '' }: { seenAt: number; now: number; className?: string }) => (
  <span className={`presence-dot is-${presenceOf(seenAt, now)} ${className}`} aria-hidden="true" />
);

const COLOR_LABEL = { w: 'Bianco', b: 'Nero' } as const;

// Ongoing games: the white or black disc before the name carries a small green, yellow or grey
// badge, like the online badge on an avatar, for when the player was last on Lichess. The time
// opens with a tap (or on hover), since colour alone does not say it to everyone. A plain disc
// without a seenAt.
export function ColorDot({ color, seenAt, now, name }: { color: 'w' | 'b'; seenAt?: number; now: number; name: string }) {
  if (!seenAt) return <span className={`dot ${color}`} aria-label={COLOR_LABEL[color]} />;
  const ago = agoLabel(seenAt, now);
  return (
    <InfoTip className="presence-trigger" text={`${name} · ultimo accesso a Lichess: ${ago}`}>
      <span className={`dot ${color}`} aria-hidden="true" />
      <Dot seenAt={seenAt} now={now} className="presence-badge" />
      <span className="sr-only">{COLOR_LABEL[color]}, ultimo accesso a Lichess {ago}</span>
    </InfoTip>
  );
}

// Player page: after "@handle su Lichess", on the same line
export function PresenceMeta({ seenAt, now }: { seenAt?: number; now: number }) {
  if (!seenAt) return null;
  return (
    <span className="presence-meta">
      <Dot seenAt={seenAt} now={now} />
      ultimo accesso {agoLabel(seenAt, now)}
    </span>
  );
}
