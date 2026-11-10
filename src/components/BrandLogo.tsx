import React from 'react';
import logoUrl from '../assets/logo.webp';
import christmasLogoUrl from '../assets/logo-christmas.webp';
import halloweenLogoUrl from '../assets/logo-halloween.webp';
import easterLogoUrl from '../assets/logo-easter.webp';
import chessDayLogoUrl from '../assets/logo-chess-day.webp';
import carnivalLogoUrl from '../assets/logo-carnival.webp';
import seasonEndLogoUrl from '../assets/logo-season-end.webp';
import { Holiday, holiday } from '../lib/holiday';

// Holiday versions: the same art with something on the head (a little taller) or a medal
const LOGOS: Record<NonNullable<Holiday>, { src: string; height: number }> = {
  christmas: { src: christmasLogoUrl, height: 338 },
  carnival: { src: carnivalLogoUrl, height: 345 },
  easter: { src: easterLogoUrl, height: 353 },
  'chess-day': { src: chessDayLogoUrl, height: 337 },
  halloween: { src: halloweenLogoUrl, height: 355 },
  'season-end': { src: seasonEndLogoUrl, height: 322 },
};

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon),
// dressed up for the holidays (Santa hat, carnival mask, bunny ears, crown, witch hat, medal)
export function BrandLogo({ className = '' }: { className?: string }) {
  const { src, height } = (holiday && LOGOS[holiday]) || { src: logoUrl, height: 322 };
  return <img className={`brand-logo ${className}`.trim()} src={src} alt="" width={360} height={height} />;
}
