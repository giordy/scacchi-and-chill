// Translations for the site: t(), plurals, rotating variants, and Intl formatting bound to a language.
//
// Two languages are in play (see docs/I18N.md):
// - the viewer's language (getLocale/setLocale): what the site shows to whoever is looking at it;
// - the tournament's language (getTournamentLocale/setTournamentLocale): what goes to the group
//   chat, to the AI prompts' answers and to the link preview, whoever prepares them.
// `t` and the format helpers follow the viewer's language; groupTranslator() gives the same
// functions in the tournament's language.
//
// No dependency: the public page stays light. English and the first tournament's language are in the
// bundle; the other languages are separate chunks, loaded by loadLocale() when chosen.
import { en } from './messages/en.ts';
import { it } from './messages/it.ts';
import { DEFAULT_LOCALE, detectLocale, isLocale, type Locale } from './locales.ts';
import { createTranslator, type Catalog, type ListKey, type MessageKey, type Translator } from './core.ts';
import type { Params } from './types.ts';

export * from './locales.ts';
export { fill } from './core.ts';
export type { Translator, MessageKey, TextKey, PluralKey, ListKey } from './core.ts';
export type { Messages } from './messages/en.ts';

const loaded = new Map<Locale, Catalog>([
  ['en', en],
  ['it', it],
]);

// The other languages, each its own chunk
const lazy = import.meta.glob<Record<string, Catalog>>(['./messages/*.ts', '!./messages/en.ts', '!./messages/it.ts']);

export const isLoaded = (code: Locale) => loaded.has(code);

export async function loadLocale(code: Locale): Promise<void> {
  if (loaded.has(code)) return;
  const load = lazy[`./messages/${code}.ts`];
  if (!load) throw new Error(`No translation file for "${code}"`);
  const mod = await load();
  loaded.set(code, Object.values(mod).find((v) => v && typeof v === 'object') ?? {});
}

const translators = new Map<Locale, Translator>();
export function translator(code: Locale): Translator {
  let tr = translators.get(code);
  if (!tr) translators.set(code, (tr = createTranslator(code, (c) => loaded.get(c))));
  return tr;
}

// ---- current languages ----

let current: Locale = DEFAULT_LOCALE;
let tournament: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export const getLocale = () => current;
export const getTournamentLocale = () => tournament;

// Switches the viewer's language. It must be loaded (loadLocale) unless it is one of the bundled
// ones; until it is, English shows.
export function setLocale(code: Locale): void {
  if (!isLocale(code)) return;
  current = code;
  if (typeof document !== 'undefined') document.documentElement.lang = code;
  listeners.forEach((l) => l());
}

export function setTournamentLocale(code: Locale): void {
  if (isLocale(code)) tournament = code;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The viewer's language
export const t = (key: MessageKey, params?: Params) => translator(current).t(key, params);
export const tList = (key: ListKey) => translator(current).tList(key);
export const tParts = <T,>(key: MessageKey, params: Record<string, string | number | T>) => translator(current).tParts(key, params);
export const formatNumber: Translator['formatNumber'] = (n, o) => translator(current).formatNumber(n, o);
export const formatDate: Translator['formatDate'] = (d, o) => translator(current).formatDate(d, o);
export const formatTime: Translator['formatTime'] = (d, o) => translator(current).formatTime(d, o);
export const formatDateTime: Translator['formatDateTime'] = (d, o) => translator(current).formatDateTime(d, o);
export const formatList: Translator['formatList'] = (i, o) => translator(current).formatList(i, o);
export const compareText: Translator['compare'] = (a, b) => translator(current).compare(a, b);

// The tournament's language, for what goes to the group
export const groupTranslator = () => translator(tournament);

// ---- the viewer's choice, kept in the browser ----

const STORAGE_KEY = 'locale';

export function savedLocale(): Locale | undefined {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function saveLocale(code: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // private window or blocked storage: the choice lasts until the page is closed
  }
}

// Chooses, loads and applies a language picked by the viewer
export async function chooseLocale(code: Locale): Promise<void> {
  await loadLocale(code);
  saveLocale(code);
  setLocale(code);
}

// At start: the viewer's language (saved choice, else the browser's, else the tournament's), loaded
// before the first render. If it cannot be loaded (offline, never downloaded) the tournament's shows.
export async function initLocale(browser: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [] : []): Promise<Locale> {
  const code = detectLocale(savedLocale(), browser, tournament);
  try {
    await loadLocale(code);
    setLocale(code);
  } catch {
    setLocale(tournament);
  }
  return current;
}
