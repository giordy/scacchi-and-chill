// The languages of the site. To add one: an entry here, a file in messages/ (see docs/I18N.md).
export const LOCALES = [
  { code: 'en', name: 'English', intl: 'en' },
  { code: 'it', name: 'Italiano', intl: 'it-IT' },
  { code: 'de', name: 'Deutsch', intl: 'de-DE' },
  { code: 'es', name: 'Español', intl: 'es-ES' },
  { code: 'fr', name: 'Français', intl: 'fr-FR' },
  { code: 'pt-BR', name: 'Português (Brasil)', intl: 'pt-BR' },
  { code: 'hi', name: 'हिन्दी', intl: 'hi-IN' },
  { code: 'zh-Hans', name: '简体中文', intl: 'zh-Hans-CN' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

// The reference language: every key exists in it, and it is the fallback for a missing translation
export const REFERENCE_LOCALE: Locale = 'en';

// The language of this tournament when nothing else says otherwise (until the instance
// configuration and the tournament document carry it)
export const DEFAULT_LOCALE: Locale = 'it';

export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.code === v);

export const intlLocale = (code: Locale): string => LOCALES.find((l) => l.code === code)!.intl;

// A browser language ("pt-PT", "zh-CN", "de") -> one of ours, or undefined
export function matchLocale(tag: string): Locale | undefined {
  const lower = tag.trim().toLowerCase();
  if (!lower) return undefined;
  const exact = LOCALES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  const [base, ...rest] = lower.split('-');
  // Traditional Chinese is not Simplified Chinese: better English than the wrong script
  if (base === 'zh') return rest.some((r) => r === 'hant' || r === 'tw' || r === 'hk' || r === 'mo') ? undefined : 'zh-Hans';
  if (base === 'pt') return 'pt-BR';
  return LOCALES.find((l) => l.code.toLowerCase() === base)?.code;
}

// The language to show: the viewer's choice, else the first browser language we have, else the
// tournament's
export function detectLocale(saved: unknown, browser: readonly string[], fallback: Locale): Locale {
  if (isLocale(saved)) return saved;
  for (const tag of browser) {
    const found = matchLocale(tag);
    if (found) return found;
  }
  return fallback;
}
