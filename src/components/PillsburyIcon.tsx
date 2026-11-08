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

export type PillsburyIconVariant = 'arrow' | 'medal';

export function PillsburyIcon({ variant = 'arrow', size = 20 }: { variant?: PillsburyIconVariant; size?: number }) {
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
