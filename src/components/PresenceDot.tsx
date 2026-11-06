import React from 'react';
import { InfoTip } from './InfoTip';
import { agoLabel, presenceOf } from '../lib/presence';

const Dot = ({ seenAt, now }: { seenAt: number; now: number }) => (
  <span className={`presence-dot is-${presenceOf(seenAt, now)}`} aria-hidden="true" />
);

// Ongoing games: a green, yellow or grey dot after the name, for when the player was last on
// Lichess. The time opens with a tap (or on hover), since colour alone does not say it to everyone.
// Nothing without a seenAt.
export function PresenceDot({ seenAt, now, name }: { seenAt?: number; now: number; name: string }) {
  if (!seenAt) return null;
  return (
    <InfoTip
      className="presence-trigger"
      text={`${name}: ultimo accesso a Lichess ${agoLabel(seenAt, now)}. Non vuol dire che abbia già mosso in questa partita: Lichess mostra le ultime mosse in ritardo.`}
    >
      <Dot seenAt={seenAt} now={now} />
      <span className="sr-only">Ultimo accesso a Lichess: {agoLabel(seenAt, now)}</span>
    </InfoTip>
  );
}

// Player page: the dot with the time written next to it
export function PresenceLine({ seenAt, now }: { seenAt?: number; now: number }) {
  if (!seenAt) return null;
  return (
    <p className="presence-line">
      <Dot seenAt={seenAt} now={now} />
      Ultimo accesso a Lichess: {agoLabel(seenAt, now)}
    </p>
  );
}
