// The Trofeo Pillsbury: a pawn going up, as a pawn that promotes beyond its rank. The pawn is the
// "Staunty" one by sadsnake1 (see pieces/staunty/LICENSE.md, CC BY-NC-SA 4.0), here with an arrow
// added: an adaptation under the same licence.
import React from 'react';

// The white pawn of pieces/staunty/wP.svg
const pawn = (stroke: number) => (
  <>
    <path fill="#f0f0f0" stroke="#3c3c3c" strokeLinejoin="round" strokeWidth={stroke} d="M21.503 27.594h6.994M19 17.508a6.35 6.35 0 0 0 1.966 4.587l-3.65 2.1.43 3.399h4.306c-.794 3.559-2.755 7.33-5.062 8.617s-5.3 3.097-4.843 8.189h25.706c.457-5.092-2.535-6.902-4.842-8.189-2.307-1.286-4.268-5.058-5.062-8.617h4.306l.43-3.4-3.65-2.099a6.352 6.352 0 0 0 1.966-4.587c0-3.367-2.628-5.912-6-5.912-3.373 0-6.002 2.545-6.001 5.912z" />
    <path d="M24.962 11.537c1.17-.459 9.527 5.906.647 10.773l4.512 2.1-.562 3.125h2.659l.428-3.399-3.65-2.1c1.253-1.2 1.962-2.58 1.964-4.312-.468-5.416-5.998-6.186-5.998-6.186zm-2.949 15.998c4.503 7.934 9.47 9.994 13.074 9.965l-2.115-1.347c-2.075-1.49-4.732-4.858-5.062-8.618z" opacity=".15" />
  </>
);

export type PillsburyIconVariant = 'arrow' | 'medal' | 'ribbon' | 'cup';

export function PillsburyIcon({ variant = 'arrow', size = 20 }: { variant?: PillsburyIconVariant; size?: number }) {
  // Flat shapes drawn for 20 px: what makes a medal or a cup is its outline, not its details
  const brass = { fill: 'var(--brass)' };
  const deep = { fill: 'color-mix(in srgb, var(--brass) 62%, #000)' };
  // A plain white pawn: head, body, base
  const flatPawn = (x: number, y: number, k: number) => (
    <g transform={`translate(${x} ${y}) scale(${k})`} fill="#fff">
      <circle cx="0" cy="-2.6" r="1.75" />
      <path d="M-1.35 -0.9h2.7l1.2 3.9h-5.1z" />
      <rect x="-2.75" y="3.2" width="5.5" height="1.45" rx="0.45" />
    </g>
  );
  if (variant === 'ribbon') {
    // A medal: two ribbon tails in a V above a brass disc with the pawn
    return (
      <svg className="pillsbury-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3.6 0.8h5.2l4.4 9.4H8z" style={{ fill: 'var(--accent)' }} />
        <path d="M15.2 0.8h5.2L16 10.2h-5.2z" style={{ fill: 'color-mix(in srgb, var(--accent) 75%, #000)' }} />
        <circle cx="12" cy="15.4" r="8" style={deep} />
        <circle cx="12" cy="15.4" r="6.6" style={brass} />
        {flatPawn(12, 15.6, 1)}
      </svg>
    );
  }
  if (variant === 'cup') {
    // A cup with two handles on a base, the pawn on its front
    return (
      <svg className="pillsbury-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 4.2H3.4a3.2 3.2 0 0 0 3.6 5.6M18 4.2h2.6a3.2 3.2 0 0 1-3.6 5.6" fill="none" style={{ stroke: 'var(--brass)' }} strokeWidth="1.9" strokeLinecap="round" />
        <path d="M5.4 1.2h13.2v6.2a6.6 6.6 0 0 1-13.2 0z" style={brass} />
        <rect x="10.7" y="13.6" width="2.6" height="3.6" style={brass} />
        <rect x="7.2" y="17" width="9.6" height="2.4" rx="0.6" style={brass} />
        <rect x="5.8" y="19.4" width="12.4" height="3.4" rx="0.7" style={deep} />
        {flatPawn(12, 7.3, 0.82)}
      </svg>
    );
  }
  if (variant === 'medal') {
    // On a brass disc, the arrow in the colour of the page behind it
    return (
      <svg className="pillsbury-icon" width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" focusable="false">
        <circle cx="25" cy="25" r="24" fill="var(--brass)" />
        <g transform="translate(-3 -0.5) scale(1.02)">{pawn(2.2)}</g>
        <path d="M38.5 26V12m-5.5 5.5 5.5-6 5.5 6" fill="none" stroke="var(--panel, #fff)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // The pawn, and a brass arrow up beside its head
  return (
    <svg className="pillsbury-icon" width={size} height={size} viewBox="10 6 40 40" aria-hidden="true" focusable="false">
      {pawn(2.6)}
      <path d="M44 27V10m-5 5 5-5.5 5 5.5" fill="none" stroke="var(--brass)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
