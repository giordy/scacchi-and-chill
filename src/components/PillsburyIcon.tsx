// The Trofeo Pillsbury: a medal with a white pawn, hanging from two ribbons in the site's green.
// Flat shapes drawn to be read at 20 px, where only the outline (the ribbons in a V above the
// disc) says "medal". Sized in em, so it follows the font size of where it stands, as an emoji.
// In text (the WhatsApp message, tooltips) the trophy is PILLSBURY_EMOJI instead.
import React from 'react';

export function PillsburyIcon({ size = '1.3em' }: { size?: string | number }) {
  return (
    <svg className="pillsbury-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.6 0.8h5.2l4.4 9.4H8z" style={{ fill: 'var(--accent)' }} />
      <path d="M15.2 0.8h5.2L16 10.2h-5.2z" style={{ fill: 'color-mix(in srgb, var(--accent) 75%, #000)' }} />
      <circle cx="12" cy="15.4" r="8" style={{ fill: 'color-mix(in srgb, var(--brass) 62%, #000)' }} />
      <circle cx="12" cy="15.4" r="6.6" style={{ fill: 'var(--brass)' }} />
      <g transform="translate(12 15.6)" fill="#fff">
        <circle cx="0" cy="-2.6" r="1.75" />
        <path d="M-1.35 -0.9h2.7l1.2 3.9h-5.1z" />
        <rect x="-2.75" y="3.2" width="5.5" height="1.45" rx="0.45" />
      </g>
    </svg>
  );
}
