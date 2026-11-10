import React from 'react';
import logoUrl from '../assets/logo.webp';
import christmasLogoUrl from '../assets/logo-christmas.webp';
import { holiday } from '../lib/holiday';

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon),
// with a Santa hat during the Christmas holidays
export function BrandLogo({ className = '' }: { className?: string }) {
  const xmas = holiday === 'christmas';
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={xmas ? christmasLogoUrl : logoUrl}
      alt=""
      width={360}
      height={xmas ? 338 : 322}
    />
  );
}
