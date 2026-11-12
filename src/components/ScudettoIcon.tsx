// The scudetto of a season: a gold shield, the badge sewn on the champions' shirt, with the initial
// of the season's master on his colour, or a Staunty knight for the Scudetto Chill (see lib/scudetto.ts).
// Sized in em, so it follows the font size of where it stands, as an emoji.
import React, { useId } from 'react';
import { Scudetto } from '../lib/scudetto';
import { StauntonPiece } from './StauntonPiece';

export function ScudettoIcon({ scudetto, size = '1em' }: { scudetto: Scudetto; size?: string | number }) {
  const gold = `scudetto-gold-${useId().replace(/:/g, '')}`;
  return (
    <svg className="scudetto-icon" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc95" />
          <stop offset="0.45" stopColor="#c99a3c" />
          <stop offset="0.7" stopColor="#e9c977" />
          <stop offset="1" stopColor="#9c7124" />
        </linearGradient>
      </defs>
      <path d="M20 1.5 L36 6.3 V19.5 C36 29.3 29 35.4 20 39.5 C11 35.4 4 29.3 4 19.5 V6.3 Z" fill={`url(#${gold})`} />
      <path d="M20 4.7 L32.8 8.5 V19.5 C32.8 27.6 27.2 32.8 20 36.2 C12.8 32.8 7.2 27.6 7.2 19.5 V8.5 Z" fill={scudetto.color} />
      <path d="M20 4.7 L32.8 8.5 V12.5 H7.2 V8.5 Z" fill="#fff" opacity="0.12" />
      {scudetto.letter ? (
        <text x="20" y="27.5" textAnchor="middle" fontSize="18" fontWeight="800" fill={`url(#${gold})`} fontFamily="var(--font-display)">
          {scudetto.letter}
        </text>
      ) : (
        <StauntonPiece piece="N" x={9.5} y={9} size={21} />
      )}
    </svg>
  );
}
