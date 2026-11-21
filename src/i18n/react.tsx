// React side of the translations: re-render on a language change, sentences with links inside,
// the language switcher.
import React, { Fragment, useSyncExternalStore } from 'react';
import { chooseLocale, getLocale, LOCALES, Locale, MessageKey, subscribeLocale, tParts, translator } from './index.ts';

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

// The viewer's translator, re-rendering the component when the language changes
export function useT() {
  return translator(useLocale());
}

// Remounts its children when the language changes, so that every text (also those read with the
// plain t() outside React state) is read again. Wrap the views, below the data hooks: their state
// (data already read) stays.
export function LocaleBoundary({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  return <Fragment key={locale}>{children}</Fragment>;
}

// A sentence with React nodes in it: <Trans k="public.standings.leader" params={{ player: <PlayerLink … /> }} />
export function Trans({ k, params }: { k: MessageKey; params: Record<string, React.ReactNode> }) {
  useLocale();
  const parts = tParts<React.ReactNode>(k, params as Record<string, string | number | React.ReactNode>);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

export function LanguageSwitcher({ className = 'language-switcher' }: { className?: string }) {
  const locale = useLocale();
  const { t } = translator(locale);
  return (
    <label className={className}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        aria-label={t('common.language')}
        onChange={(e) => {
          chooseLocale(e.target.value as Locale).catch(() => {});
        }}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
