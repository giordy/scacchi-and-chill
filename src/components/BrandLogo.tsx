import React from 'react';
import logoUrl from '../assets/logo.webp';
import christmasLogoUrl from '../assets/logo-christmas.webp';
import halloweenLogoUrl from '../assets/logo-halloween.webp';
import easterLogoUrl from '../assets/logo-easter.webp';
import crownLogoUrl from '../assets/logo-crown.webp';
import carnivalLogoUrl from '../assets/logo-carnival.webp';
import { Holiday, holiday } from '../lib/holiday';

// Holiday versions: the same art with something on the head, so they are a little taller
const LOGOS: Record<NonNullable<Holiday>, { src: string; height: number }> = {
  christmas: { src: christmasLogoUrl, height: 338 },
  carnival: { src: carnivalLogoUrl, height: 345 },
  easter: { src: easterLogoUrl, height: 353 },
  'chess-day': { src: crownLogoUrl, height: 337 },
  halloween: { src: halloweenLogoUrl, height: 355 },
  'season-end': { src: crownLogoUrl, height: 337 },
};

// The tournament mascot: the knight relaxing on a bean bag with a cup (same art as the app icon),
// dressed up for the holidays (Santa hat, carnival mask, bunny ears, crown, witch hat)
export function BrandLogo({ className = '' }: { className?: string }) {
  const { src, height } = (holiday && LOGOS[holiday]) || { src: logoUrl, height: 322 };
  return <img className={`brand-logo ${className}`.trim()} src={src} alt="" width={360} height={height} />;
}
