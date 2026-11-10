import React from 'react';
import logoUrl from '../assets/logo.webp';
import xmasLogoUrl from '../assets/logo-natale.webp';
import { festivity } from '../lib/festive';

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon),
// with a Santa hat during the Christmas holidays
export function BrandLogo({ className = '' }: { className?: string }) {
  const xmas = festivity === 'natale';
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={xmas ? xmasLogoUrl : logoUrl}
      alt=""
      width={360}
      height={xmas ? 338 : 322}
    />
  );
}
