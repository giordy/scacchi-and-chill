// The translation machinery, with no dependency on Vite or the browser: used by the site (through
// index.ts) and by the Node scripts of the workflows (scripts/i18n.mjs, push notifications).
// Imports carry their .ts extension, so Node can run this file as it is.
import { intlLocale, REFERENCE_LOCALE, type Locale } from './locales.ts';
import type { Leaf, MessageTree, Params, PathsOf, Plural, Variants } from './types.ts';
import type { en } from './messages/en.ts';

type Reference = typeof en;
// Keys by kind of leaf, for the type checker: t() takes texts and plurals, tList() lists of variants
export type TextKey = PathsOf<Reference, string>;
export type PluralKey = PathsOf<Reference, { other: string }>;
export type ListKey = PathsOf<Reference, readonly string[]>;
export type MessageKey = TextKey | PluralKey;

export type Catalog = object;
// The translation file of a language, if it is loaded
export type CatalogOf = (code: Locale) => Catalog | undefined;

export interface Translator {
  locale: Locale;
  intl: string; // the Intl locale ("it-IT")
  t: (key: MessageKey, params?: Params) => string;
  tList: (key: ListKey) => Variants;
  // A sentence whose params are not all text (a player link, a bold name): the pieces in order
  tParts: <T>(key: MessageKey, params: Record<string, string | number | T>) => Array<string | T>;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatList: (items: string[], options?: Intl.ListFormatOptions) => string;
  compare: (a: string, b: string) => number;
}

function lookup(catalog: Catalog | undefined, key: string): Leaf | MessageTree | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node as Leaf | MessageTree | undefined;
}

export const isPlural = (v: unknown): v is Plural =>
  !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Plural).other === 'string';

// "{name} wins" + { name: "Anna" } -> "Anna wins". A placeholder without a value stays as it is,
// so a mistake shows instead of disappearing.
export function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
}

const pluralRules = new Map<string, Intl.PluralRules>();
export function pluralForm(intl: string, plural: Plural, count: number): string {
  const exact = plural[`=${count}`];
  if (typeof exact === 'string') return exact;
  let rules = pluralRules.get(intl);
  if (!rules) pluralRules.set(intl, (rules = new Intl.PluralRules(intl)));
  const form = plural[rules.select(count) as keyof Plural];
  return typeof form === 'string' ? form : plural.other;
}

export function createTranslator(code: Locale, catalogOf: CatalogOf): Translator {
  const intl = intlLocale(code);
  const chain = code === REFERENCE_LOCALE ? [code] : [code, REFERENCE_LOCALE];
  const resolve = (key: string): Leaf | undefined => {
    for (const c of chain) {
      const v = lookup(catalogOf(c), key);
      if (typeof v === 'string' || Array.isArray(v) || isPlural(v)) return v as Leaf;
    }
    return undefined;
  };
  const text = (key: string, params?: Params): string => {
    const v = resolve(key);
    if (v === undefined) return key;
    if (typeof v === 'string') return fill(v, params);
    if (Array.isArray(v)) return fill(v[0] ?? '', params);
    const count = Number(params?.count);
    return fill(pluralForm(intl, v as Plural, Number.isFinite(count) ? count : 0), params);
  };
  return {
    locale: code,
    intl,
    t: text,
    tList: (key) => {
      const v = resolve(key);
      return Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
    },
    tParts: <T,>(key: MessageKey, params: Record<string, string | number | T>) => {
      // Text params are filled first; the others split the sentence around their placeholder
      const textParams: Params = {};
      Object.entries(params).forEach(([k, v]) => {
        if (typeof v === 'string' || typeof v === 'number') textParams[k] = v;
      });
      const sentence = text(key, textParams);
      const parts: Array<string | T> = [];
      let last = 0;
      for (const m of sentence.matchAll(/\{(\w+)\}/g)) {
        if (!(m[1] in params)) continue;
        if (m.index! > last) parts.push(sentence.slice(last, m.index));
        parts.push(params[m[1]] as T);
        last = m.index! + m[0].length;
      }
      if (last < sentence.length) parts.push(sentence.slice(last));
      return parts;
    },
    formatNumber: (n, options) => n.toLocaleString(intl, options),
    formatDate: (date, options) => new Date(date).toLocaleDateString(intl, options),
    formatTime: (date, options) => new Date(date).toLocaleTimeString(intl, options),
    formatDateTime: (date, options) => new Date(date).toLocaleString(intl, options),
    formatList: (items, options) => new Intl.ListFormat(intl, { style: 'long', type: 'conjunction', ...options }).format(items),
    compare: (a, b) => a.localeCompare(b, intl),
  };
}
