import React from 'react';
import logoUrl from '../assets/logo.webp';
import christmasLogoUrl from '../assets/logo-christmas.webp';
import halloweenLogoUrl from '../assets/logo-halloween.webp';
import easterLogoUrl from '../assets/logo-easter.webp';
import { holiday } from '../lib/holiday';

// Holiday versions: the same art with a hat or a headband, so they are a little taller
const LOGOS = {
  christmas: { src: christmasLogoUrl, height: 338 },
  halloween: { src: halloweenLogoUrl, height: 355 },
  easter: { src: easterLogoUrl, height: 353 },
};

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon),
// dressed up for the holidays (Santa hat, witch hat, bunny ears)
export function BrandLogo({ className = '' }: { className?: string }) {
  const { src, height } = (holiday && LOGOS[holiday]) || { src: logoUrl, height: 322 };
  return <img className={`brand-logo ${className}`.trim()} src={src} alt="" width={360} height={height} />;
}
