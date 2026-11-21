import { describe, expect, it } from 'vitest';
import { createTranslator, fill, isPlural } from '../core';
import { detectLocale, LOCALES, matchLocale, Locale } from '../locales';
import { getLocale, loadLocale, setLocale, t, translator } from '../index';
import { en } from '../messages/en';

const catalogs: Record<string, object> = {
  en: {
    games: { one: '{count} game', other: '{count} games', '=0': 'no games' },
    wins: '{winner} beats {loser}',
    header: ['First {round}', 'Second {round}'],
    onlyEnglish: 'Only in English',
  },
  it: {
    games: { one: '{count} partita', other: '{count} partite' },
    wins: '{winner} batte {loser}',
    header: ['Primo {round}'],
  },
};
const tr = (code: Locale) => createTranslator(code, (c) => catalogs[c]);

describe('translator', () => {
  it('fills params, leaving unknown placeholders visible', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(tr('it').t('wins' as any, { winner: 'Anna', loser: 'Bruno' })).toBe('Anna batte Bruno');
  });

  it('chooses the plural form of the language, with exact matches first', () => {
    expect(tr('en').t('games' as any, { count: 0 })).toBe('no games');
    expect(tr('en').t('games' as any, { count: 1 })).toBe('1 game');
    expect(tr('en').t('games' as any, { count: 2 })).toBe('2 games');
    expect(tr('it').t('games' as any, { count: 1 })).toBe('1 partita');
    expect(tr('it').t('games' as any, { count: 0 })).toBe('0 partite');
    // Chinese has only "other": the English plural object still resolves
    expect(createTranslator('zh-Hans', (c) => (c === 'zh-Hans' ? { games: { other: '{count} 局' } } : catalogs.en)).t('games' as any, { count: 1 })).toBe('1 局');
  });

  it('falls back to English, then to the key', () => {
    expect(tr('it').t('onlyEnglish' as any)).toBe('Only in English');
    expect(tr('it').t('nowhere.at.all' as any)).toBe('nowhere.at.all');
  });

  it('returns the variants of a list', () => {
    expect(tr('it').tList('header' as never)).toEqual(['Primo {round}']);
    expect(tr('en').tList('header' as never)).toHaveLength(2);
    expect(tr('en').t('header' as any, { round: 3 })).toBe('First 3');
  });

  it('splits a sentence around the params that are not text', () => {
    const link = { link: 'Anna' };
    expect(tr('it').tParts('wins' as any, { winner: link, loser: 'Bruno' })).toEqual([link, ' batte Bruno']);
  });

  it('formats with the language', () => {
    expect(tr('it').formatNumber(1.5, { maximumFractionDigits: 1 })).toBe('1,5');
    expect(tr('en').formatNumber(1.5)).toBe('1.5');
    expect(tr('it').formatList(['Anna', 'Bruno', 'Carla'])).toBe('Anna, Bruno e Carla');
    expect(tr('it').formatDate(Date.UTC(2026, 10, 21, 12), { day: 'numeric', month: 'long', timeZone: 'UTC' })).toBe('21 novembre');
  });
});

describe('languages', () => {
  it('matches browser languages to ours', () => {
    expect(matchLocale('it-IT')).toBe('it');
    expect(matchLocale('pt-PT')).toBe('pt-BR');
    expect(matchLocale('zh-CN')).toBe('zh-Hans');
    expect(matchLocale('zh-TW')).toBeUndefined();
    expect(matchLocale('nl')).toBeUndefined();
  });

  it('prefers the saved choice, then the browser, then the tournament', () => {
    expect(detectLocale('de', ['it-IT'], 'en')).toBe('de');
    expect(detectLocale('xx', ['nl-NL', 'fr-FR'], 'it')).toBe('fr');
    expect(detectLocale(undefined, ['nl'], 'it')).toBe('it');
  });

  it('switches language, loading the ones not in the bundle', async () => {
    const before = getLocale();
    await loadLocale('de');
    setLocale('de');
    expect(t('common.language')).toBe('Sprache');
    setLocale(before);
  });
});

// Every key of a tree, with its leaf
function leaves(tree: object, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  Object.entries(tree).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || Array.isArray(v) || isPlural(v)) out.set(key, v);
    else if (v && typeof v === 'object') leaves(v, key).forEach((leaf, k2) => out.set(k2, leaf));
  });
  return out;
}
const placeholders = (v: unknown): string[] => {
  const texts = typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v as object);
  return [...new Set(texts.flatMap((s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
};

// Languages that must have every key; the others fall back to English until translated
const COMPLETE: Locale[] = ['en', 'it'];

describe('translation files', async () => {
  const files = await Promise.all(
    LOCALES.map(async (l) => {
      await loadLocale(l.code);
      const mod = await import(`../messages/${l.code}.ts`);
      return [l.code, Object.values(mod)[0] as object] as const;
    })
  );
  const reference = leaves(en);
  reference.forEach((_, k) => k.startsWith('prompts.') && reference.delete(k));

  it('has no section named "other", which would read as a plural', () => {
    const check = (tree: object, path: string) =>
      Object.entries(tree).forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v)) {
          expect(Object.keys(v), `${path}${k}`).not.toContain('other');
          check(v, `${path}${k}.`);
        }
      });
    check(en, '');
  });

  it.each(files)('%s: keys and placeholders as in English', (code, file) => {
    const own = leaves(file);
    if (code !== 'en') expect([...own.keys()].filter((k) => k.startsWith('prompts.')), 'prompts are English only').toEqual([]);
    expect([...own.keys()].filter((k) => !reference.has(k) && !k.startsWith('prompts.')), 'keys that English does not have').toEqual([]);
    if (COMPLETE.includes(code)) expect([...reference.keys()].filter((k) => !own.has(k)), 'missing keys').toEqual([]);
    own.forEach((v, k) => {
      if (!reference.has(k)) return;
      const ref = reference.get(k);
      expect(typeof v === 'string' || Array.isArray(v) || isPlural(v), k).toBe(true);
      expect(Array.isArray(v), `${k}: a list in English is a list everywhere`).toBe(Array.isArray(ref));
      // A text has the same placeholders. Plural forms and variants may each leave some out (Italian
      // "una partita" without {count}, a phrase without {loser}), but never use one English lacks.
      if (typeof v === 'string') expect(placeholders(v), k).toEqual(placeholders(ref));
      else expect(placeholders(v).filter((p) => !placeholders(ref).includes(p)), `${k}: unknown placeholders`).toEqual([]);
    });
  });

  it('is complete for the bundled languages', () => {
    expect(translator('it').t('common.language')).toBe('Lingua');
  });
});
