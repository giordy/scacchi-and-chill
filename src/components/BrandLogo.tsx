import React from 'react';
import logoUrl from '../assets/logo.webp';

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon)
export function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={`brand-logo ${className}`.trim()} src={logoUrl} alt="" width={360} height={322} />;
}
