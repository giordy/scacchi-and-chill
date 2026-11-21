// The site's translations for the Node scripts of the workflows (push notifications): the same
// files as the site, read by Node directly (it strips the TypeScript types by itself, Node 22.18+).
import { createTranslator } from '../src/i18n/core.ts';
import { isLocale, REFERENCE_LOCALE } from '../src/i18n/locales.ts';

const catalogs = new Map();

async function load(code) {
  if (catalogs.has(code)) return;
  const mod = await import(`../src/i18n/messages/${code}.ts`);
  catalogs.set(code, Object.values(mod).find((v) => v && typeof v === 'object') ?? {});
}

// The translator of a language, English for an unknown one
export async function scriptTranslator(code) {
  const locale = isLocale(code) ? code : REFERENCE_LOCALE;
  await load(REFERENCE_LOCALE);
  await load(locale);
  return createTranslator(locale, (c) => catalogs.get(c));
}
